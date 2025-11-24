require('dotenv').config();
console.log("API Key loaded:", process.env.GEMINI_API_KEY ? "YES" : "NO");
console.log("API Key length:", process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0);
console.log("First 10 chars:", process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 10) : "N/A");
