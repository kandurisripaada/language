const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const API_KEY = process.env.GEMINI_API_KEY;

console.log("API Key loaded:", API_KEY ? "YES" : "NO");
if (API_KEY) console.log("API Key length:", API_KEY.length);

const callGemini = async (modelName, prompt) => {
    if (!API_KEY) {
        console.log("No API Key");
        return null;
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error("Response not OK:", response.status, response.statusText);
            console.error("Error details:", JSON.stringify(data, null, 2));
            throw new Error(data.error?.message || response.statusText);
        }

        console.log("Success! Response:", data.candidates[0].content.parts[0].text);
        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Fetch Error:", error.message);
    }
};

callGemini("gemini-2.5-flash", "Say hello");
