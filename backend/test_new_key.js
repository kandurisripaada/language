require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCIvP3H9QXhLDrmT3bDLmi11RmYQQv-xYI";

async function testKey() {
    console.log("Testing new API key...");
    console.log("Key length:", API_KEY.length);
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Say hello in one word" }] }]
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            console.log("✅ SUCCESS! API key works!");
            console.log("Response:", data.candidates[0].content.parts[0].text);
        } else {
            console.log("❌ FAILED!");
            console.log("Status:", response.status);
            console.log("Error:", JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("❌ Network Error:", error.message);
    }
}

testKey();
