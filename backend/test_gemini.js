require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Use env var or fallback to the hardcoded one for now to test if it's valid
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDxX8Kbm85r9DYd4kNwVgl5OuDiqT836sc";

const genAI = new GoogleGenerativeAI(API_KEY);

async function testModel(modelName) {
    console.log(`\nTesting ${modelName}...`);
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Say hello");
        const response = await result.response;
        console.log(`${modelName} Response:`, response.text());
        return true;
    } catch (err) {
        console.error(`${modelName} Error Message:`, err.message);
        if (err.response) {
            console.error(`${modelName} Error Response:`, JSON.stringify(err.response, null, 2));
        }
        return false;
    }
}

async function runTests() {
    console.log("Starting Gemini API Tests...");
    console.log("API Key length:", API_KEY ? API_KEY.length : 0);

    await testModel("models/gemini-2.5-flash");
}

runTests();
