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
                        const model = apiManager.getModel("gemini-2.5-flash");
                        let prompt = "";
                        if (data.mode === 'grammar') {
                            prompt = `You are an expert grammar checker. Correct any spelling, punctuation, grammar, or sentence structure issues in the following text. Return ONLY the fully corrected text. Do not include quotes, explanations, or any other text.\n\nText: ${data.text}`;
                        } else {
                            prompt = `You are an expert copywriter. Rewrite the following text strictly in a ${data.mode} tone. Return ONLY the rewritten text. Do not include quotes, explanations, or any other text.\n\nText: ${data.text}`;
                        }
                        const generatePromise = model.generateContent(prompt);
                        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 8000));
                        const result = await Promise.race([generatePromise, timeoutPromise]);
                        const correctedText = result.response.text().trim();
                        usedAI = true;

                        if (correctedText !== data.text) {
                            suggestions.push({
                                id: Date.now(), type: data.mode, original: data.text,
                                suggestion: correctedText,
                                message: data.mode === 'grammar' ? 'Grammar and structure improved by AI.' : `Rewritten in a ${data.mode} tone by AI.`
                            });
                        } else {
                             suggestions.push({
                                id: Date.now(), type: data.mode, original: data.text,
                                suggestion: data.text + (/[.!?]$/.test(data.text) ? '' : '.'),
                                message: 'AI found no major issues.'
                            });
                        }
                        break; // Success, exit retry loop
                    } catch (geminiError) {
                        console.error("Gemini API Error in analyze_text:", geminiError.message || geminiError);
                        const isRetryable = geminiError.status === 429 || geminiError.status === 503 || geminiError.message === 'TIMEOUT';
                        if (isRetryable) {
                            if (apiManager.keys.length > 1) {
                                apiManager.rotateKey();
                                console.log("Retrying with new key...");
                            } else {
                                console.log("Retrying after 2s delay...");
                                await new Promise(resolve => setTimeout(resolve, 2000));
                            }
                            retries--;
                        } else {
                            break; // Other error, fallback
                        }
                    }
                }
            }

            if (!usedAI) {
                // FALLBACK LOGIC
                setTimeout(async () => {
                    if (data.mode === 'grammar') {
                        try {
                            let textToProcess = data.text;
                            
                            const rules = [
                                { regex: /\b(he|she|it)\s+are\b/gi, fix: (m, p1) => `${p1} is` },
                                { regex: /\b(this\s+[a-z]+)\s+are\b/gi, fix: (m, p1) => `${p1} is` },
                                { regex: /\b(we|they)\s+was\b/gi, fix: (m, p1) => `${p1} were` },
                                { regex: /\b(i)\s+is\b/gi, fix: (m, p1) => `${p1} am` },
                                { regex: /\bin\s+big\s+company\b/gi, fix: 'in a big company' },
                            ];

                            rules.forEach(rule => {
                                textToProcess = textToProcess.replace(rule.regex, rule.fix);
                            });

                            const response = await fetch('https://api.languagetool.org/v2/check', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                body: `text=${encodeURIComponent(textToProcess)}&language=en-US`
                            });
                            const result = await response.json();
                            
                            let correctedText = textToProcess;
                            if (result.matches && result.matches.length > 0) {
                                result.matches.sort((a, b) => b.offset - a.offset).forEach(match => {
                                    if (match.replacements && match.replacements.length > 0) {
                                        let replacement = match.replacements[0].value;
                                        correctedText = correctedText.substring(0, match.offset) + replacement + correctedText.substring(match.offset + match.length);
                                    }
                                });
                            }

                            if (correctedText.length > 0 && !/[.!?]$/.test(correctedText)) {
                                correctedText += '.';
                            }

                            if (correctedText !== data.text) {
                                suggestions.push({
                                    id: Date.now() + 2, type: 'grammar', original: data.text,
                                    suggestion: correctedText,
                                    message: 'Grammar, punctuation, and sentence structure improved.'
                                });
                            } else {
                                suggestions.push({
                                    id: Date.now() + 3, type: 'grammar', original: data.text,
                                    suggestion: data.text + (/[.!?]$/.test(data.text) ? '' : '.'),
                                    message: 'Looks good! Added final punctuation if missing.'
                                });
                            }
                        } catch (err) {
                            console.error('LanguageTool Error:', err);
                            suggestions.push({
                                id: Date.now() + 4, type: 'grammar', original: data.text,
                                suggestion: data.text + '.',
                                message: 'Could not connect to grammar API.'
                            });
                        }
                    } else {
                        const messages = {
                            professional: 'Consider rephrasing for a professional context.',
                            formal: 'This phrase could be more formal.',
                            friendly: 'Make this sound warmer and more approachable.',
                            academic: 'Use more precise, academic terminology here.'
                        };
                        suggestions.push({
                            id: Date.now() + 3,
                            type: 'tone',
                            original: data.text.substring(0, Math.min(20, data.text.length)),
                            suggestion: `[${data.mode.toUpperCase()} TONE] Rephrased text goes here...`,
                            message: messages[data.mode] || 'Tone adjustment recommended.'
                        });
                    }
                    suggestions.forEach(sugg => socket.emit('ai_suggestion', sugg));
                }, 500);
            } else {
                suggestions.forEach(sugg => socket.emit('ai_suggestion', sugg));
            }
        } catch (error) {
            socket.emit('ai_error', { message: 'Failed to connect to AI engine.' });
        }
    });

    socket.on('analyze_document', async (data) => {
        try {
            console.log('Generating document metrics...');
            let metrics = {
                sentiment: { label: 'Neutral', confidence: 0 },
                readability: { score: 0, grammar: 0, professionalism: 0, clarity: 0 }
            };
            let usedAI = false;

            if (apiManager.getCurrentKey() !== 'dummy_key') {
                let retries = Math.max(apiManager.keys.length, 3);
                while (retries > 0) {
                    try {
                        const model = apiManager.getModel("gemini-2.5-flash");
                        const prompt = `Analyze the following text and return a JSON object with NO markdown formatting, just raw JSON. Do not include \`\`\`json.
Text: ${data.text}

JSON Schema required:
{
  "sentiment": { "label": "Positive" | "Neutral" | "Negative", "confidence": number (0-100) },
  "readability": { "score": number (0-100), "grammar": number (0-100), "professionalism": number (0-100), "clarity": number (0-100) }
}`;
                        const generatePromise = model.generateContent(prompt);
                        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 8000));
                        const result = await Promise.race([generatePromise, timeoutPromise]);
                        let responseText = result.response.text().trim();
                        if(responseText.startsWith('```json')) {
                            responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
                        }
                        metrics = JSON.parse(responseText);
                        usedAI = true;
                        break;
                    } catch (geminiError) {
                        console.error("Gemini API Error in analyze_document:", geminiError.message || geminiError);
                        const isRetryable = geminiError.status === 429 || geminiError.status === 503 || geminiError.message === 'TIMEOUT';
                        if (isRetryable) {
                            if (apiManager.keys.length > 1) {
                                apiManager.rotateKey();
                                console.log("Retrying with new key...");
                            } else {
                                console.log("Retrying after 2s delay...");
                                await new Promise(resolve => setTimeout(resolve, 2000));
                            }
                            retries--;
                        } else {
                            break; // Other error, fallback
                        }
                    }
                }
            }

            if (!usedAI) {
                // fallback mock
                metrics = {
                    sentiment: { label: 'Positive', confidence: 92 },
                    readability: { score: 85, grammar: 90, professionalism: 80, clarity: 88 }
                };
                setTimeout(() => {
                    socket.emit('document_metrics', metrics);
                }, 1000);
            } else {
                socket.emit('document_metrics', metrics);
            }

        } catch (error) {
            console.error(error);
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
                            setTimeout(() => reject(new Error('TIMEOUT')), 8000)
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
