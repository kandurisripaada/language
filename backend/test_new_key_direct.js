require('dotenv').config();

const API_KEY = process.env.GEMINI_INTERVIEW_KEY;

console.log("Testing Key:", API_KEY ? API_KEY.substring(0, 10) + "..." : "NOT FOUND");

async function testKey() {
    if (!API_KEY) {
        console.error("No GEMINI_INTERVIEW_KEY found in .env");
        return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Hello, are you working?" }] }]
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error("API Error:", data.error?.message || response.statusText);
        } else {
            console.log("Success! Response:", data.candidates[0].content.parts[0].text);
        }
    } catch (error) {
        console.error("Network Error:", error.message);
    }
}

testKey();
