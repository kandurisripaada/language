require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCeLU7uxpZMYGhPBZhNJXSjPYRaCZCRjiA";
const MODEL_NAME = "gemini-2.5-flash";

async function testGenerate() {
    console.log(`Testing ${MODEL_NAME} with fetch...`);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: "Say hello" }]
                }]
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            console.log("Success!");
            console.log("Response:", JSON.stringify(data, null, 2));
        } else {
            console.error("Error:", JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

testGenerate();
