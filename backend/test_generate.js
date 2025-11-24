require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

async function callGemini(modelName, prompt) {
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
            throw new Error(data.error?.message || response.statusText);
        }

        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error(`Error: ${error.message}`);
        throw error;
    }
}

async function generateTopics() {
    console.log("\n🎯 Generating 5 TOPICS using Gemini API...\n");
    
    const prompt = `Generate 5 interesting, open-ended discussion topics for English speaking practice.
    They should cover various themes like technology, society, personal growth, travel, etc.
    Return ONLY a JSON array of objects with this structure: [{"id": 1, "text": "Topic question here"}, ...]
    Do not include markdown formatting.`;

    try {
        const text = await callGemini("gemini-2.5-flash", prompt);
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const topics = JSON.parse(jsonStr);
        
        console.log("✅ SUCCESS! Generated topics:\n");
        topics.forEach(topic => {
            console.log(`${topic.id}. ${topic.text}`);
        });
    } catch (error) {
        console.log("❌ FAILED to generate topics");
    }
}

async function generateGrammar() {
    console.log("\n📝 Generating 5 GRAMMAR sentences using Gemini API...\n");
    
    const prompt = `Generate 5 unique, diverse English sentences for grammar practice.
    They should vary in complexity (simple, compound, complex) and cover different tenses and grammatical structures.
    Return ONLY a JSON array of objects with this structure: [{"id": 1, "text": "Sentence here"}, ...]
    Do not include markdown formatting.`;

    try {
        const text = await callGemini("gemini-2.5-flash", prompt);
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const sentences = JSON.parse(jsonStr);
        
        console.log("✅ SUCCESS! Generated grammar sentences:\n");
        sentences.forEach(sentence => {
            console.log(`${sentence.id}. ${sentence.text}`);
        });
    } catch (error) {
        console.log("❌ FAILED to generate grammar sentences");
    }
}

async function runTest() {
    console.log("=".repeat(60));
    console.log("Testing Gemini API Integration");
    console.log("=".repeat(60));
    console.log(`API Key: ${API_KEY ? API_KEY.substring(0, 15) + '...' : 'NOT FOUND'}`);
    console.log(`Key Length: ${API_KEY ? API_KEY.length : 0}`);
    
    await generateTopics();
    await generateGrammar();
    
    console.log("\n" + "=".repeat(60));
    console.log("Test Complete!");
    console.log("=".repeat(60));
}

runTest();
