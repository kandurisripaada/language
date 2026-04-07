import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { FiArrowLeft, FiAward, FiSettings, FiCheck, FiCpu, FiBookOpen } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import PracticeSession from '../components/PracticeSession';
// SegmentedControl removed (using custom UI now)
import '../styles/Practice.css';
import '../styles/GrammarVariant.css';
import { API_BASE_URL } from '../config';

// Simple Diff View Component
const DiffView = ({ target, spoken }) => {
  if (!target || !spoken || typeof target !== 'string' || typeof spoken !== 'string') return null;
  
  const targetWords = target.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").split(/\s+/);
  const spokenWords = spoken.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").split(/\s+/);
  
  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '16px', marginBottom: '30px', border: '1px solid var(--border-color)' }}>
      <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        🆚 Comparison
      </h3>
      
      <div style={{ marginBottom: '15px' }}>
        <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>TARGET SENTENCE</span>
        <div style={{ fontSize: '1.1rem', letterSpacing: '0.5px' }}>
          {targetWords.map((word, i) => {
            const match = spokenWords[i] === word;
            return (
              <span key={i} style={{ 
                color: match ? 'var(--success)' : 'var(--text-secondary)',
                opacity: match ? 1 : 0.7,
                marginRight: '6px',
                display: 'inline-block'
              }}>
                {word}
              </span>
            );
          })}
        </div>
      </div>

      <div>
        <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>YOU SAID</span>
        <div style={{ fontSize: '1.1rem', letterSpacing: '0.5px' }}>
          {spokenWords.map((word, i) => {
            const match = targetWords[i] === word;
            return (
              <span key={i} style={{ 
                color: match ? 'var(--success)' : 'var(--error)',
                fontWeight: match ? 'normal' : 'bold',
                textDecoration: match ? 'none' : 'underline',
                marginRight: '6px',
                display: 'inline-block'
              }}>
                {word}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const COMMON_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being', 'but', 'by', 'for', 'from',
  'had', 'has', 'have', 'he', 'her', 'hers', 'him', 'his', 'i', 'if', 'in', 'into', 'is',
  'it', 'its', 'me', 'my', 'of', 'on', 'or', 'our', 'ours', 'she', 'so', 'that', 'the',
  'them', 'they', 'this', 'to', 'was', 'we', 'were', 'with', 'you', 'your', 'yours',
  'about', 'after', 'again', 'against', 'almost', 'also', 'always', 'among', 'another',
  'around', 'because', 'before', 'between', 'could', 'every', 'first', 'found', 'from',
  'great', 'group', 'happy', 'house', 'important', 'large', 'learn', 'little', 'might',
  'never', 'other', 'people', 'place', 'point', 'right', 'should', 'small', 'something',
  'still', 'their', 'there', 'these', 'thing', 'think', 'those', 'through', 'today', 'very',
  'under', 'using', 'while', 'where', 'which', 'would', 'write', 'years'
]);

const EXCLUDED_COMPLEX_WORDS = new Set([
  'philosopher', 'philosophers', 'psychologist', 'psychologists'
]);

const COMPLEX_SUFFIXES = [
  'tion', 'sion', 'ment', 'ness', 'ity', 'ship', 'ence', 'ance', 'ology',
  'ative', 'itive', 'ally', 'ically', 'ously', 'ively', 'ential', 'acious'
];

const isComplexWord = (word) => {
  if (!word || COMMON_WORDS.has(word)) return false;
  if (EXCLUDED_COMPLEX_WORDS.has(word)) return false;
  if (!/^[a-z-]+$/.test(word)) return false;
  if (word.length >= 7) return true; // include practical words like "grapple"
  if (word.includes('-') && word.length >= 8) return true;
  return COMPLEX_SUFFIXES.some(suffix => word.endsWith(suffix)) && word.length >= 7;
};

const extractHardWords = (text) => {
  if (!text || typeof text !== 'string') return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(Boolean);

  return words.filter(word => {
    return isComplexWord(word);
  });
};

const safeReadJson = async (response) => {
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch (error) {
    if (raw.trim().startsWith('<')) {
      throw new Error('API returned HTML instead of JSON. Please restart backend and verify API URL.');
    }
    throw new Error('Invalid API response.');
  }
};

const GrammarPractice = () => {
  // Game State: 'setup' | 'active' | 'summary'
  const [gameState, setGameState] = useState('setup');
  
  // Configuration
  const [config, setConfig] = useState({
    level: 'intermediate',
    questionCount: 5,
    gender: 'female',
    accent: 'US' // US, UK, IN
  });

  // Session State
  const [sessionData, setSessionData] = useState({
    currentQuestionIndex: 0,
    results: [], // Array of result objects
    startTime: null
  });

  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState(null); // Result for CURRENT question
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [savedVocabularyWords, setSavedVocabularyWords] = useState([]);
  const [selectedWords, setSelectedWords] = useState([]);
  const [isSavingWords, setIsSavingWords] = useState(false);

  // Computed voice object based on config
  const [selectedVoice, setSelectedVoice] = useState(null);

  useEffect(() => {
    const loadSavedWords = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setSavedVocabularyWords([]);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/vocabulary`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) return;
        const data = await safeReadJson(response);
        if (Array.isArray(data)) {
          setSavedVocabularyWords(data.map(item => (item.word || '').toLowerCase()).filter(Boolean));
        }
      } catch (error) {
        console.error('Failed to load vocabulary words:', error);
      }
    };

    loadSavedWords();
  }, []);

  // Load Voice based on Config
  useEffect(() => {
    if (gameState !== 'setup') {
      const loadVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        // Heuristic mapping
        const genderKeywords = config.gender === 'female' ? ['female', 'google', 'samantha'] : ['male', 'daniel'];
        const langCode = config.accent === 'US' ? 'en-US' : config.accent === 'UK' ? 'en-GB' : 'en-IN';
        
        let bestVoice = voices.find(v => v.lang === langCode && v.name.toLowerCase().includes(config.gender));
        if (!bestVoice) bestVoice = voices.find(v => v.lang === langCode); // Fallback to accent
        if (!bestVoice) bestVoice = voices.find(v => v.lang.includes('en')); // Fallback to English
        
        setSelectedVoice(bestVoice);
        
        // Update Browser STT Language
        // Browser STT usually expects 'en-US', 'en-GB', 'en-IN'
        // Our config.accent is 'US', 'UK', 'IN'
        const sttLangMap = { 'US': 'en-US', 'UK': 'en-GB', 'IN': 'en-IN' };
        const targetLang = sttLangMap[config.accent] || 'en-US';
        // console.log("Setting Grammar STT to:", targetLang);
        import('../services/browserSTTService').then(module => {
           module.default.setLanguage(targetLang);
        });
      };
      loadVoice();
      window.speechSynthesis.onvoiceschanged = loadVoice;
    }
  }, [config, gameState]);

  const startSession = () => {
    setGameState('active');
    setSessionData({
      currentQuestionIndex: 0,
      results: [],
      startTime: Date.now()
    });
    fetchQuestion(config.level);
  };

  const fetchQuestion = async (level) => {
    setLoading(true);
    setCurrentResult(null);
    setSessionKey(prev => prev + 1);
    try {
      const response = await fetch(`${API_BASE_URL}/api/practice/questions/grammar?difficulty=${level}`);
      const data = await response.json();
      setCurrentQuestion(data);
    } catch (error) {
      console.error('Error fetching question:', error);
      toast.error('Using offline fallback.');
      setCurrentQuestion({ id: 999, text: "The quick brown fox jumps over the lazy dog." });
    } finally {
      setLoading(false);
    }
  };

  const handleSessionComplete = async (data) => {
    // Store raw data without analyzing yet
    const rawAnswer = {
      ...data,
      question: currentQuestion,
      timestamp: Date.now()
    };

    setSessionData(prev => ({
      ...prev,
      results: [...prev.results, rawAnswer] // Note: 'results' now holds raw data initially
    }));

    // Auto-advance to next question or finish
    if (sessionData.currentQuestionIndex < config.questionCount - 1) {
      handleNextQuestion();
    } else {
      finishSession([...sessionData.results, rawAnswer]); // Pass complete list including current
    }
  };

  const handleNextQuestion = () => {
      setSessionData(prev => ({
        ...prev,
        currentQuestionIndex: prev.currentQuestionIndex + 1
      }));
      fetchQuestion(config.level);
  };

  const finishSession = async (allRawAnswers) => {
    setGameState('analyzing');
    
    try {
        // Analyze all answers in parallel
        const analyzedResults = await Promise.all(allRawAnswers.map(async (answer) => {
            const wordCount = answer.transcript.trim().split(/\s+/).length;
            const wpm = Math.round(wordCount / (answer.duration / 60)) || 0;

            try {
                const response = await fetch(`${API_BASE_URL}/api/practice/submit`, {
                    method: 'POST',
                    headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ 
                        ...answer, 
                        type: 'grammar',
                        wordCount,
                        wpm,
                        saveToDB: false
                    }),
                });
                const result = await response.json();
                return { ...result, transcript: answer.transcript, question: answer.question };
            } catch (err) {
                console.error("Analysis failed for one item:", err);
                return { ...answer, overallScore: 0, error: true }; // Fallback
            }
        }));

        setSessionData(prev => ({
            ...prev,
            results: analyzedResults // Replace raw with analyzed
        }));
        
        // Save history
        const avgScore = Math.round(analyzedResults.reduce((acc, curr) => acc + (curr.overallScore || 0), 0) / analyzedResults.length);
        const history = JSON.parse(localStorage.getItem('practiceHistory') || '[]');
        history.unshift({
            id: Date.now(),
            type: 'Grammar Practice',
            topic: `${config.level} - ${config.questionCount} Qs`,
            score: avgScore,
            date: new Date().toISOString()
        });
        localStorage.setItem('practiceHistory', JSON.stringify(history));

        // Save complete bulk session to MongoDB
        try {
            await fetch(`${API_BASE_URL}/api/practice/save-session`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ 
                    type: 'grammar',
                    topic: `${config.level.toUpperCase()} - ${config.questionCount} Questions`,
                    score: avgScore,
                    duration: allRawAnswers.reduce((acc, curr) => acc + (curr.duration || 0), 0),
                    details: analyzedResults
                })
            });
        } catch (e) {
            console.error("Failed to save bulk session to DB:", e);
        }

        setGameState('summary');

    } catch (error) {
        console.error("Batch analysis failed:", error);
        toast.error("Failed to analyze session.");
        setGameState('summary'); // Show what we have
    }
  };

  // --- Rendering ---

  // Wizard State
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
      {
          id: 'level',
          icon: <FiCheck />,
          title: "Choose Your Level",
          subtitle: "Select the difficulty that matches your skills",
          configKey: 'level',
          options: [
              { value: 'basic', label: 'Basic', desc: "Start with fundamentals" },
              { value: 'intermediate', label: 'Intermediate', desc: "Build on your knowledge" },
              { value: 'advanced', label: 'Advanced', desc: "Master complex rules" }
          ]
      },
      {
          id: 'questions',
          icon: <FiAward />,
          title: "Session Length",
          subtitle: "How many questions would you like?",
          configKey: 'questionCount',
          options: [
              { value: 5, label: "Quick", desc: "5 questions" },
              { value: 10, label: "Standard", desc: "10 questions" },
              { value: 15, label: "Extended", desc: "15 questions" },
              { value: 'custom', label: "Custom", desc: "Choose 1-20" } // Custom Option
          ]
      },
      {
          id: 'accent',
          icon: <FiCheck />, // Using standard icon as placeholder
          title: "Voice Accent",
          subtitle: "Choose your preferred AI voice",
          configKey: 'accent',
          options: [
              { value: 'US', label: "American", desc: "US English" },
              { value: 'UK', label: "British", desc: "UK English" },
              { value: 'IN', label: "Indian", desc: "Indian English" }
          ]
      },
      {
          id: 'gender',
          icon: <FiCheck />,
          title: "Voice Type",
          subtitle: "Select your preferred voice gender",
          configKey: 'gender',
          options: [
              { value: 'female', label: "Female", desc: "Feminine voice" },
              { value: 'male', label: "Male", desc: "Masculine voice" }
          ]
      }
  ];

  if (gameState === 'setup') {
    const currentStep = steps[activeStep];
    
    // Handler for custom question change
    const handleCustomChange = (e) => {
        setConfig({ ...config, questionCount: parseInt(e.target.value) });
    };

    return (
      <div className="grammar-setup-wrapper">
         {/* Background Orbs */}
         <div className="floating-orb" style={{ width: '400px', height: '400px', background: 'var(--grammar-primary)', top: '-100px', left: '-100px' }} />

         <div className="floating-orb" style={{ width: '200px', height: '200px', background: 'var(--grammar-secondary)', top: '40%', left: '60%', animationDelay: '4s' }} />
         <div className="bg-grid-pattern" />

         <div className="back-link-wrapper">
             <Link to="/" className="back-link">
                 <FiArrowLeft /> Back to Home
             </Link>
         </div>

         <div className="wizard-container">
             {/* Progress Steps */}
             <div className="step-indicator-container">
                 {steps.map((step, idx) => (
                     <button 
                        key={idx}
                        className={`step-indicator-btn ${idx === activeStep ? 'active' : ''} ${idx < activeStep ? 'completed' : ''}`}
                        onClick={() => setActiveStep(idx)}
                     >
                         {idx < activeStep ? <FiCheck /> : idx + 1}
                     </button>
                 ))}
             </div>

             <AnimatePresence mode="wait">
                 <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                 >
                     <div className="wizard-header">
                         <h1 className="wizard-title">{currentStep.title}</h1>
                         <p className="wizard-subtitle">{currentStep.subtitle}</p>
                     </div>

                     <div className={`wizard-grid ${currentStep.options.length === 2 ? 'two-cols' : ''} ${currentStep.options.length === 4 ? 'four-cols' : ''}`}>
                         {currentStep.options.map((opt) => {
                             const isSelected = currentStep.configKey === 'questionCount' 
                                ? (opt.value === 'custom' ? config.questionCount > 15 || (config.questionCount !== 5 && config.questionCount !== 10 && config.questionCount !== 15) : config.questionCount === opt.value)
                                : config[currentStep.configKey] === opt.value;
                             
                             return (
                                 <div 
                                    key={opt.value} 
                                    className={`wizard-option-card ${isSelected ? 'selected' : ''}`}
                                    onClick={() => {
                                        if (opt.value !== 'custom') {
                                            setConfig({ ...config, [currentStep.configKey]: opt.value });
                                        } else {
                                            // Set a default custom value if not already set custom
                                            if (!isSelected) setConfig({ ...config, questionCount: 1 });
                                        }
                                    }}
                                 >
                                     <span className="wizard-option-title">{opt.label}</span>
                                     <span className="wizard-option-desc">{opt.desc}</span>
                                     <div className="check-indicator"><FiCheck /></div>
                                     
                                     {/* Custom Dropdown Logic */}
                                     {opt.value === 'custom' && isSelected && (
                                         <div className="custom-dropdown-container" onClick={(e) => e.stopPropagation()}>
                                             <select 
                                                className="custom-select" 
                                                value={config.questionCount} 
                                                onChange={handleCustomChange}
                                             >
                                                 {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                                                     <option key={num} value={num}>{num} Questions</option>
                                                 ))}
                                             </select>
                                         </div>
                                     )}
                                 </div>
                             );
                         })}
                     </div>
                 </motion.div>
             </AnimatePresence>

             {/* Navigation Actions */}
             <div className="wizard-nav">
                 {activeStep > 0 && (
                     <button className="nav-btn nav-btn-prev" onClick={() => setActiveStep(prev => prev - 1)}>
                         Previous
                     </button>
                 )}
                 
                 {activeStep < steps.length - 1 ? (
                     <button className="nav-btn nav-btn-next" onClick={() => setActiveStep(prev => prev + 1)}>
                         Continue
                     </button>
                 ) : (
                     <button className="nav-btn nav-btn-start" onClick={startSession}>
                         <FiCpu /> Start Practice
                     </button>
                 )}
             </div>
         </div>
      </div>
    );
  }

  // Active Session View
  if (gameState === 'active') {
      return (
        <div className="grammar-page-wrapper" style={{ paddingTop: '40px', paddingBottom: '40px', paddingLeft: '20px', paddingRight: '20px' }}>
          
           {/* Header & Stepper */}
           <div style={{ maxWidth: '1200px', margin: '0 auto 30px auto' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <button onClick={() => setGameState('setup')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--grammar-text-secondary)' }}>
                     <FiArrowLeft /> Exit
                  </button>
                  <div style={{ fontWeight: 'bold', color: 'var(--grammar-accent)' }}>
                      Level: {config.level.toUpperCase()}
                  </div>
              </div>

              {/* Progress Stepper */}
              <div className="progress-stepper">
                  {Array.from({ length: config.questionCount }).map((_, idx) => (
                      <React.Fragment key={idx}>
                          <div className={`step-circle ${idx === sessionData.currentQuestionIndex ? 'active' : ''} ${idx < sessionData.currentQuestionIndex ? 'completed' : ''}`}>
                              {idx < sessionData.currentQuestionIndex ? <FiCheck /> : idx + 1}
                          </div>
                          {idx < config.questionCount - 1 && (
                              <div className={`step-line ${idx < sessionData.currentQuestionIndex ? 'filled' : ''}`} />
                          )}
                      </React.Fragment>
                  ))}
              </div>
           </div>

           {/* Main Practice Area */}
           <AnimatePresence mode="wait">
            {!loading && currentQuestion ? (
                <motion.div
                    key={sessionKey}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                >
                    <PracticeSession 
                        key={sessionKey}
                        practiceType="grammar"
                        variant="grammar"
                        question={currentQuestion}
                        onNewQuestion={() => {}} // Disabled in this mode
                        onSessionComplete={handleSessionComplete}
                        isAnalyzing={isAnalyzing}
                        externalVoice={selectedVoice} // Pass computed voice
                    />
                </motion.div>
            ) : (
                <div style={{ textAlign: 'center', padding: '100px', color: 'var(--grammar-text-secondary)' }}>
                    Loading question...
                </div>
            )}
           </AnimatePresence>

           {/* Feedback & Next Button (Only when result exists) */}
           {/* Feedback Section Removed - Auto-advances now */}
           
           {/* Analyzing Overlay */}
           {gameState === 'analyzing' && (
               <motion.div 
                 initial={{ opacity: 0 }} 
                 animate={{ opacity: 1 }}
                 style={{ 
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                    background: 'rgba(0,0,0,0.8)', zIndex: 100,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                 }}>
                   <FiCpu className="spin" style={{ fontSize: '4rem', color: 'var(--grammar-accent)', marginBottom: '20px' }} />
                   <h2 style={{ color: 'white' }}>Analyzing Full Session...</h2>
                   <p style={{ color: 'var(--grammar-text-secondary)' }}>Processing {config.questionCount} answers</p>
               </motion.div>
           )}
        </div>
      );
  }

  // Summary View
  if (gameState === 'summary') {
      const avgScore = Math.round(sessionData.results.reduce((acc, curr) => acc + (curr.overallScore || 0), 0) / sessionData.results.length);
      const words = [];
      sessionData.results.forEach(result => {
        words.push(...extractHardWords(result.question?.text || ''));
        if (Array.isArray(result.grammarErrors)) {
          result.grammarErrors.forEach(err => {
            words.push(...extractHardWords(err.corrected || ''));
            words.push(...extractHardWords(err.original || ''));
          });
        }
      });

      const seenWords = new Set();
      const suggestedHardWords = words.filter(word => {
        if (seenWords.has(word)) return false;
        if (savedVocabularyWords.includes(word)) return false;
        seenWords.add(word);
        return true;
      }).slice(0, 24);

      const toggleWordSelection = (word) => {
        setSelectedWords(prev =>
          prev.includes(word)
            ? prev.filter(item => item !== word)
            : [...prev, word]
        );
      };

      const saveSelectedWords = async () => {
        if (selectedWords.length === 0) {
          toast.error('Please choose at least one word.');
          return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
          toast.error('Please login to save words to dashboard.');
          return;
        }

        setIsSavingWords(true);
        try {
          const response = await fetch(`${API_BASE_URL}/api/vocabulary/save-from-grammar`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ words: selectedWords })
          });

          const data = await safeReadJson(response);
          if (!response.ok) {
            throw new Error(data.error || 'Failed to save selected words.');
          }

          const addedWords = Array.isArray(data.words) ? data.words.map(item => item.word) : [];
          // Deduplicate by lowercase word so UI never shows duplicates.
          setSavedVocabularyWords(prev => {
            const merged = [...prev, ...addedWords].map(w => (w || '').toLowerCase()).filter(Boolean);
            return Array.from(new Set(merged));
          });
          setSelectedWords([]);
          toast.success(`Saved ${data.addedCount || 0} words to your dashboard.`);
        } catch (error) {
          console.error('Failed to save words:', error);
          toast.error(error.message || 'Failed to save words.');
        } finally {
          setIsSavingWords(false);
        }
      };
      
      return (
         <div className="grammar-page-wrapper" style={{ paddingTop: '40px', paddingBottom: '60px' }}>
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                
                {/* Header Card */}
                <div className="setup-card" style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <FiAward size={64} color="var(--grammar-accent)" style={{ marginBottom: '20px' }} />
                    <h1 style={{ marginBottom: '10px' }}>Session Complete!</h1>
                    <div style={{ fontSize: '4rem', fontWeight: '800', color: 'var(--grammar-accent)', marginBottom: '5px' }}>
                        {avgScore}%
                    </div>
                    <div style={{ marginBottom: '30px', color: 'var(--grammar-text-secondary)' }}>Average Session Score</div>
                    
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                        <button className="start-session-btn" style={{ width: 'auto', padding: '12px 30px', margin: 0 }} onClick={() => setGameState('setup')}>
                            Start New Session
                        </button>
                        <Link to="/dashboard" className="secondary-btn" style={{ 
                            padding: '12px 30px', 
                            borderRadius: '12px', 
                            border: '1px solid var(--grammar-border)',
                            color: 'var(--grammar-text-secondary)',
                            textDecoration: 'none',
                            background: 'transparent'
                        }}>
                            Dashboard
                        </Link>
                    </div>
                </div>

                {/* Detailed Breakdown */}
                <h2 style={{ marginBottom: '20px', paddingLeft: '10px' }}>Detailed Breakdown</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    {sessionData.results.map((result, idx) => (
                        <div key={idx} style={{ 
                            background: 'var(--grammar-card-bg)', 
                            border: '1px solid var(--grammar-border)', 
                            borderRadius: '20px', 
                            padding: '30px',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{ 
                                position: 'absolute', top: 0, left: 0, 
                                background: 'var(--grammar-border)', 
                                padding: '5px 15px', 
                                borderBottomRightRadius: '16px',
                                fontSize: '0.9rem',
                                fontWeight: 'bold',
                                color: 'var(--grammar-text-secondary)'
                            }}>
                                Question {idx + 1}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', marginBottom: '20px' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                    Score: <span style={{ color: result.overallScore > 80 ? 'var(--grammar-success)' : 'var(--grammar-accent)' }}>{result.overallScore}%</span>
                                </div>
                            </div>

                            <DiffView target={result.question?.text} spoken={result.transcript} />

                            {result.grammarErrors?.length > 0 ? (
                                <div style={{ marginTop: '20px', padding: '20px', background: 'rgba(229, 62, 62, 0.05)', borderRadius: '16px', border: '1px solid rgba(229, 62, 62, 0.2)' }}>
                                    <h4 style={{ margin: '0 0 15px 0', color: 'var(--grammar-error)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <FiSettings /> Corrections Needed
                                    </h4>
                                    {result.grammarErrors.map((err, i) => (
                                        <div key={i} style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: i < result.grammarErrors.length - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none' }}>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}>
                                                <span style={{ textDecoration: 'line-through', color: 'var(--grammar-error)', opacity: 0.8 }}>{err.original}</span>
                                                <span style={{ color: 'var(--grammar-text-secondary)' }}>→</span>
                                                <span style={{ fontWeight: 'bold', color: 'var(--grammar-success)' }}>{err.corrected}</span>
                                            </div>
                                            <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: 'var(--grammar-text-secondary)', fontStyle: 'italic' }}>
                                                {err.rule}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(72, 187, 120, 0.1)', borderRadius: '12px', color: 'var(--grammar-success)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <FiCheck /> Perfect! No grammar errors found.
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="setup-card" style={{ marginTop: '40px' }}>
                    <h2 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FiBookOpen /> Save Hard/New Words
                    </h2>
                    <p style={{ color: 'var(--grammar-text-secondary)', marginBottom: '18px' }}>
                        Choose different difficult words from this session and save them to Dashboard vocabulary.
                    </p>

                    {suggestedHardWords.length > 0 ? (
                        <>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
                                {suggestedHardWords.map(word => (
                                    <button
                                        key={word}
                                        onClick={() => toggleWordSelection(word)}
                                        style={{
                                            borderRadius: '999px',
                                            padding: '8px 14px',
                                            border: selectedWords.includes(word)
                                                ? '1px solid var(--grammar-accent)'
                                                : '1px solid var(--grammar-border)',
                                            background: selectedWords.includes(word)
                                                ? 'rgba(59,130,246,0.16)'
                                                : 'transparent',
                                            color: 'var(--grammar-text-primary)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {word}
                                    </button>
                                ))}
                            </div>

                            <button
                                className="start-session-btn"
                                style={{ width: 'auto', margin: 0, opacity: isSavingWords ? 0.7 : 1 }}
                                onClick={saveSelectedWords}
                                disabled={isSavingWords}
                            >
                                {isSavingWords ? 'Saving...' : 'Save Selected Words'}
                            </button>
                        </>
                    ) : (
                        <p style={{ color: 'var(--grammar-text-secondary)', margin: 0 }}>
                            No new difficult words found in this session.
                        </p>
                    )}
                </div>
            </div>
         </div>
      );
  }

  return null;
};

export default GrammarPractice;
