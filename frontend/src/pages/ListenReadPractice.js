import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiHeadphones, FiBookOpen, FiPlay, FiPause, FiRefreshCw, FiCheck, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import AuroraBackground from '../components/AuroraBackground';
import '../styles/ListenReadPractice.css';
import { API_BASE_URL } from '../config';

const ListenReadPractice = () => {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState(null);
  const [mode, setMode] = useState('listening'); // 'listening' | 'reading'
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // Progress percentage
  const [currentLine, setCurrentLine] = useState(0); // For conversation tracking
  const [quizAnswers, setQuizAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [voices, setVoices] = useState([]);

  // Refs for audio handling
  const utteranceRef = useRef(null);

  // Load voices and Handle Mode Change
  useEffect(() => {
    const loadVoices = () => {
        const available = window.speechSynthesis.getVoices();
        setVoices(available);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    // Generate content whenever mode changes
    generateContent();
  }, [mode]);

  const generateContent = async () => {
    setLoading(true);
    setContent(null);
    setQuizAnswers({});
    setShowResults(false);
    setProgress(0);
    stopAudio();

    try {
        let url, body;
        
        if (mode === 'reading') {
            url = `${API_BASE_URL}/api/reading/generate`;
            body = { difficulty: 'intermediate' }; // Can be dynamic later
        } else {
            url = `${API_BASE_URL}/api/listening/generate`;
            body = { type: 'conversation', difficulty: 'intermediate' };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server Error: ${response.status}`);
        }
        
        const data = await response.json();
        setContent(data);
    } catch (err) {
        console.error("Content Generation Error:", err);
        toast.error(err.message || "Failed to generate content. Please try again.");
    } finally {
        setLoading(false);
    }
  };

  const playAudio = () => {
    if (!content) return;
    window.speechSynthesis.cancel();
    setProgress(0);
    
    const textToSpeak = content.type === 'conversation' 
        ? content.script.map(l => `${l.speaker} says: ${l.text}`).join('. ')
        : content.content;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.voice = voices.find(v => v.lang === 'en-US') || voices[0];
    utterance.rate = 0.9; // Slightly slower for listening practice
    
    utterance.onstart = () => setPlaying(true);
    utterance.onend = () => {
        setPlaying(false);
        setProgress(100);
    };
    utterance.onerror = () => setPlaying(false);
    
    // Track progress
    utterance.onboundary = (event) => {
        // charIndex is the current character position being spoken
        // textToSpeak.length is total length
        const percent = (event.charIndex / textToSpeak.length) * 100;
        setProgress(Math.min(100, percent));
    };
    
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopAudio = () => {
    window.speechSynthesis.cancel();
    setPlaying(false);
    setProgress(0);
  };

  const togglePlay = () => {
    if (playing) {
        stopAudio();
    } else {
        playAudio();
    }
  };

  const handleAnswer = (questionId, option) => {
    if (showResults) return;
    setQuizAnswers(prev => ({
        ...prev,
        [questionId]: option
    }));
  };

  const submitQuiz = async () => {
    setShowResults(true);
    // Calculate score
    let correct = 0;
    content.questions.forEach(q => {
        if (quizAnswers[q.id] === q.answer) correct++;
    });
    
    // Save to Backend
    try {
        const response = await fetch(`${API_BASE_URL}/api/practice/submit`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                type: mode, // Sends 'listening' or 'reading' directly
                topic: content.title,
                score: correct,
                totalQuestions: content.questions.length,
                duration: 0 // Could track time spent
            })
        });
        
        // Save to Local History (for immediate UI update if needed)
        const history = JSON.parse(localStorage.getItem('practiceHistory') || '[]');
        history.unshift({
            id: Date.now(),
            type: mode === 'listening' ? 'Listen & Read (Listening)' : 'Listen & Read (Reading)',
            topic: content.title,
            score: Math.round((correct / content.questions.length) * 100),
            date: new Date().toISOString()
        });
        localStorage.setItem('practiceHistory', JSON.stringify(history));
        
    } catch (err) {
        console.error("Failed to save progress:", err);
    }

    toast.success(`You got ${correct}/${content.questions.length} correct!`);
  };

  return (
    <AuroraBackground className="listening-page">
      <div className="container listening-container">
        
        {/* Header */}
        <motion.div 
            className="listening-header"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <h1 className="gradient-text">Listen & Read</h1>
            <p>Listen, comprehend, and master native conversations.</p>

            <div className="mode-switch">
                <button 
                    className={`mode-btn ${mode === 'listening' ? 'active' : ''}`}
                    onClick={() => setMode('listening')}
                >
                    <FiHeadphones /> Listening Mode
                </button>
                <button 
                    className={`mode-btn ${mode === 'reading' ? 'active' : ''}`}
                    onClick={() => setMode('reading')}
                >
                    <FiBookOpen /> Reading Mode
                </button>
            </div>
        </motion.div>

        {loading ? (
            <div className="loading-state">
                <div className="spinner"></div>
                <p>Generating unique lesson...</p>
            </div>
        ) : content ? (
            <div className="content-grid">
                
                {/* Main Content Area (Player or Text) */}
                <motion.div 
                    className="media-card glass-card"
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <div className="card-header">
                        <h2>{content.title}</h2>
                        <button className="refresh-btn" onClick={generateContent} title="Generate New">
                            <FiRefreshCw />
                        </button>
                    </div>

                    {mode === 'listening' ? (
                        <div className="audio-player-wrapper">
                            {/* Visualizer Animation */}
                            <div className={`visualizer ${playing ? 'active' : ''}`}>
                                {[...Array(10)].map((_, i) => (
                                    <div key={i} className="bar" style={{ animationDelay: `${i * 0.1}s` }}></div>
                                ))}
                            </div>

                            {/* Progress Bar */}
                            <div className="progress-container">
                                <motion.div 
                                    className="progress-bar" 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ type: 'tween', ease: 'linear', duration: 0.1 }}
                                />
                            </div>
                            
                            <div className="player-controls">
                                <button className="play-btn" onClick={togglePlay}>
                                    {playing ? <FiPause /> : <FiPlay />}
                                </button>
                                <div className="status-text">
                                    {playing ? "Listening..." : "Paused"}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="reading-content">
                            {content.type === 'conversation' ? (
                                <div className="script-view">
                                    {content.script.map((line, idx) => (
                                        <div key={idx} className="script-line">
                                            <strong>{line.speaker}:</strong> {line.text}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="story-view">
                                    {content.content}
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>

                {/* Quiz Section */}
                <motion.div 
                    className="quiz-section"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <h3>Comprehension Check</h3>
                    <div className="questions-list">
                        {content.questions.map((q, idx) => {
                            const isCorrect = quizAnswers[q.id] === q.answer;
                            const isWrong = quizAnswers[q.id] && quizAnswers[q.id] !== q.answer;
                            
                            return (
                                <div key={q.id} className="question-card glass-card">
                                    <h4>{idx + 1}. {q.question}</h4>
                                    <div className="options-grid">
                                        {q.options.map(opt => (
                                            <button
                                                key={opt}
                                                className={`option-btn 
                                                    ${quizAnswers[q.id] === opt ? 'selected' : ''}
                                                    ${showResults && opt === q.answer ? 'correct' : ''}
                                                    ${showResults && quizAnswers[q.id] === opt && opt !== q.answer ? 'wrong' : ''}
                                                `}
                                                onClick={() => handleAnswer(q.id, opt)}
                                                disabled={showResults}
                                            >
                                                {opt}
                                                {showResults && opt === q.answer && <FiCheck className="result-icon" />}
                                                {showResults && quizAnswers[q.id] === opt && opt !== q.answer && <FiX className="result-icon" />}
                                            </button>
                                        ))}
                                    </div>
                                    {showResults && (
                                        <div className="explanation">
                                            <span>💡 {q.explanation}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    
                    {!showResults && (
                        <button 
                            className="neon-button submit-btn"
                            onClick={submitQuiz}
                            disabled={Object.keys(quizAnswers).length < content.questions.length}
                        >
                            Check Answers
                        </button>
                    )}
                </motion.div>
            </div>
        ) : (
            <div className="empty-state glass-card">
                <h3>Ready to Practice?</h3>
                <p>Click the button to generate a unique listening lesson.</p>
                <button className="neon-button" onClick={generateContent}>
                    <FiRefreshCw /> Generate Lesson
                </button>
            </div>
        )}
      </div>
    </AuroraBackground>
  );
};

export default ListenReadPractice;
