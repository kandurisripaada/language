// const fetch = require('node-fetch'); // Using built-in fetch

async function testTopicFeedback() {
    const url = 'http://localhost:5000/api/practice/submit';
    
    const payload = {
        type: 'topic',
        transcript: "I think climate change is a serious issue. We need to reduce carbon emissions and switch to renewable energy sources like solar and wind power. It's important for the future of our planet.",
        duration: 15,
        wordCount: 30,
        wpm: 120,
        fillerWords: [],
        repeatingWords: [],
        question: {
            id: 1,
            text: "What are your thoughts on climate change?"
        }
    };

    console.log("Testing Topic Feedback with payload:", JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("\nResponse received:");
        console.log("Answer Relevance:", data.answerRelevance);
        console.log("Topic Feedback:", data.topicFeedback);
        console.log("Full Response:", JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("Error testing feedback:", error);
    }
}

testTopicFeedback();
