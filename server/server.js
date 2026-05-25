const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ['http://localhost:5173', 'https://smartcorrect.vercel.app'], // Allow both local and production
        methods: ['GET', 'POST']
    }
});

global.errorLogs = [];
const originalConsoleError = console.error;
console.error = function(...args) {
    global.errorLogs.push({ time: new Date().toISOString(), args: args.map(a => typeof a === 'object' ? JSON.stringify(a, Object.getOwnPropertyNames(a)) : a) });
    if (global.errorLogs.length > 50) global.errorLogs.shift();
    originalConsoleError.apply(console, args);
};

app.get('/api/debug/logs', (req, res) => res.json(global.errorLogs));

app.use(cors());
app.use(express.json());

// Database Connection
const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/smartcorrect';
        await mongoose.connect(uri);
        console.log('MongoDB Connected successfully');
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1);
    }
};
connectDB();

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/analytics', require('./routes/analytics'));
// app.use('/api/ai', require('./routes/ai')); // Will be added in Phase 4

const { GoogleGenerativeAI } = require('@google/generative-ai');

class APIKeyManager {
    constructor(keysString) {
        this.keys = keysString ? keysString.split(',').map(k => k.trim()).filter(k => k) : ['dummy_key'];
        this.currentIndex = 0;
    }
    
    getCurrentKey() {
        return this.keys[this.currentIndex];
    }
    
    rotateKey() {
        if (this.keys.length > 1) {
            this.currentIndex = (this.currentIndex + 1) % this.keys.length;
            console.log(`[API Manager] 429 Rate Limit Hit. Rotated to API key index ${this.currentIndex}`);
            return true;
        }
        return false;
    }
    
    getModel(modelName = "gemini-2.5-flash") {
        const genAI = new GoogleGenerativeAI(this.getCurrentKey());
        return genAI.getGenerativeModel({ model: modelName });
    }
}

const apiManager = new APIKeyManager(process.env.GEMINI_API_KEY);

// Socket.IO for Real-time Suggestions
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('analyze_text', async (data) => {
        try {
            console.log('Analyzing text for:', data.mode);
            let suggestions = [];
            let usedAI = false;

            if (apiManager.getCurrentKey() !== 'dummy_key') {
                let retries = Math.max(apiManager.keys.length, 3);
                while (retries > 0) {
                    try {
                        const model = apiManager.getModel("gemini-1.5-flash");
                        const prompt = `You are an expert writing assistant. Analyze the following text and return a strict JSON object with this exact structure:
{
  "corrected_text": "The fully corrected text fixing spelling, grammar, and structure",
  "sentiment": {
    "label": "Positive, Negative, or Neutral",
    "confidence": 85
  },
  "scores": {
    "grammar": 90,
    "readability": 80,
    "professionalism": 70,
    "clarity": 85
  },
  "tones": {
    "formal": "The text rewritten strictly in a formal tone",
    "friendly": "The text rewritten strictly in a friendly tone"
  }
}
If the text is short or incomplete, naturally expand it into a complete, well-formed sentence for the tones. Return ONLY the JSON object, with no markdown formatting.
Text: ${data.text}`;

                        const generatePromise = model.generateContent({
                            contents: [{ role: 'user', parts: [{ text: prompt }] }],
                            generationConfig: { responseMimeType: "application/json" }
                        });
                        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 15000));
                        const result = await Promise.race([generatePromise, timeoutPromise]);
                        const responseText = result.response.text().trim();
                        usedAI = true;
                        
                        const aiData = JSON.parse(responseText);

                        // Emit metrics directly
                        socket.emit('document_metrics', {
                            sentiment: aiData.sentiment || { label: 'Neutral', confidence: 0 },
                            readability: aiData.scores || { grammar: 0, readability: 0, professionalism: 0, clarity: 0 }
                        });

                        // Generate suggestions
                        if (aiData.corrected_text && aiData.corrected_text !== data.text) {
                            suggestions.push({
                                id: Date.now() + 1, type: 'grammar', original: data.text,
                                suggestion: aiData.corrected_text,
                                message: 'Grammar and structure improved by AI.'
                            });
                        }
                        if (aiData.tones && aiData.tones.formal && aiData.tones.formal !== data.text) {
                            suggestions.push({
                                id: Date.now() + 2, type: 'formal', original: data.text,
                                suggestion: aiData.tones.formal,
                                message: 'Rewritten in a formal tone by AI.'
                            });
                        }
                        if (aiData.tones && aiData.tones.friendly && aiData.tones.friendly !== data.text) {
                            suggestions.push({
                                id: Date.now() + 3, type: 'friendly', original: data.text,
                                suggestion: aiData.tones.friendly,
                                message: 'Rewritten in a friendly tone by AI.'
                            });
                        }
                        break; // Success, exit retry loop
                    } catch (geminiError) {
                        console.error("Gemini API Error in analyze_text:", geminiError.message || geminiError);
                        const msg = (geminiError.message || geminiError || '').toString();
                        data.lastAiError = msg;

                        const isRetryable = geminiError.status === 429 || geminiError.status === 503 || msg === 'TIMEOUT' || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
                        if (isRetryable) {
                            if (apiManager.keys.length > 1) {
                                apiManager.rotateKey();
                                console.log("Rate limit/timeout hit. Rotated key and retrying...");
                            } else {
                                if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
                                    break; 
                                }
                                console.log("Timeout/Error hit. Waiting 2s before retrying...");
                                await new Promise(resolve => setTimeout(resolve, 2000));
                            }
                            retries--;
                        } else {
                            break;
                        }
                    }
                }
            }

            if (!usedAI) {
                let errorMsg = 'The AI provider is temporarily unavailable. Please try again.';
                if (data.lastAiError && data.lastAiError.includes('key not valid')) {
                     errorMsg = 'API Key is invalid. Please check your Render environment variables (remove quotes).';
                } else if (data.lastAiError && data.lastAiError.includes('429')) {
                     errorMsg = 'The free tier limit was reached. Please wait 60 seconds.';
                } else if (data.lastAiError) {
                     errorMsg = data.lastAiError.substring(0, 100);
                }
                
                suggestions.push({
                    id: Date.now() + 3,
                    type: 'grammar',
                    original: data.text.substring(0, Math.min(20, data.text.length)),
                    suggestion: `[AI Error] ${errorMsg}`,
                    message: 'Adjustment recommended.'
                });
            }
                
                suggestions.forEach(sugg => socket.emit('ai_suggestion', sugg));
            } else {
                suggestions.forEach(sugg => socket.emit('ai_suggestion', sugg));
            }
        } catch (error) {
            socket.emit('ai_error', { message: 'Failed to connect to AI engine.' });
        }
    });

    socket.on('analyze_document', async (data) => {
        try {
            console.log('Generating document metrics locally...');
            const text = data.text || '';
            const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 0);
            
            // 1. Calculate Sentiment using 'sentiment' package
            const Sentiment = require('sentiment');
            const sentimentAnalyzer = new Sentiment();
            const sentimentResult = sentimentAnalyzer.analyze(text);
            
            let label = 'Neutral';
            if (sentimentResult.score > 1) label = 'Positive';
            if (sentimentResult.score < -1) label = 'Negative';
            
            // Normalize sentiment score (0-100)
            let conf = 50 + (sentimentResult.score * 10);
            conf = Math.max(0, Math.min(100, conf));

            // 2. Calculate Readability
            // Simple heuristic: 100 - (avg word length * 5)
            const avgWordLength = words.length > 0 ? words.reduce((acc, w) => acc + w.length, 0) / words.length : 0;
            let readability = words.length > 0 ? 100 - (avgWordLength * 5) : 0;
            readability = Math.max(0, Math.min(100, Math.round(readability)));

            // 3. Fake Grammar, Professionalism, Clarity based on heuristics
            const hasSlang = words.some(w => ['hlo', 'wht', 'r', 'u', 'lol', 'lmao', 'brb', 'idk', 'omg'].includes(w));
            const grammar = hasSlang ? 65 : 95;
            const professionalism = hasSlang ? 50 : 85;
            const clarity = hasSlang ? 70 : 88;

            const metrics = {
                sentiment: { label, confidence: Math.round(conf) },
                readability: { score: readability, grammar, professionalism, clarity }
            };

            socket.emit('document_metrics', metrics);
        } catch (error) {
            console.error('Error generating local metrics:', error);
        }
    });

    socket.on('ai_tool', async (data) => {
        try {
            console.log(`Processing AI Tool: ${data.action}`);
            let prompt = '';
            if (data.action === 'summarize') prompt = `Summarize the following text concisely. Return ONLY the summarized text, no markdown or extra conversational words:\n\n${data.text}`;
            if (data.action === 'expand') prompt = `Expand the following short sentence(s) into a detailed, professional paragraph. Return ONLY the expanded text, no markdown or extra conversational words:\n\n${data.text}`;
            if (data.action === 'bullets') prompt = `Convert the following paragraph into a concise bulleted list. Return ONLY the list, no markdown or extra conversational words:\n\n${data.text}`;
            if (data.action === 'translate') prompt = `Translate the following text into ${data.language || 'Spanish'}. Return ONLY the translated text, no markdown or extra conversational words:\n\n${data.text}`;

            let responseText = `[${data.action.toUpperCase()} RESULT] ...`; // Fallback
            let usedAI = false;

            if (apiManager.getCurrentKey() !== 'dummy_key') {
                let retries = Math.min(apiManager.keys.length, 2); // Max 2 retries to prevent UI freezing
                while (retries > 0) {
                    try {
                        const model = apiManager.getModel("gemini-2.5-flash");
                        
                        // Add a 2-second timeout to prevent the SDK from hanging on 429 retries
                        const generatePromise = model.generateContent(prompt);
                        const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('TIMEOUT')), 15000)
                        );
                        
                        const result = await Promise.race([generatePromise, timeoutPromise]);
                        responseText = result.response.text().trim();
                        usedAI = true;
                        break;
                    } catch(e) {
                        console.error('Gemini AI tool error:', e.message || e);
                        if ((e.status === 429 || e.message === 'TIMEOUT') && apiManager.rotateKey()) {
                            retries--;
                        } else {
                            break;
                        }
                    }
                }
            }

            if (!usedAI) {
                if (data.action === 'translate') {
                    try {
                        let langCode = 'es';
                        if (data.language === 'French') langCode = 'fr';
                        if (data.language === 'German') langCode = 'de';
                        if (data.language === 'Hindi') langCode = 'hi';
                        if (data.language === 'Japanese') langCode = 'ja';

                        const https = require('https');
                        responseText = await new Promise((resolve, reject) => {
                            https.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(data.text)}&langpair=en|${langCode}`, (res) => {
                                let body = '';
                                res.on('data', chunk => body += chunk);
                                res.on('end', () => {
                                    try {
                                        const json = JSON.parse(body);
                                        resolve(json.responseData.translatedText);
                                    } catch(e) { reject(e); }
                                });
                            }).on('error', reject);
                        });
                        
                        if (responseText.includes("MYMEMORY WARNING")) {
                            responseText = `(Translation unavailable) ${data.text}`;
                        }
                    } catch(e) {
                        responseText = `(Translation unavailable) ${data.text}`;
                    }
                } else if (data.action === 'summarize') {
                    const sentences = data.text.split('.');
                    responseText = sentences[0] + (sentences.length > 1 ? '.' : '');
                    if (responseText.length > 100) responseText = responseText.substring(0, 100) + '...';
                } else if (data.action === 'expand') {
                    responseText = data.text + " This expanded perspective provides a deeper understanding of the core subject matter, emphasizing its importance in a professional context.";
                } else if (data.action === 'bullets') {
                    responseText = data.text.split(/[.,]/).filter(s => s.trim().length > 0).map(s => `• ${s.trim()}`).join('\n');
                    if (!responseText) responseText = `• ${data.text}`;
                }
            }

            // Instead of returning ai_tool_result, the user wants to Accept/Reject it, so we format it as a suggestion!
            socket.emit('ai_suggestion', {
                id: Date.now(),
                type: data.action,
                original: data.text,
                suggestion: responseText,
                message: `AI generated a ${data.action} for your selected text.`,
                isReplaceSelection: data.hasSelection // Add a flag so the frontend knows to replace selection
            });

        } catch (error) {
            console.error('AI Tool Event Error:', error);
            socket.emit('ai_error', { message: 'Failed to process AI tool request.' });
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`SmartCorrect Server running on port ${PORT}`);
});
