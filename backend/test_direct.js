require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

async function testDirectGeneration() {
    console.log("Testing direct API generation...");
    console.log("API Key:", API_KEY ? API_KEY.substring(0, 15) + "..." : "NOT FOUND");
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    
    const prompt = `Generate 3 interesting, open-ended discussion topics for English speaking practice.
    Return ONLY a JSON array of objects with this structure: [{"id": 1, "text": "Topic question here"}, ...]
    Do not include markdown formatting.`;
    
    try {
        console.log("\nCalling Gemini API...");
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.log("\n❌ API CALL FAILED");
            console.log("Status:", response.status);
            console.log("Error:", JSON.stringify(data, null, 2));
            return;
        }

        const text = data.candidates[0].content.parts[0].text;
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const topics = JSON.parse(jsonStr);
        
        console.log("\n✅ API CALL SUCCESSFUL!");
        console.log("Generated topics:");
        topics.forEach(t => console.log(`  ${t.id}. ${t.text}`));
        
    } catch (error) {
        console.log("\n❌ ERROR:", error.message);
    }
}

testDirectGeneration();
