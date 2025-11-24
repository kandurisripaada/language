const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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

// Initialize Gemini
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error("CRITICAL ERROR: GEMINI_API_KEY is not set in environment variables.");
}

// Helper to call Gemini API via fetch (bypassing SDK issues)
const callGemini = async (modelName, prompt) => {
    if (!API_KEY) return null;
    
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
        console.error(`\n🔴 Gemini API Error (${modelName}):`);
        console.error(`   Message: ${error.message}`);
        console.error(`   API Key present: ${API_KEY ? 'YES' : 'NO'}`);
        console.error(`   API Key length: ${API_KEY ? API_KEY.length : 0}`);
        throw error;
    }
};

// In-memory caches
// In-memory caches
let topicCache = [];
let grammarCache = {
    basic: [],
    intermediate: [],
    advanced: []
};

const GRAMMAR_BATCH_SIZE = 40;
const TOPIC_BATCH_SIZE = 20;

// Helper to generate content using Gemini
const generateBatch = async (type, count, difficulty = 'intermediate') => {
    if (!API_KEY) {
        console.error("Skipping generation: No API Key available.");
        return [];
    }

    console.log(`Generating new batch of ${count} ${type} questions (Difficulty: ${difficulty})...`);
    
    const generateWithModel = async (modelName) => {
        try {
            let prompt = "";
            if (type === 'grammar') {
                let difficultyDesc = "";
                switch(difficulty) {
                    case 'basic':
                        difficultyDesc = "simple, short sentences suitable for beginners (A1-A2 level). Focus on basic tenses (present simple, past simple) and common vocabulary.";
                        break;
                    case 'advanced':
                        difficultyDesc = "complex, sophisticated sentences suitable for advanced learners (C1-C2 level). Include nuanced grammar, idioms, mixed conditionals, and advanced vocabulary.";
                        break;
                    case 'intermediate':
                    default:
                        difficultyDesc = "moderately complex sentences suitable for intermediate learners (B1-B2 level). Include compound sentences and a variety of standard tenses.";
                        break;
                }

                prompt = `Generate ${count} unique, diverse English sentences for grammar practice. 
                They should be ${difficultyDesc}
                Return ONLY a JSON array of objects with this structure: [{"id": 1, "text": "Sentence here"}, ...]
                Do not include markdown formatting.`;
            } else if (type === 'topic') {
                prompt = `Generate ${count} interesting, open-ended discussion topics for English speaking practice.
                They should cover various themes like technology, society, personal growth, travel, etc.
                Return ONLY a JSON array of objects with this structure: [{"id": 1, "text": "Topic question here"}, ...]
                Do not include markdown formatting.`;
            }

            const text = await callGemini(modelName, prompt);
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (error) {
            console.warn(`Failed with model ${modelName}:`, error.message);
            throw error;
        }
    };

    try {
        return await generateWithModel("gemini-2.5-flash");
    } catch (error) {
        console.log("⚠️  gemini-2.5-flash failed, falling back to gemini-2.5-pro...");
        console.log("   Error:", error.message);
        try {
            return await generateWithModel("gemini-2.5-pro");
        } catch (fallbackError) {
            console.error(`❌ Error generating ${type} batch after fallback:`);
            console.error(`   Model: gemini-2.5-pro`);
            console.error(`   Error: ${fallbackError.message}`);
            return [];
        }
    }
};

// Routes
app.get('/api/practice/questions/topic', async (req, res) => {
    if (topicCache.length === 0) {
        const newBatch = await generateBatch('topic', TOPIC_BATCH_SIZE);
        if (newBatch.length > 0) {
            topicCache = newBatch;
            console.log(`✅ Generated ${newBatch.length} NEW topics from Gemini API`);
        } else {
            // Fallback to local file if generation fails
            topicCache = readData('topics.json');
            console.log(`⚠️  Using ${topicCache.length} fallback topics from JSON file`);
        }
    }
    
    const question = topicCache.shift(); // Get and remove the first item
    res.json(question);
});

app.get('/api/practice/questions/grammar', async (req, res) => {
    const difficulty = req.query.difficulty || 'intermediate';
    
    // Validate difficulty
    if (!['basic', 'intermediate', 'advanced'].includes(difficulty)) {
        return res.status(400).json({ error: "Invalid difficulty level. Use 'basic', 'intermediate', or 'advanced'." });
    }

    if (grammarCache[difficulty].length === 0) {
        const newBatch = await generateBatch('grammar', GRAMMAR_BATCH_SIZE, difficulty);
        if (newBatch.length > 0) {
            grammarCache[difficulty] = newBatch;
            console.log(`✅ Generated ${newBatch.length} NEW ${difficulty} grammar sentences from Gemini API`);
        } else {
            // Fallback to local file if generation fails - filter by difficulty if possible, or just return generic
            // For now, we'll just return generic fallback
            const allFallback = readData('grammar.json');
            // Simple heuristic for fallback if we wanted, but for now just taking a slice to avoid complexity
            grammarCache[difficulty] = allFallback.slice(0, 20); 
            console.log(`⚠️  Using ${grammarCache[difficulty].length} fallback grammar sentences from JSON file`);
        }
    }

    const question = grammarCache[difficulty].shift(); // Get and remove the first item
    res.json(question);
});

// Clear cache endpoint - forces regeneration from API
app.post('/api/practice/cache/clear', (req, res) => {
    const previousTopicCount = topicCache.length;
    const previousGrammarCount = grammarCache.basic.length + grammarCache.intermediate.length + grammarCache.advanced.length;
    
    topicCache = [];
    grammarCache = {
        basic: [],
        intermediate: [],
        advanced: []
    };
    
    console.log(`🗑️  Cache cleared! Removed ${previousTopicCount} topics and ${previousGrammarCount} grammar sentences`);
    console.log(`   Next request will generate fresh content from Gemini API`);
    
    res.json({ 
        success: true, 
        message: 'Cache cleared successfully',
        cleared: {
            topics: previousTopicCount,
            grammar: previousGrammarCount
        }
    });
});

app.get('/api/practice/questions/interview', (req, res) => {
    const interviews = readData('interviews.json');
    const randomInterview = interviews[Math.floor(Math.random() * interviews.length)];
    res.json(randomInterview);
});

// Mock submission endpoint - in a real app this would save to DB
// Here we just return some analysis
app.post('/api/practice/submit', async (req, res) => {
    const { type, transcript, duration, fillerWords, repeatingWords, wordCount, wpm } = req.body;
    
    if (!API_KEY) {
        return res.status(500).json({ error: 'Server misconfigured: Missing API Key' });
    }

    try {
        const prompt = `
You are an expert English language coach analyzing a spoken practice session. Provide comprehensive feedback in a single response.

TRANSCRIPT: "${transcript}"

AUDIO METRICS:
- Duration: ${duration} seconds
- Total words: ${wordCount || 'N/A'}
- Speaking speed: ${wpm || 'N/A'} WPM (words per minute)
- Filler words detected: ${JSON.stringify(fillerWords || [])}
- Repeated words: ${JSON.stringify(repeatingWords || [])}

TASK: Analyze the transcript and provide detailed feedback in the following JSON format:

{
  "grammarErrors": [
    {
      "original": "exact text with error from transcript",
      "corrected": "grammatically correct version",
      "rule": "brief explanation of grammar rule violated",
      "severity": "minor/moderate/major"
    }
  ],
  "pronunciationTips": [
    "Specific pronunciation advice based on common errors in the transcript",
    "Focus on words that are commonly mispronounced"
  ],
  "fluencyScore": 0-100,
  "fluencyBreakdown": {
    "grammar": 0-100,
    "vocabulary": 0-100,
    "coherence": 0-100,
    "speed": 0-100,
    "fillerWordImpact": 0-100
  },
  "vocabularyLevel": "beginner/intermediate/advanced",
  "vocabularyRichness": 0-100,
  "sentenceComplexity": "simple/moderate/complex",
  "strengths": [
    "Specific positive aspect 1",
    "Specific positive aspect 2"
  ],
  "improvements": [
    "Actionable improvement 1",
    "Actionable improvement 2"
  ],
  "overallFeedback": "2-3 encouraging sentences summarizing performance and next steps"
}

GUIDELINES:
- Be constructive and encouraging
- Provide specific, actionable feedback
- Consider the speaking speed (ideal: 130-160 WPM for fluent English)
- Account for filler words in fluency scoring
- Grammar errors should be realistic (don't over-correct casual speech)
- Pronunciation tips should be based on actual words in the transcript
- Return ONLY valid JSON, no markdown formatting
`;

        // Use flash for faster feedback
        const text = await callGemini("gemini-2.5-flash", prompt);
        
        // Clean up the response if it contains markdown code blocks
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const analysis = JSON.parse(jsonStr);

        const results = {
            ...analysis,
            overallScore: analysis.fluencyScore,
            // Map breakdown to top-level keys for backward compatibility/easier access
            grammarAccuracy: analysis.fluencyBreakdown.grammar,
            pronunciation: analysis.fluencyBreakdown.speed, 
            fluency: analysis.fluencyBreakdown.speed, 
            coherence: analysis.fluencyBreakdown.coherence,
            vocabulary: analysis.fluencyBreakdown.vocabulary,
            engagement: analysis.fluencyBreakdown.coherence, 
            feedback: analysis.overallFeedback
        };

        res.json(results);

    } catch (error) {
        console.error('Error generating feedback:', error);
        res.status(500).json({ error: 'Failed to generate feedback' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
