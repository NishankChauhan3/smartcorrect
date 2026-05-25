require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
    const keys = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.split(',').map(k => k.trim()) : [];
    console.log("Keys found:", keys.length);
    if (keys.length === 0) {
        console.log("No keys found in .env");
        return;
    }
    
    try {
        const genAI = new GoogleGenerativeAI(keys[0]);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        console.log("Calling Gemini API...");
        const result = await model.generateContent("hello, testing!");
        console.log("Success! Response:", result.response.text());
    } catch (error) {
        console.error("Gemini API Error Object:", error);
        if (error.status) console.error("Status:", error.status);
        if (error.message) console.error("Message:", error.message);
    }
}

testGemini();
