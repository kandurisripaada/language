// No import needed for Node 18+
async function testInterview() {
    try {
        console.log("Testing Interview Endpoint...");
        const response = await fetch('http://localhost:5000/api/interview/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                history: [],
                start: true,
                interviewType: 'hr'
            })
        });

        const data = await response.json();
        console.log("Status:", response.status);
        if (data.text) {
            console.log("Success! AI Response:", data.text);
        } else {
            console.log("Failed. Response:", data);
        }
    } catch (error) {
        console.error("Test Failed:", error.message);
    }
}

testInterview();
