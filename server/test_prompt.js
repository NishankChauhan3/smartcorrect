require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testPrompt() {
    const key = process.env.GEMINI_API_KEY.split(',')[0].trim();
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `You are an expert copywriter. Rewrite the following text strictly in a academic tone. Return ONLY the rewritten text. Do not include quotes, explanations, or any other text.\n\nText: I am well.`;
    
    try {
        console.log("Calling Gemini API...");
        const result = await model.generateContent(prompt);
        console.log("Success! Response:", result.response.text());
    } catch (error) {
        console.log("Error properties:");
        console.log("message:", error.message);
        console.log("status:", error.status);
    }
}
testPrompt();
