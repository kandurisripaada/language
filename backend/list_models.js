require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCeLU7uxpZMYGhPBZhNJXSjPYRaCZCRjiA";

async function listModels() {
    console.log("Fetching models...");
    try {
        // The SDK doesn't have a direct listModels method exposed easily in all versions, 
        // so let's use fetch for this specific task to be sure.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();
        
        if (data.models) {
            const models = data.models.filter(m => m.name.includes('gemini')).map(m => m.name).join('\n');
            require('fs').writeFileSync('models.txt', models, 'utf8');
            console.log("Models written to models.txt");
        } else {
            console.log("No models found or error:", JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
