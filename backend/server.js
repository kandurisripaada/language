const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Helper to read data files
const readData = (filename) => {
    const filePath = path.join(__dirname, 'data', filename);
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        return [];
    }
};

// Routes
app.get('/api/practice/questions/topic', (req, res) => {
    const topics = readData('topics.json');
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    res.json(randomTopic);
});

app.get('/api/practice/questions/grammar', (req, res) => {
    const grammar = readData('grammar.json');
    const randomGrammar = grammar[Math.floor(Math.random() * grammar.length)];
    res.json(randomGrammar);
});

app.get('/api/practice/questions/interview', (req, res) => {
    const interviews = readData('interviews.json');
    const randomInterview = interviews[Math.floor(Math.random() * interviews.length)];
    res.json(randomInterview);
});

// Mock submission endpoint - in a real app this would save to DB
// Here we just return some analysis
app.post('/api/practice/submit', (req, res) => {
    const { type, transcript, duration, fillerWords, repeatingWords } = req.body;
    
    // Mock analysis logic
    const calculateScore = () => Math.floor(Math.random() * (95 - 70) + 70);
    
    const results = {
        overallScore: calculateScore(),
        fluency: calculateScore(),
        coherence: calculateScore(),
        vocabulary: calculateScore(),
        engagement: calculateScore(),
        grammarAccuracy: calculateScore(),
        pronunciation: calculateScore(),
        confidence: calculateScore(),
        clarity: calculateScore(),
        structure: calculateScore(),
        contentQuality: calculateScore(),
        feedback: "Great job! Try to reduce filler words and speak more confidently."
    };

    res.json(results);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
