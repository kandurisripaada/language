// Native fetch
async function testAdvancedGrammar() {
    try {
        console.log("Testing Advanced Grammar Generation...");
        const response = await fetch('http://localhost:5000/api/practice/questions/grammar?difficulty=advanced');
        
        const data = await response.json();
        console.log("Status:", response.status);
        if (data.text) {
            console.log("Success! Question:", data.text);
        } else {
            console.log("Failed. Response:", data);
        }
    } catch (error) {
        console.error("Test Failed:", error.message);
    }
}

testAdvancedGrammar();
