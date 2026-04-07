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

// database connection
// database connection
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken'); // Added for manual token verification
const authRoutes = require('./routes/auth');
const PracticeSession = require('./models/PracticeSession'); // Added Persistence Model
const VocabularyWord = require('./models/VocabularyWord');

// Connect to MongoDB
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/languabot', {
            // useNewUrlParser: true, // Deprecated in newer mongoose, but safe to remove usually
            // useUnifiedTopology: true
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        // data mode? if db fails, maybe we still run? for now let's just log
    }
};

// Only connect if URI is present (or default to local)
// But to prevent crashing if user hasn't set it up yet, we'll wrap it
if (process.env.MONGODB_URI) {
    connectDB();
} else {
    console.log("⚠️ MONGODB_URI not found in .env. Auth features may not work.");
}

// Middleware to prevent hanging if DB is not connected
app.use('/api/auth', (req, res, next) => {
    // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: 'Service Unavailable: Database not connected. Please restart backend.' });
    }
    next();
});

app.use('/api/auth', authRoutes);

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

// Initialize Gemini (Stored as comments per request)
/*
const API_KEY = process.env.GEMINI_API_KEY;
const INTERVIEW_API_KEY = process.env.GEMINI_INTERVIEW_KEY || API_KEY;

if (!API_KEY) {
    console.error("CRITICAL ERROR: GEMINI_API_KEY is not set in environment variables.");
}
*/

// Initialize Groq
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = "llama-3.3-70b-versatile"; // High-quality model for interview/chat

// Helper to call Gemini API via fetch (bypassing SDK issues)
/*
const callGemini = async (modelName, prompt, specificKey = null) => {
    const keyToUse = specificKey || API_KEY;
    
    if (!keyToUse) return null;
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${keyToUse}`;
    
    const startTime = Date.now();
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const duration = Date.now() - startTime;
        
        // Log to file
        const logEntry = `[${new Date().toISOString()}] Model: ${modelName} | Duration: ${duration}ms\n`;
        fs.appendFileSync(path.join(__dirname, 'server_timing.log'), logEntry);
        
        if (!response.ok) {
            throw new Error(data.error?.message || response.statusText);
        }

        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        const duration = Date.now() - startTime;
        const logEntry = `[${new Date().toISOString()}] ERROR Model: ${modelName} | Duration: ${duration}ms | Error: ${error.message}\n`;
        fs.appendFileSync(path.join(__dirname, 'server_timing.log'), logEntry);
        
        console.error(`\n🔴 Gemini API Error (${modelName}):`);
        console.error(`   Message: ${error.message}`);
        console.error(`   Key Used: ${keyToUse === API_KEY ? 'MAIN' : 'INTERVIEW'}`);
        throw error;
    }
};
*/

// Helper to call Groq API
const callGroq = async (prompt, systemPrompt = "You are a helpful assistant.") => {
    const startTime = Date.now();
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            model: GROQ_MODEL,
        });

        const duration = Date.now() - startTime;
        const logEntry = `[${new Date().toISOString()}] Groq Model: ${GROQ_MODEL} | Duration: ${duration}ms\n`;
        fs.appendFileSync(path.join(__dirname, 'server_timing.log'), logEntry);

        return chatCompletion.choices[0].message.content;
    } catch (error) {
        const duration = Date.now() - startTime;
        const logEntry = `[${new Date().toISOString()}] ERROR Groq Model: ${GROQ_MODEL} | Duration: ${duration}ms | Error: ${error.message}\n`;
        fs.appendFileSync(path.join(__dirname, 'server_timing.log'), logEntry);
        
        console.error(`\n🔴 Groq API Error:`);
        console.error(`   Message: ${error.message}`);
        throw error;
    }
};

const parseJsonObject = (text) => {
    let jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const startIndex = jsonStr.indexOf('{');
    const endIndex = jsonStr.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) {
        jsonStr = jsonStr.substring(startIndex, endIndex + 1);
    }

    try {
        return JSON.parse(jsonStr);
    } catch (parseError) {
        const sanitizedStr = jsonStr.replace(/[\n\r\t]/g, ' ');
        return JSON.parse(sanitizedStr);
    }
};

const getUserIdFromAuthHeader = (req) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id;
};

const generateWordMeaningAndExamples = async (word) => {
    const prompt = `
You are an English vocabulary coach.
For the word "${word}", return ONLY valid JSON with this exact shape:
{
  "meaning": "short learner-friendly meaning",
  "examples": [
    "example sentence 1",
    "example sentence 2"
  ]
}
Rules:
- Keep examples practical and natural.
- Exactly 2 examples.
- No markdown, no extra keys.
`;

    const raw = await callGroq(prompt, "You are an English vocabulary coach. Always return valid minified JSON only.");
    const parsed = parseJsonObject(raw);
    const fallbackMeaning = `Meaning for "${word}"`;
    const meaning = typeof parsed.meaning === 'string' && parsed.meaning.trim()
        ? parsed.meaning.trim()
        : fallbackMeaning;
    const examples = Array.isArray(parsed.examples)
        ? parsed.examples.filter(e => typeof e === 'string' && e.trim()).slice(0, 2)
        : [];

    while (examples.length < 2) {
        examples.push(`I learned how to use "${word}" in a sentence.`);
    }

    return { meaning, examples };
};

// In-memory caches
let topicCache = [];
let grammarCache = {
    basic: [],
    intermediate: [],
    advanced: []
};
let listeningCache = {
    conversation: { basic: [], intermediate: [], advanced: [] },
    story: { basic: [], intermediate: [], advanced: [] }
};
let readingCache = {
    basic: [],
    intermediate: [],
    advanced: []
};

const GRAMMAR_BATCH_SIZE = 40;
const TOPIC_BATCH_SIZE = 20;
const LISTENING_BATCH_SIZE = 3;
const READING_BATCH_SIZE = 3;
const CACHE_FILE = path.join(__dirname, 'data', 'persistent_cache.json');

// Helper to save cache to disk
const saveCache = () => {
    try {
        const cacheData = {
            topicCache,
            grammarCache,
            listeningCache,
            readingCache
        };
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
        // console.log("💾 Cache saved to disk."); // Optional: uncomment for verbose logging
    } catch (error) {
        console.error("Failed to save cache:", error.message);
    }
};

// Helper to load cache from disk
const loadCache = () => {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const data = fs.readFileSync(CACHE_FILE, 'utf8');
            const cacheData = JSON.parse(data);
            
            if (cacheData.topicCache && Array.isArray(cacheData.topicCache)) {
                topicCache = cacheData.topicCache;
            }
            
            if (cacheData.grammarCache) {
                // Ensure all difficulty properties exist to prevent crashes
                if (Array.isArray(cacheData.grammarCache.basic)) grammarCache.basic = cacheData.grammarCache.basic;
                if (Array.isArray(cacheData.grammarCache.intermediate)) grammarCache.intermediate = cacheData.grammarCache.intermediate;
                if (Array.isArray(cacheData.grammarCache.advanced)) grammarCache.advanced = cacheData.grammarCache.advanced;
            }

            if (cacheData.listeningCache) {
                const safeLoad = (target, source) => {
                    if (source?.basic && Array.isArray(source.basic)) target.basic = source.basic;
                    if (source?.intermediate && Array.isArray(source.intermediate)) target.intermediate = source.intermediate;
                    if (source?.advanced && Array.isArray(source.advanced)) target.advanced = source.advanced;
                };
                if (cacheData.listeningCache.conversation) safeLoad(listeningCache.conversation, cacheData.listeningCache.conversation);
                if (cacheData.listeningCache.story) safeLoad(listeningCache.story, cacheData.listeningCache.story);
            }

            if (cacheData.readingCache) {
                if (Array.isArray(cacheData.readingCache.basic)) readingCache.basic = cacheData.readingCache.basic;
                if (Array.isArray(cacheData.readingCache.intermediate)) readingCache.intermediate = cacheData.readingCache.intermediate;
                if (Array.isArray(cacheData.readingCache.advanced)) readingCache.advanced = cacheData.readingCache.advanced;
            }
            
            console.log(`📂 Loaded cache from disk:`);
            console.log(`   - Topics: ${topicCache.length}`);
            console.log(`   - Grammar: Basic(${grammarCache.basic.length}), Inter(${grammarCache.intermediate.length}), Adv(${grammarCache.advanced.length})`);
            console.log(`   - Listening: ${listeningCache.conversation.intermediate.length} convs`);
            console.log(`   - Reading: ${readingCache.intermediate.length} passages`);
        }
    } catch (error) {
        console.error("Failed to load cache (defaulting to empty):", error.message);
        // Ensure caches are in valid state even on failure
        topicCache = [];
        grammarCache = { basic: [], intermediate: [], advanced: [] };
        listeningCache = { conversation: { basic: [], intermediate: [], advanced: [] }, story: { basic: [], intermediate: [], advanced: [] } };
        readingCache = { basic: [], intermediate: [], advanced: [] };
    }
};

// Load cache on startup
loadCache();

// Helper to generate content using Groq (Gemini logic preserved in comments)
const generateBatch = async (type, count, difficulty = 'intermediate', subtype = 'conversation') => {
    if (!process.env.GROQ_API_KEY) {
        console.error("Skipping generation: No Groq API Key available.");
        return [];
    }

    console.log(`Generating new batch of ${count} ${type} questions (Difficulty: ${difficulty})...`);
    
    // ... [Gemini commented out code preserved] ...

    const generateWithGroq = async () => {
        try {
            let prompt = "";
            if (type === 'grammar') {
                let difficultyDesc = "";
                switch(difficulty) {
                    case 'basic': difficultyDesc = "simple, short sentences suitable for beginners (A1-A2 level)."; break;
                    case 'advanced': difficultyDesc = "complex, sophisticated sentences suitable for advanced learners (C1-C2 level)."; break;
                    case 'intermediate': default: difficultyDesc = "moderately complex sentences suitable for intermediate learners (B1-B2 level)."; break;
                }

                prompt = `Generate ${count} unique, diverse English sentences for grammar practice. They should be ${difficultyDesc} Return ONLY a JSON array of objects with this structure: [{"id": 1, "text": "Sentence here"}, ...] Do not include markdown formatting or any other text.`;
            } else if (type === 'topic') {
                prompt = `Generate ${count} interesting, open-ended discussion topics for English speaking practice. They should cover various themes like technology, society, personal growth, travel, etc. Return ONLY a JSON array of objects with this structure: [{"id": 1, "text": "Topic question here"}, ...] Do not include markdown formatting or any other text.`;
            } else if (type === 'listening') {
                 const isConv = subtype === 'conversation';
                 // Strict length + Detail-rich instructions
                 const lenDesc = "Strictly 120-160 words (approx 40-60 seconds when spoken/read).";
                 const qDesc = "strictly 6-8 diverse comprehension questions (mix of specific details and general understanding)";
                 
                 if (isConv) {
                    prompt = `Generate ${count} diverse, detail-rich English conversation scripts for listening practice.
                    
                    REQUIREMENTS:
                    - Length: ${lenDesc} DO NOT make it shorter than 120 words.
                    - Difficulty: ${difficulty} (CEFR B1-B2).
                    - Content: Include specific details (names, times, places, numbers, prices) to make the comprehension questions meaningful.
                    - Format: A natural dialogue between 2-3 people.
                    - Questions: ${qDesc}.
        
                    Return ONLY a valid JSON ARRAY of objects. Each object must have this structure:
                    {
                        "type": "conversation",
                        "title": "Creative Title Here",
                        "script": [
                            { "speaker": "Name", "text": "Line of dialogue" },
                            ...
                        ],
                        "questions": [
                            { "id": 1, "question": "Q?", "options": ["A","B","C","D"], "answer": "A", "explanation": "Why" }
                        ]
                    }
                    Do not use markdown formatting.`;
                 } else {
                     prompt = `Generate ${count} short, interesting English stories or articles for reading/listening practice.
                    
                    REQUIREMENTS:
                    - Length: ${lenDesc} DO NOT make it shorter than 120 words.
                    - Difficulty: ${difficulty} (CEFR B1-B2).
                    - Content: Include specific details (dates, sequence of events, descriptive attributes) to support detailed questions.
                    - Questions: ${qDesc}.
        
                    Return ONLY a valid JSON ARRAY of objects. Each object must have this structure:
                    {
                        "type": "story",
                        "title": "Topic Title",
                        "content": "Full story text...",
                        "questions": [
                            { "id": 1, "question": "Q?", "options": ["A","B","C","D"], "answer": "A", "explanation": "Why" }
                        ]
                    }
                    Do not include markdown.`;
                 }
            } else if (type === 'reading') {
                prompt = `Generate ${count} interesting, detailed English comprehension passages.
                
                REQUIREMENTS:
                - Length: Strictly 350-400 words per passage.
                - Difficulty: ${difficulty} (CEFR B1-C1).
                - Content: Engaging articles or stories on varied topics (science, culture, history, fiction).
                - Questions: Strictly 6-8 multiple-choice or short-answer comprehension questions per passage.
                
                Return ONLY a valid JSON ARRAY of objects. Each object must have this structure:
                {
                    "type": "reading",
                    "title": "Passage Title",
                    "content": "Full text of the passage (350-400 words)...",
                    "questions": [
                        { "id": 1, "question": "Q?", "options": ["A","B","C","D"], "answer": "A", "explanation": "Why" }
                    ]
                }
                Do not include markdown formatting.`;
            }

            const text = await callGroq(prompt, "You are a professional English content developer. Always return valid, minified JSON only.");
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            // Robust extraction for arrays
            const firstBracket = jsonStr.indexOf('[');
            const lastBracket = jsonStr.lastIndexOf(']');
            let cleanJson = jsonStr;
            if (firstBracket !== -1 && lastBracket !== -1) {
                cleanJson = jsonStr.substring(firstBracket, lastBracket + 1);
            }
            
            return JSON.parse(cleanJson);
        } catch (error) {
            console.error(`Error generating ${type} batch:`, error.message);
            return [];
        }
    };

    return await generateWithGroq();
};

// Routes
app.get('/api/practice/questions/topic', async (req, res) => {
    if (topicCache.length === 0) {
        const newBatch = await generateBatch('topic', TOPIC_BATCH_SIZE);
        if (newBatch.length > 0) {
            topicCache = newBatch;
            saveCache(); // Save after generating
            console.log(`✅ Generated ${newBatch.length} NEW topics from API`);
        } else {
            // Fallback to local file if generation fails
            topicCache = readData('topics.json');
            console.log(`⚠️  Using ${topicCache.length} fallback topics from JSON file`);
        }
    }
    
    const question = topicCache.shift(); // Get and remove the first item
    saveCache(); // Save after consuming
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
            saveCache(); // Save after generating
            console.log(`✅ Generated ${newBatch.length} NEW ${difficulty} grammar sentences from API`);
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
    saveCache(); // Save after consuming
    res.json(question);

    // Trigger background pre-fetch for ALL difficulties if they are running low
    prefetchGrammar();
});

// Background pre-fetcher
const prefetchGrammar = async () => {
    const difficulties = ['basic', 'intermediate', 'advanced'];
    let changed = false;
    
    for (const diff of difficulties) {
        if (grammarCache[diff].length < 10) { // Threshold to refill
            console.log(`🔄 Background pre-fetching for ${diff}...`);
            // Run in background without awaiting
            generateBatch('grammar', GRAMMAR_BATCH_SIZE, diff).then(newBatch => {
                if (newBatch.length > 0) {
                    grammarCache[diff] = [...grammarCache[diff], ...newBatch];
                    saveCache(); // Save after background refill
                    console.log(`✅ Background refill complete: ${newBatch.length} new ${diff} sentences.`);
                }
            }).catch(err => console.error(`Background fetch failed for ${diff}:`, err.message));
        }
    }
};

// Initial pre-fetch on server start
setTimeout(prefetchGrammar, 5000); // Wait 5s after start to begin pre-fetching

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
    
    saveCache(); // Save cleared state
    
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

// General AI Bot Endpoint
app.post('/api/bot/chat', async (req, res) => {
    const { history, userResponse } = req.body;
    
    // Use the Groq Key
    if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ error: 'Server misconfigured: Missing Groq API Key' });
    }

    try {
        let prompt = `
You are LAGUA AI, a smart, friendly, and human-like AI assistant designed for language learning and general knowledge.

ROLE:
You act exactly like a general-purpose AI (similar to ChatGPT) with a strong focus on language learning.

WHAT USERS CAN ASK:
- Grammar explanations
- Sentence corrections
- Vocabulary questions
- Language translation
- Daily-life questions
- Academic questions
- Mathematical problems
- Social, technical, or random questions on ANY topic

RESPONSE RULES:
- Answer ALL types of questions naturally and accurately.
- USE MARKDOWN FOR READABILITY:
  - Use **bold text** for key terms or emphasis.
  - Use bullet points (*) or numbered lists (1.) for steps and lists.
  - Use code blocks (\x60\x60\x60) for code or technical syntax.
  - Use clear line breaks between paragraphs.
- For grammar/language questions:
  - Break explanations into clear sections: **Explanation**, **Correction**, **Examples**.
  - Use a list format for step-by-step guides.
- For non-language questions:
  - Answer clearly with structured paragraphs and headers where appropriate.

TONE & STYLE:
- Friendly, Calm, Supportive, Human-like.
- Never judgmental.
- FOR SIMPLE QUESTIONS: Keep responses concise (2-4 sentences).
- FOR COMPLEX EXPLANATIONS: Use structured lists and sections to ensure the user isn't overwhelmed by a wall of text.

CONVERSATION HISTORY:
`;
        // Append history
        (history || []).forEach(msg => {
            prompt += `${msg.role === 'ai' ? 'Lagua' : 'User'}: ${msg.text}\n`;
        });

        if (userResponse) {
            prompt += `User: ${userResponse}\n`;
        } else if (req.body.start) {
            prompt += `
SYSTEM INSTRUCTION: This is the start of the conversation.
Generate a friendly, brief greeting welcoming the user to LanguaBot.
`;
        }

        prompt += `Lagua:`;

        /*
        // Gemini Implementation (Preserved in comments)
        let responseText;
        try {
            responseText = await callGemini("gemini-2.5-flash", prompt, INTERVIEW_API_KEY);
        } catch (error) {
            console.warn("⚠️ Bot chat failed with Flash, falling back to Pro...");
            responseText = await callGemini("gemini-2.5-pro", prompt, INTERVIEW_API_KEY);
        }
        */

        let responseText = await callGroq(prompt, "You are LAGUA AI, a smart, friendly, and human-like AI assistant designed for language learning and general knowledge.");
        
        const cleanResponse = responseText.replace(/Lagua:/gi, '').trim();

        res.json({ 
            text: cleanResponse,
            type: 'bot'
        });

    } catch (error) {
        console.error('Error in bot chat:', error);
        res.status(500).json({ error: 'Failed to generate response' });
    }
});

// Professional Interview Endpoint
app.post('/api/interview/chat', async (req, res) => {
    const { history, userResponse, interviewType } = req.body;
    

    try {
        // Map interview type to context
        const interviewContextMap = {
            'technical': 'Technical Interview - Focus ONLY on: coding skills, algorithms, data structures, system design, debugging, technology stack knowledge, architecture decisions, scalability, performance optimization, and technical problem-solving. Ask them to explain technical concepts, write pseudocode, or discuss technical trade-offs. DO NOT ask about personality, cultural fit, or soft skills.',
            
            'hr': 'HR Interview - Focus ONLY on: personality, cultural fit, why they want this job, why they want to work for this company, career goals, work-life balance, salary expectations, company knowledge, strengths/weaknesses, teamwork, communication style, handling workplace conflicts, and how they handle workplace situations. DO NOT ask about technical skills, job-specific tasks, or how they would perform the actual work.',
            
            'behavioral': 'Behavioral Interview - Focus ONLY on: past experiences using the STAR method (Situation, Task, Action, Result). Ask questions like "Tell me about a time when...", "Describe a situation where...", "Give me an example of...". Focus on how they handled challenges, conflicts, leadership, teamwork, failure, and difficult decisions in PAST roles. DO NOT ask hypothetical questions or technical questions.',
            
            'mixed': 'Mixed Interview - Combine ALL types: Start with HR questions (why this company, career goals), then move to behavioral questions (past experiences with STAR method), and finally technical questions (coding, system design). Create a well-rounded interview covering personality, experience, and technical skills.',
            
            'domain-specific': 'Domain-Specific Interview - Focus ONLY on: specialized knowledge and expertise in the candidate\'s specific field (e.g., healthcare for medical roles, finance for banking, education for teaching, etc.). Ask deep, field-specific questions that test their domain knowledge, industry trends, regulations, best practices, and specialized terminology. Tailor questions to their exact domain.'
        };

        const context = interviewContextMap[interviewType] || interviewContextMap['hr'];
        
        const historyArray = Array.isArray(history) ? history : [];
        const recentHistory = historyArray.slice(-10);

        // Construct a robust, natural interviewer prompt.
        let prompt = `
You are a real human interviewer with 15+ years of hiring experience in Indian and global companies.
You are professional, calm, specific, and naturally conversational.

INTERVIEW TYPE & CONTEXT:
${context}

OBJECTIVE:
Run a realistic interview that feels human, while still evaluating the candidate rigorously.

STRICT BEHAVIOR RULES:
1. One turn = one main question (unless the candidate asked you something first).
2. Keep most replies between 20 and 55 words.
3. Avoid robotic templates and repeated praise. Do NOT keep saying "Great answer" in every turn.
4. Always anchor follow-ups to candidate details: tools, metrics, decisions, constraints, ownership, timeline.
5. If answer is vague, ask for specifics immediately (impact, numbers, trade-offs, what they personally did).
6. If answer is strong, do one sharp drill-down question before moving to a new topic.
7. Ask practical, real interview questions. Prefer "how/why/what changed" over generic theory prompts.
8. If candidate asks for clarification/help, answer briefly first, then continue interview naturally.
9. No markdown, no bullets, no labels, no role prefixes. Spoken plain text only.
10. Do not produce long speeches; keep it interactive and dynamic.

NATURAL HUMAN STYLE:
- Use light acknowledgements occasionally ("I see", "Understood", "Got it"), not in every turn.
- Vary question phrasing and rhythm.
- Sound like a thoughtful interviewer, not a coaching bot.
- Keep pressure realistic but respectful.

OPENING LOGIC:
- On interview start: brief greeting + one comfortable opening question.
- Do not ask multiple questions in first turn.

EVALUATION FOCUS (INTERNALLY):
Assess clarity, ownership, problem solving, communication, and depth.

RECENT CONVERSATION (most recent last):
`;

        // Append only recent history to reduce repetitive, stale patterns.
        recentHistory.forEach(msg => {
            prompt += `${msg.role === 'ai' ? 'Interviewer' : 'Candidate'}: ${msg.text}\n`;
        });

        // Append current user response if it exists
        if (userResponse) {
            prompt += `Candidate: ${userResponse}\n`;
        } else if (req.body.start) {
            prompt += `
SYSTEM INSTRUCTION: This is the START of the interview. 
Generate a warm, friendly, and professional opening greeting for a ${interviewType} interview.
Do NOT dive straight into deep or complex questions.
Start with a simple, welcoming icebreaker or ask the candidate to briefly introduce themselves in a relaxed manner.
Make the candidate feel comfortable before moving to harder questions.
DO NOT say "Candidate:" or "Interviewer:" in your output.
`;
        }

        prompt += `Interviewer:`;

        /*
        // Gemini Implementation (Preserved in comments)
        let responseText;
        try {
            responseText = await callGemini("gemini-2.5-flash", prompt, INTERVIEW_API_KEY);
        } catch (error) {
            console.warn("⚠️ Interview chat failed with Flash, falling back to Pro...");
            responseText = await callGemini("gemini-2.5-pro", prompt, INTERVIEW_API_KEY);
        }
        */

        let responseText = await callGroq(
            prompt,
            "You are a realistic human interviewer. Be concise, contextual, and natural in spoken interview dialogue."
        );
        
        // Clean up response
        const cleanResponse = responseText
            .replace(/Interviewer:/gi, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/```[\s\S]*?```/g, '')
            .replace(/^[\-\*\d\)\.\s]+/gm, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        res.json({ 
            text: cleanResponse,
            interviewType: interviewType
        });

    } catch (error) {
        console.error('Error in interview chat:', error);
        res.status(500).json({ error: 'Failed to generate response' });
    }
});

// Grammar metrics calculation function
function calculateGrammarMetrics(targetText, spokenText, duration, fillerWords, repeatingWords) {
    // Helper function to clean and normalize text
    const cleanText = (text) => text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    
    const targetWords = cleanText(targetText).split(' ').filter(w => w);
    const spokenWords = cleanText(spokenText).split(' ').filter(w => w);
    
    // 1. Accuracy Score (Levenshtein Distance)
    // This handles insertions ("the work"), deletions, and substitutions gracefully
    const levenshteinDistance = (a, b) => {
        const matrix = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        Math.min(
                            matrix[i][j - 1] + 1, // insertion
                            matrix[i - 1][j] + 1 // deletion
                        )
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    };

    // Calculate distance based on CHARACTERS for precision, or WORDS for speed/tolerance
    // Using WORDS is better for grammar practice to avoid penalizing minor spelling differences if STT is imperfect
    // But standard Levenshtein is usually char-based. Let's use a simplified Word-based Levenshtein.
    
    const wordLevenshtein = (arr1, arr2) => {
        const track = Array(arr2.length + 1).fill(null).map(() =>
        Array(arr1.length + 1).fill(null));
        for (let i = 0; i <= arr1.length; i += 1) {
            track[0][i] = i;
        }
        for (let j = 0; j <= arr2.length; j += 1) {
            track[j][0] = j;
        }
        for (let j = 1; j <= arr2.length; j += 1) {
            for (let i = 1; i <= arr1.length; i += 1) {
                const indicator = arr1[i - 1] === arr2[j - 1] ? 0 : 1;
                track[j][i] = Math.min(
                    track[j][i - 1] + 1, // deletion
                    track[j - 1][i] + 1, // insertion
                    track[j - 1][i - 1] + indicator // substitution
                );
            }
        }
        return track[arr2.length][arr1.length];
    };

    const distance = wordLevenshtein(targetWords, spokenWords);
    const maxLength = Math.max(targetWords.length, spokenWords.length);
    const accuracyScore = maxLength > 0 ? Math.round((1 - distance / maxLength) * 100) : 0;
    
    // Correct words count (approximate for display)
    const correctWords = Math.max(0, targetWords.length - distance);
    
    // 2. Fluency Rating (100 - penalties for fillers and repetitions)
    const fillerPenalty = fillerWords.length * 5;
    const repeatPenalty = repeatingWords.length * 3;
    const fluencyRating = Math.max(0, Math.min(100, 100 - fillerPenalty - repeatPenalty));
    
    // 3. Pronunciation Score (estimated - placeholder for now)
    // In a real implementation, this would compare browser vs Whisper transcripts
    // For now, we estimate based on accuracy
    const pronunciationScore = Math.min(100, accuracyScore + 10);
    
    // 4. Speed Score (WPM - Words Per Minute)
    const wordCount = spokenWords.length;
    const minutes = duration / 60;
    const wpm = minutes > 0 ? Math.round(wordCount / minutes) : 0;
    
    // Ideal WPM for English: 120-150
    // Score is 100 if within range, decreases as you move away
    let speedScore = 100;
    if (wpm < 120) {
        speedScore = Math.max(0, Math.round((wpm / 120) * 100));
    } else if (wpm > 150) {
        speedScore = Math.max(0, Math.round(100 - ((wpm - 150) / 2)));
    }
    
    return {
        accuracyScore,
        fluencyRating,
        pronunciationScore,
        speedScore,
        wpm,
        details: {
            correctWords,
            totalWords: targetWords.length,
            spokenWords: wordCount,
            fillerCount: fillerWords.length,
            repeatCount: repeatingWords.length,
            duration
        }
    };
}

// Mock submission endpoint - in a real app this would save to DB
// Here we just return some analysis

// Practice Submission Endpoint - Now Saves to DB
app.post('/api/practice/submit', async (req, res) => {
    const { type, transcript, duration, fillerWords, repeatingWords, wordCount, wpm } = req.body;
    
    // 1. Authenticate User (Manual Check)
    let userId = null;
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.id;
        }
    } catch (err) {
        console.log("Submit: Guest user or invalid token");
    }

    if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ error: 'Server misconfigured: Missing Groq API Key' });
    }

    try {
        let results;

        // Handle Audio/Text Analysis (Grammar, Topic, Interview)
        if (['grammar', 'topic', 'interview', 'speaking'].includes(type)) {
             // Calculate Grammar-specific metrics if practice type is 'grammar'
            let grammarMetrics = null;
            if (type === 'grammar' && req.body.question?.text) {
                 grammarMetrics = calculateGrammarMetrics(
                    req.body.question.text,
                    transcript,
                    duration,
                    fillerWords || [],
                    repeatingWords || []
                );
            }
    
            const prompt = `
            You are an expert English language coach analyzing a spoken practice session. Provide comprehensive feedback in a single response.
            ${type === 'grammar' ? `TARGET SENTENCE TO READ: "${(req.body.question?.text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '')}"\nCRITICAL INSTRUCTION: Since this is a Grammar reading exercise, closely compare the TRANSCRIPT to the TARGET SENTENCE. Any missed words, incorrect tenses, or grammatically misread words MUST be explicitly listed in the "grammarErrors" array. DO NOT flag capitalization or punctuation differences as errors, since the transcript is generated from raw speech.` : ((req.body.question?.text || req.body.topic) ? `TOPIC/QUESTION ASKED: "${req.body.question?.text || req.body.topic}"` : '')}
            TRANSCRIPT: "${type === 'grammar' ? transcript.toLowerCase().replace(/[^a-z0-9\s]/g, '') : transcript}"
            AUDIO METRICS:
            - Duration: ${duration} seconds
            - Total words: ${wordCount || 'N/A'}
            - Speaking speed: ${wpm || 'N/A'} WPM (words per minute)
            - Filler words detected: ${JSON.stringify(fillerWords || [])}
            - Repeated words: ${JSON.stringify(repeatingWords || [])}
            TASK: Analyze the transcript and provide detailed feedback in the following JSON format:
            {
              "grammarErrors": [{ "original": "...", "corrected": "...", "rule": "...", "severity": "..." }],
              "pronunciationTips": ["...", "..."],
              "fluencyScore": 0-100,
              "answerRelevance": 0-100,
              "topicFeedback": "Brief feedback on how well they answered the topic/question",
              "fluencyBreakdown": { "grammar": 0-100, "vocabulary": 0-100, "coherence": 0-100, "speed": 0-100, "fillerWordImpact": 0-100 },
              "vocabularyLevel": "beginner/intermediate/advanced",
              "strengths": ["..."],
              "improvements": ["..."],
              "overallFeedback": "..."
            }
            FORMATTING RULES:
            - Use **Markdown** in "overallFeedback" and "pronunciationTips" for better readability.
            - Use **bolding** for emphasis and *bullet points* for lists within these strings.
            - Ensure "overallFeedback" is structured with clear paragraphs and sections if long.
            GUIDELINES: Return ONLY valid JSON, no markdown code block wrapping unless requested.
            `;
    
            /*
            // Gemini Implementation (Preserved in comments)
            let text;
            try {
                text = await callGemini("gemini-2.5-flash", prompt);
            } catch (error) {
                console.warn("⚠️ Feedback failed with Flash, falling back to Pro...");
                text = await callGemini("gemini-2.5-pro", prompt);
            }
            */

            let text = await callGroq(prompt, "You are an expert English language coach analyzing a spoken practice session. Always return valid, minified JSON only. Do not use unescaped newlines in strings.");
            let jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            
            // Robust extraction
            const startIndex = jsonStr.indexOf('{');
            const endIndex = jsonStr.lastIndexOf('}');
            if (startIndex !== -1 && endIndex !== -1) {
                jsonStr = jsonStr.substring(startIndex, endIndex + 1);
            }

            let analysis;
            try {
                analysis = JSON.parse(jsonStr);
            } catch (parseError) {
                console.warn("Initial JSON parse failed, attempting to sanitize control characters...");
                // Fallback: Remove newlines and tabs to fix "Bad control character"
                // This makes the JSON minified (valid) and fixes unescaped chars in strings (valid, formats lost)
                const sanitizedStr = jsonStr.replace(/[\n\r\t]/g, ' ');
                try {
                    analysis = JSON.parse(sanitizedStr);
                } catch (retryError) {
                    console.error("Failed to parse JSON even after sanitization:", retryError);
                    console.error("Problematic JSON string:", jsonStr);
                    throw retryError; // Re-throw to be caught by main handler
                }
            }
    
            results = {
                ...analysis,
                overallScore: analysis.fluencyScore, // Use fluencyScore as main score
                grammarAccuracy: analysis.fluencyBreakdown.grammar,
                fluency: analysis.fluencyBreakdown.speed,
                coherence: analysis.fluencyBreakdown.coherence,
                vocabulary: analysis.fluencyBreakdown.vocabulary,
                answerRelevance: analysis.answerRelevance !== undefined ? analysis.answerRelevance : null,
                topicFeedback: analysis.topicFeedback || null,
                message: analysis.overallFeedback,
                createdAt: new Date(),
                ...(grammarMetrics && { grammarMetrics })
            };
        } 
        // Handle Quiz-based Practice (Listening, Reading)
        else if (['listening', 'reading'].includes(type)) {
            const { score, totalQuestions, topic } = req.body;
            const percentage = Math.round((score / totalQuestions) * 100);
            
            results = {
                overallScore: percentage, // Direct score from quiz
                message: `You answered ${score} out of ${totalQuestions} questions correctly. Keep practicing to improve comprehension!`,
                createdAt: new Date(),
                details: req.body // Save full details
            };
        } else {
             return res.status(400).json({ error: 'Invalid practice type' });
        }

        // 2. Save to MongoDB if User is Authenticated and saveToDB is not explicitly false
        if (userId && req.body.saveToDB !== false) {
            try {
                const session = new PracticeSession({
                    user: userId,
                    type: type,
                    topic: req.body.topic || req.body.question?.text || 'Practice Session',
                    score: results.overallScore,
                    duration: duration || 0,
                    details: {
                        ...results,
                        transcript,
                        grammarMetrics: results.grammarMetrics
                    }
                });
                await session.save();
                console.log(`✅ Practice Session (${type}) saved for user ${userId}`);
            } catch (dbError) {
                console.error("❌ Failed to save session to DB:", dbError.message);
            }
        }

        res.json(results);

    } catch (error) {
        console.error('Error generating feedback:', error);
        res.status(500).json({ error: 'Failed to generate feedback' });
    }
});

// Save complete session explicitly
app.post('/api/practice/save-session', async (req, res) => {
    const { type, topic, score, duration, details } = req.body;
    
    let userId = null;
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.id;
        }
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (userId) {
        try {
            const session = new PracticeSession({
                user: userId,
                type,
                topic,
                score,
                duration: duration || 0,
                details
            });
            await session.save();
            console.log(`✅ Bulk Practice Session (${type}) saved for user ${userId}`);
            return res.json({ success: true, id: session._id });
        } catch (dbError) {
            console.error("❌ Failed to save bulk session to DB:", dbError.message);
            return res.status(500).json({ error: 'Failed to save to database' });
        }
    }
    
    res.json({ success: true, message: 'Guest session complete' });
});

// Listening Practice Generation Endpoint
app.post('/api/listening/generate', async (req, res) => {
    const { type = 'conversation', difficulty = 'intermediate', topic } = req.body;
    
    // Validate inputs
    if (!['conversation', 'story'].includes(type)) {
        return res.status(400).json({ error: "Invalid type. Use 'conversation' or 'story'." });
    }

    if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ error: 'Server misconfigured: Missing Groq API Key' });
    }

    try {
        // 1. Check Cache (if no specific topic requested)
        if (!topic && listeningCache[type] && listeningCache[type][difficulty] && listeningCache[type][difficulty].length > 0) {
            const question = listeningCache[type][difficulty].shift();
            saveCache();
            console.log(`✅ Serving ${type} (${difficulty}) from CACHE.`);
            return res.json(question);
        }

        // 2. Generate New Batch (if cache empty or specific topic)
        // If specific topic, we only generate 1. If generic, we generate batch of 3.
        const count = topic ? 1 : LISTENING_BATCH_SIZE;
        console.log(`🎧 Generating listening batch (${count}) for ${type}...`);
        
        const newBatch = await generateBatch('listening', count, difficulty, type);
        
        if (newBatch.length > 0) {
            if (!topic) {
                // Save to cache
                const first = newBatch.shift();
                listeningCache[type][difficulty] = [...listeningCache[type][difficulty], ...newBatch];
                saveCache();
                console.log(`✅ Cached ${newBatch.length} extra ${type} items.`);
                return res.json(first);
            } else {
                // Return immediate result for specific topic
                return res.json(newBatch[0]);
            }
        } else {
             throw new Error("Failed to generate valid content.");
        }

    } catch (error) {
        console.error('🔴 Error generating listening content:', error.message);
        res.status(500).json({ error: error.message || 'Failed to generate content' });
    }
});

app.post('/api/reading/generate', async (req, res) => {
    const { difficulty = 'intermediate', topic } = req.body;
    const type = 'reading'; // Fixed type for this endpoint

    if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ error: 'Server misconfigured: Missing Groq API Key' });
    }

    try {
        // 1. Check Cache
        if (!topic && readingCache[difficulty] && readingCache[difficulty].length > 0) {
            const question = readingCache[difficulty].shift();
            saveCache();
            console.log(`✅ Serving reading passage (${difficulty}) from CACHE.`);
            return res.json(question);
        }

        // 2. Generate New Batch
        const count = topic ? 1 : READING_BATCH_SIZE;
        console.log(`📖 Generating reading batch (${count})...`);
        
        const newBatch = await generateBatch('reading', count, difficulty);
        
        if (newBatch.length > 0) {
            if (!topic) {
                // Save to cache
                const first = newBatch.shift();
                readingCache[difficulty] = [...readingCache[difficulty], ...newBatch];
                saveCache();
                console.log(`✅ Cached ${newBatch.length} extra reading items.`);
                return res.json(first);
            } else {
                return res.json(newBatch[0]);
            }
        } else {
             throw new Error("Failed to generate valid reading content.");
        }

    } catch (error) {
        console.error('🔴 Error generating reading content:', error.message);
        res.status(500).json({ error: error.message || 'Failed to generate content' });
    }
});

// Practice History Endpoint
app.get('/api/practice/history', async (req, res) => {
    try {
        // 1. Authenticate User
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        // 2. Fetch Sessions (exclude old bot-mode entries if they were saved as interview)
        const sessions = await PracticeSession.find({
            user: userId,
            topic: { $not: /Bot Mode/i }
        })
            .sort({ createdAt: -1 })
            .limit(50); // Limit to last 50 sessions

        // 3. Transform Data for Frontend
        const history = sessions.map(session => ({
            id: session._id,
            type: session.type === 'topic' ? 'Topic Practice' : 
                  session.type === 'grammar' ? 'Grammar Practice' :
                  session.type === 'interview' ? 'AI Interviewer' :
                  session.type === 'listening' ? 'Listening Practice' :
                  'AI Interviewer',
            topic: session.topic,
            score: session.score,
            date: session.createdAt,
            duration: session.duration
        }));

        res.json(history);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

app.get('/api/vocabulary', async (req, res) => {
    try {
        const userId = getUserIdFromAuthHeader(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const words = await VocabularyWord.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(200);

        res.json(words.map(item => ({
            id: item._id,
            word: item.word,
            meaning: item.meaning,
            examples: Array.isArray(item.examples) ? item.examples.slice(0, 2) : [],
            source: item.source,
            date: item.createdAt
        })));
    } catch (error) {
        console.error('Error fetching vocabulary:', error);
        res.status(500).json({ error: 'Failed to fetch vocabulary' });
    }
});

app.post('/api/vocabulary/save-from-grammar', async (req, res) => {
    try {
        const userId = getUserIdFromAuthHeader(req);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const inputWords = Array.isArray(req.body.words) ? req.body.words : [];
        const cleanedWords = [...new Set(
            inputWords
                .map(w => (typeof w === 'string' ? w.trim().toLowerCase() : ''))
                .filter(Boolean)
        )].slice(0, 20);

        if (cleanedWords.length === 0) {
            return res.status(400).json({ error: 'No words provided' });
        }

        const existing = await VocabularyWord.find({
            user: userId,
            word: { $in: cleanedWords }
        }).select('word');
        const existingSet = new Set(existing.map(item => item.word));
        const wordsToCreate = cleanedWords.filter(word => !existingSet.has(word));

        const created = [];
        for (const word of wordsToCreate) {
            try {
                const details = await generateWordMeaningAndExamples(word);
                const doc = await VocabularyWord.create({
                    user: userId,
                    word,
                    meaning: details.meaning,
                    examples: details.examples,
                    source: 'grammar'
                });
                created.push(doc);
            } catch (err) {
                console.error(`Failed to create vocabulary word "${word}":`, err.message);
            }
        }

        res.json({
            success: true,
            addedCount: created.length,
            skippedCount: cleanedWords.length - created.length,
            words: created.map(item => ({
                id: item._id,
                word: item.word,
                meaning: item.meaning,
                examples: item.examples.slice(0, 2),
                source: item.source,
                date: item.createdAt
            }))
        });
    } catch (error) {
        console.error('Error saving vocabulary:', error);
        res.status(500).json({ error: 'Failed to save vocabulary' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
