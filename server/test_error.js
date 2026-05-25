require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testPrompt() {
    const key = 'invalid_key';
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `Hello`;
    
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
