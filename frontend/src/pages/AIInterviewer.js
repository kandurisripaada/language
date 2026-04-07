import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { FiMic, FiSquare, FiPlay, FiCpu, FiUser, FiVolume2, FiVolumeX, FiSettings, FiRotateCcw, FiSliders, FiCopy, FiCheck } from 'react-icons/fi';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import LiquidJarvisAnimation from '../components/LiquidJarvisAnimation';
import AIInterviewSettingsModal from '../components/AIInterviewSettingsModal';
import SegmentedControl from '../components/SegmentedControl'; // Imported
import { useWhisper } from '../contexts/WhisperContext';
import browserSTT from '../services/browserSTTService';
import '../styles/AIInterviewer.css';
import { API_BASE_URL } from '../config';

const AIInterviewer = () => {
  const navigate = useNavigate();
  const location = useLocation(); // Imported
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState(''); // Current live transcript
  const [chatHistory, setChatHistory] = useState([]); // Full conversation
  const [aiState, setAiState] = useState('idle'); // idle, listening, speaking, processing
  // Initialize mode from navigation state if available
  const [aiMode, setAiMode] = useState(location.state?.mode || 'interviewer');
  
  // Settings Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [interviewSettings, setInterviewSettings] = useState({
    voice: 'indian-female',
    type: 'hr'
  });
  
  // Bot Mode Input State
  const [inputMessage, setInputMessage] = useState('');
  const [copiedId, setCopiedId] = useState(null); // Tracking copy success state
  
  // Whisper & Audio Refs
  const { transcribe, status: whisperStatus } = useWhisper();
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const messagesEndRef = useRef(null);
  const sessionStartTimeRef = useRef(null);
  const inputRef = useRef(null); // Ref for auto-focus

  // Global Key Listener for Auto-Focus in Bot Mode
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Only active in Bot Mode
      if (aiMode !== 'bot') return;
      
      // Ignore if user is holding modifier keys (Ctrl, Alt, Meta)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Ignore if focus is already on an input or textarea
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

      // Ignore non-printable keys (like F1-F12, Esc, etc., though simple check is length)
      if (e.key.length !== 1) return;

      // Focus the input
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [aiMode]);
  
  // TTS State
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);

  // Load Settings from localStorage
  useEffect(() => {
    const savedVoice = localStorage.getItem('ai_interview_voice') || 'indian-female';
    const savedType = localStorage.getItem('ai_interview_type') || 'hr';
    const savedSpeed = localStorage.getItem('ai_interview_speed') || 'medium';
    setInterviewSettings({ voice: savedVoice, type: savedType, speed: savedSpeed });
  }, []);

  // Load Voices and apply saved preference
  useEffect(() => {
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      
      // Map voice preference to actual voice
      let preferred = null;
      
      // Helper function for case-insensitive search
      const findVoice = (criteria) => {
        return available.find(v => {
          const nameLower = v.name.toLowerCase();
          const langLower = v.lang.toLowerCase();
          
          if (criteria.name && nameLower.includes(criteria.name.toLowerCase())) {
            if (criteria.lang) {
              return langLower.startsWith(criteria.lang.toLowerCase());
            }
            return true;
          }
          if (criteria.lang && langLower.startsWith(criteria.lang.toLowerCase())) {
            if (criteria.gender) {
              return nameLower.includes(criteria.gender.toLowerCase());
            }
            return true;
          }
          return false;
        });
      };
      
      switch(interviewSettings.voice) {
        case 'uk-english':
          preferred = findVoice({ lang: 'en-GB' }) || 
                      findVoice({ name: 'UK' }) ||
                      findVoice({ name: 'British' });
          break;
          
        case 'us-female':
          // Try multiple strategies to find a female voice
          preferred = available.find(v => v.name.toLowerCase().includes('google us english female')) ||
                      available.find(v => v.name.toLowerCase().includes('female') && v.lang.startsWith('en-US')) ||
                      available.find(v => v.lang.startsWith('en-US') && v.name.toLowerCase().includes('zira')) ||
                      available.find(v => v.lang.startsWith('en-US') && v.name.toLowerCase().includes('susan')) ||
                      available.find(v => v.lang.startsWith('en-US') && !v.name.toLowerCase().includes('male') && !v.name.toLowerCase().includes('david'));
          break;
          
        case 'us-male':
          preferred = available.find(v => v.name.toLowerCase().includes('google us english male')) ||
                      available.find(v => v.name.toLowerCase().includes('male') && v.lang.startsWith('en-US')) ||
                      available.find(v => v.lang.startsWith('en-US') && v.name.toLowerCase().includes('david')) ||
                      available.find(v => v.lang.startsWith('en-US') && v.name.toLowerCase().includes('mark'));
          break;
          
        case 'indian-male':
          preferred = findVoice({ lang: 'en-IN', gender: 'male' }) ||
                      findVoice({ lang: 'en-IN', name: 'male' }) ||
                      available.find(v => v.lang.startsWith('en-IN') && v.name.toLowerCase().includes('male')) ||
                      findVoice({ lang: 'en-IN' });
          break;
          
        case 'indian-female':
          preferred = findVoice({ lang: 'en-IN', gender: 'female' }) ||
                      findVoice({ lang: 'en-IN', name: 'female' }) ||
                      available.find(v => v.lang.startsWith('en-IN') && !v.name.toLowerCase().includes('male')) ||
                      findVoice({ lang: 'en-IN' });
          break;
          
        default:
          preferred = findVoice({ lang: 'en-IN' }) || findVoice({ lang: 'en-US' });
      }
      
      // Final fallback to any English voice
      if (!preferred) {
        preferred = available.find(v => v.lang.startsWith('en')) || available[0];
      }
      
      console.log('Selected voice:', preferred?.name, 'for setting:', interviewSettings.voice);
      
      setVoices(available);
      setSelectedVoice(preferred || available[0]);

      // Update STT Language
      const sttLang = preferred?.lang || 'en-US';
      console.log(`Setting STT Language to: ${sttLang}`); // Debug log
      browserSTT.setLanguage(sttLang);

    };
    
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, [interviewSettings.voice]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, transcript]);

  // Browser STT for Live Preview
  useEffect(() => {
    browserSTT.setCallbacks({
      onTranscript: (final, interim) => {
        if (isRecording) {
            setTranscript(final + (interim ? ' ' + interim : ''));
            setAiState('listening');
        }
      },
      onError: (err) => console.error("Browser STT Error:", err)
    });
  }, [isRecording]);

  // Reset session when mode changes
  useEffect(() => {
    if (isSessionActive) {
        stopSession();
    }
    setChatHistory([]);
  }, [aiMode]);

  const startSession = async () => {
    setIsSessionActive(true);
    setChatHistory([]);
    sessionStartTimeRef.current = Date.now();
    setAiState('processing'); // Show processing state while fetching greeting
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/interview/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                history: [],
                start: true,
                interviewType: aiMode === 'bot' ? 'bot' : interviewSettings.type
            })
        });

        const data = await response.json();
        
        if (data.text) {
            addMessage('ai', data.text);
            if (aiMode !== 'bot') speak(data.text);
        }
    } catch (err) {
        console.error("Failed to start interview:", err);
        toast.error("Failed to start interview. Please try again.");
        setIsSessionActive(false); // Reset if failed
        setAiState('idle');
    }
  };

  const stopSession = async () => {
    setIsSessionActive(false);
    setIsRecording(false);
    stopAudio();
    window.speechSynthesis.cancel();
    setAiState('idle');

    // Save Session to Backend only for interviewer mode (not AI Bot mode)
    if (aiMode !== 'bot' && chatHistory.length > 2) { // Only save if there was actual interaction
        const duration = Math.round((Date.now() - (sessionStartTimeRef.current || Date.now())) / 1000);
        const fullTranscript = chatHistory.map(m => `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.text}`).join('\n');
        
        try {
            await fetch(`${API_BASE_URL}/api/practice/submit`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    type: 'interview', // Use generic interview type for analysis
                    topic: `AI Session (${aiMode === 'bot' ? 'Bot Mode' : interviewSettings.type})`,
                    transcript: fullTranscript,
                    duration: duration,
                    wordCount: fullTranscript.split(/\s+/).length,
                    wpm: 0 // Estimate or leave 0
                })
            });
            toast.success("Session saved to Dashboard!");
        } catch (err) {
            console.error("Failed to save session:", err);
        }
    } else if (aiMode === 'bot') {
        // Bot mode is conversational assistant mode, not a scored practice session.
        toast('AI Bot session is not added to practice scores.', { icon: 'ℹ️' });
    }
  };

  const addMessage = (role, text) => {
    const freshId = Date.now();
    setChatHistory(prev => [...prev, { id: freshId, role, text, timestamp: new Date() }]);
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
        setCopiedId(id);
        toast.success("Copied to clipboard!", { duration: 1500, position: 'bottom-center' });
        setTimeout(() => setCopiedId(null), 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        toast.error("Failed to copy text.");
    });
  };

  const speak = (text) => {
    if (!text) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set voice
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    // Tuned speech values for a more natural interview tone
    const speedMap = {
      'slow': 0.9,      // Slower and clearer
      'medium': 1.0,    // More human-like default pacing
      'fast': 1.15      // Slightly faster but still natural
    };
    utterance.rate = speedMap[interviewSettings.speed] || 1.0;
    
    // Keep pitch neutral for a less robotic, less "synthetic" tone.
    utterance.pitch = 1.0;
    
    // Set volume to maximum for clarity
    utterance.volume = 1.0;
    
    // Ensure proper language setting
    utterance.lang = selectedVoice?.lang || 'en-US';
    
    utterance.onstart = () => {
        setIsSpeaking(true);
        setAiState('speaking');
    };
    
    utterance.onend = () => {
        setIsSpeaking(false);
        setAiState('idle');
    };
    
    utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setIsSpeaking(false);
        setAiState('idle');
    };
    
    // Small delay to ensure previous speech is fully cancelled
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 100);
  };

  const stopAudio = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
    }
    browserSTT.stopRecording();
  };

  const clearTranscript = (e) => {
    e.stopPropagation(); // Prevent bubbling
    setTranscript('');
    browserSTT.restartRecording();
  };

  const handleSendMessage = async (textOverride = null) => {
    const textToSend = textOverride || inputMessage;
    
    // Don't send empty messages unless it's a voice trigger which might be handled differently
    if (!textToSend || (!textToSend.trim() && !textOverride)) return;
    
    if (textToSend.trim().length === 0) return;

    if (!isSessionActive) {
        // Auto-start session if user types
        setIsSessionActive(true);
        sessionStartTimeRef.current = Date.now();
    }

    addMessage('user', textToSend);
    setInputMessage('');
    setIsProcessing(true);
    setAiState('processing');

    try {
        const endpoint = aiMode === 'bot' 
            ? `${API_BASE_URL}/api/bot/chat` 
            : `${API_BASE_URL}/api/interview/chat`;
            
        const payload = {
            history: chatHistory.map(m => ({ role: m.role, text: m.text })),
            userResponse: textToSend,
            interviewType: interviewSettings.type
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.text) {
            addMessage('ai', data.text);
            if (aiMode !== 'bot') speak(data.text);
        }
    } catch (err) {
        console.error("API Error:", err);
        toast.error("Failed to get response from AI.");
        setAiState('idle');
    } finally {
        setIsProcessing(false);
    }
  };

  const handleMicClick = async () => {
    if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setAiState('idle');
        return;
    }

    if (!isRecording) {
      // START RECORDING
      
      // 1. Optimistic UI Updates: Immediate Request
      setIsRecording(true);
      setAiState('listening');
      setTranscript('');

      // 2. Parallel Start: Browser STT (for instant visual feedback)
      browserSTT.startRecording();

      // 3. Parallel Start: High Quality Mic (for Whisper)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (e) => {
            audioChunksRef.current.push(e.data);
        };

        mediaRecorderRef.current.onstop = async () => {
            // Processing logic
            setIsProcessing(true);
            setAiState('processing');
            
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            
            // Wait a bit for browser STT to finalize any pending results
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // 1. Try Whisper first (High Accuracy)
            let finalUserText = "";
            try {
                if (whisperStatus === 'ready') {
                    // Convert to AudioBuffer for Whisper
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
                    const arrayBuffer = await audioBlob.arrayBuffer();
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    const audioData = audioBuffer.getChannelData(0);
                    
                    const result = await transcribe(audioData);
                    finalUserText = result.text || result[0]?.text || "";
                }
            } catch (e) {
                console.error("Whisper failed, falling back to browser transcript", e);
            }

            // 2. Logic to pick the best transcript
            // Get browser transcript from the service directly (more reliable than React state)
            const browserFinalTranscript = browserSTT.getFinalTranscript();
            let transcriptSource = "Whisper";
            const whisperText = (finalUserText || "").trim();
            // Use service's finalTranscript first, fallback to state if needed
            const browserText = (browserFinalTranscript || transcript || "").trim();
            
            // Heuristic: If browser transcript is significantly longer (e.g., 40% more words),
            // it likely captured speech that Whisper missed due to connection or sample issues.
            const whisperWordCount = whisperText.split(/\s+/).filter(w => w.length > 0).length;
            const browserWordCount = browserText.split(/\s+/).filter(w => w.length > 0).length;
            
            if (browserWordCount > whisperWordCount * 1.4 && browserWordCount > 2) {
                finalUserText = browserText;
                transcriptSource = "Browser (Longer Content)";
            } else if (!whisperText && browserText) {
                finalUserText = browserText;
                transcriptSource = "Browser (Whisper Fallback)";
            } else {
                finalUserText = whisperText;
            }

            console.log(`STT Result [${transcriptSource}]: "${finalUserText}"`);

            if (!finalUserText || finalUserText.trim().length === 0) {
                toast.error("I didn't hear anything. Please try again.");
                setIsProcessing(false);
                setAiState('idle');
                return;
            }

            // 3. Add User Message
            addMessage('user', finalUserText);
            setTranscript('');

            // 4. Send to Backend
            try {
                const endpoint = aiMode === 'bot' 
                    ? `${API_BASE_URL}/api/bot/chat` 
                    : `${API_BASE_URL}/api/interview/chat`;
                
                const payload = {
                    history: chatHistory.map(m => ({ role: m.role, text: m.text })),
                    userResponse: finalUserText,
                    interviewType: interviewSettings.type // ignored by bot endpoint
                };

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                
                if (data.text) {
                    addMessage('ai', data.text);
                    if (aiMode !== 'bot') {
                        if (aiMode !== 'bot') speak(data.text);
                    }
                }
            } catch (err) {
                console.error("API Error:", err);
                toast.error("Failed to get response from AI.");
                setAiState('idle');
            } finally {
                setIsProcessing(false);
            }
        };

        mediaRecorderRef.current.start();
        
      } catch (err) {
        console.error("Mic Error:", err);
        toast.error("Could not access microphone.");
        // Revert state on critical failure
        setIsRecording(false);
        setAiState('idle');
        browserSTT.stopRecording();
      }
    } else {
      // STOP RECORDING
      setIsRecording(false);
      stopAudio(); // This triggers onstop handler above
    }
  };

  const handleSettingsSave = (settings) => {
    setInterviewSettings(settings);
  };

  return (
    <div className="ai-interviewer-container">
      {/* Settings Modal */}
      <AIInterviewSettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={handleSettingsSave}
      />

      {/* Fixed Top-Left Controls */}
      <div className="fixed-controls-container">
          <SegmentedControl
            options={[
              { value: 'bot', label: 'AI Bot' },
              { value: 'interviewer', label: 'AI Interviewer' }
            ]}
            value={aiMode}
            onChange={setAiMode}
          />

          {/* Settings Button - Available in both modes */}
          <button 
            className="settings-button"
            onClick={() => setIsSettingsModalOpen(true)}
            title="Settings"
          >
            <FiSliders size={18} />
          </button>

          {/* End Chat Button - Only in Bot Mode */}
          {aiMode === 'bot' && isSessionActive && (
              <button 
                className="settings-button"
                onClick={stopSession}
                title="End & Save Chat"
                style={{ width: 'auto', padding: '0 15px', borderRadius: '20px', fontSize: '0.8rem' }}
              >
                <FiSquare style={{ marginRight: '8px', fontSize: '0.8rem' }} /> End Chat
              </button>
          )}
      </div>

      <div className={`ai-content ${aiMode === 'bot' ? 'ai-content-bot-mode' : ''}`}>
        {/* Left Panel: Avatar & Status - Hidden in Bot Mode */}
        <AnimatePresence>
            {aiMode === 'interviewer' && (
                <motion.div 
                className="glass-card interviewer-section"
                initial={{ x: -50, opacity: 0, width: 0, padding: 0 }}
                animate={{ x: 0, opacity: 1, width: 350, padding: "30px 20px" }}
                exit={{ x: -50, opacity: 0, width: 0, padding: 0, margin: 0 }}
                transition={{ duration: 0.5, type: 'spring', bounce: 0 }}
                style={{ overflow: 'hidden' }}
                >
                <div className="avatar-wrapper">
                    <LiquidJarvisAnimation state={aiState} />
                </div>
                
                <div className="interviewer-status">
                    {aiState === 'idle' && "Ready"}
                    {aiState === 'listening' && "Listening..."}
                    {aiState === 'processing' && "Thinking..."}
                    {aiState === 'speaking' && "Speaking..."}
                </div>

                <div className="controls-container">
                    {/* INTERVIEWER MODE CONTROLS */}
                        {!isSessionActive ? (
                            <button className="control-btn btn-start" onClick={startSession}>
                                <FiPlay /> Start Interview
                            </button>
                        ) : (
                            <div className="active-controls">
                                <button 
                                    className={`control-btn ${isRecording ? 'btn-stop-rec' : 'btn-mic'} ${isProcessing ? 'disabled' : ''}`}
                                    onClick={handleMicClick}
                                    disabled={isProcessing}
                                >
                                    {isRecording ? <FiSquare /> : <FiMic />}
                                    {isRecording ? "Stop Speaking" : "Tap to Speak"}
                                </button>
                                
                                <button className="control-btn btn-end" onClick={stopSession}>
                                    End Session
                                </button>
                            </div>
                        )}
                </div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* Right Panel: Chat History */}
        <motion.div 
          layout /* Auto-animate layout changes when sibling disappears */
          className={`glass-card chat-section ${aiMode === 'bot' ? 'bot-mode-active' : ''}`}
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, type: 'spring', bounce: 0, layout: { duration: 0.4 } }}
        >
            <div className="chat-window">
                {chatHistory.length === 0 && (
                    <div className="empty-state">
                        <AnimatePresence mode="wait">
                            {aiMode === 'bot' ? (
                                <motion.div
                                    key="bot-empty"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <h2 style={{ marginBottom: '10px', color: 'var(--text-primary)' }}>Lagua AI Bot</h2>
                                    <p>Hi! I'm Lagua. Ask me anything!</p>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="interviewer-empty"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <h2 style={{ marginBottom: '10px', color: 'var(--text-primary)' }}>AI Interviewer Pro</h2>
                                    <div style={{ 
                                        background: 'rgba(6, 182, 212, 0.1)', 
                                        color: 'var(--accent-primary)', 
                                        padding: '5px 15px', 
                                        borderRadius: '15px',
                                        fontSize: '0.9rem',
                                        fontWeight: '600',
                                        marginBottom: '10px',
                                        display: 'inline-block'
                                    }}>
                                        {interviewSettings.type === 'hr' && '💼 HR Interview'}
                                        {interviewSettings.type === 'technical' && '💻 Technical Interview'}
                                        {interviewSettings.type === 'behavioral' && '🎯 Behavioral Interview'}
                                        {interviewSettings.type === 'mixed' && '🔀 Mixed Interview'}
                                        {interviewSettings.type === 'domain-specific' && '🎓 Domain Specific Interview'}
                                    </div>
                                    <p>Start the session to begin your interview.</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
                
                {chatHistory.map((msg, idx) => (
                    <motion.div 
                        key={idx}
                        className={`chat-message ${msg.role}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="message-avatar">
                            {msg.role === 'ai' ? <FiCpu /> : <FiUser />}
                        </div>
                        <div className="message-bubble">
                            {msg.role === 'ai' ? (
                                <>
                                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                                    <div className="message-actions">
                                        <button 
                                            className="message-action-btn copy-btn"
                                            onClick={() => handleCopy(msg.text, msg.id)}
                                            title="Copy text"
                                        >
                                            {copiedId === msg.id ? <FiCheck size={14} /> : <FiCopy size={14} />}
                                        </button>
                                        {aiMode === 'bot' && (
                                            <button 
                                                className="message-action-btn speaker-btn"
                                                onClick={() => speak(msg.text)}
                                                title="Read aloud"
                                            >
                                                <FiVolume2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    {msg.text}
                                    <button 
                                        className="message-action-btn copy-btn user"
                                        onClick={() => handleCopy(msg.text, msg.id)}
                                        title="Copy text"
                                    >
                                        {copiedId === msg.id ? <FiCheck size={14} /> : <FiCopy size={14} />}
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>
                ))}

                {/* Live Transcript Preview */}
                {isRecording && transcript && (
                    <motion.div 
                        className="chat-message user interim"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <div className="message-avatar"><FiUser /></div>
                        <div className="message-bubble">
                            {transcript}<span className="cursor">|</span>
                        </div>
                        <button 
                            className="reset-transcript-btn"
                            onClick={clearTranscript}
                            title="Reset current text"
                        >
                            <FiRotateCcw />
                        </button>
                    </motion.div>
                )}
                
                {/* Processing Indicator */}
                {isProcessing && (
                     <motion.div className="chat-message ai processing">
                        <div className="message-avatar"><FiCpu /></div>
                        <div className="typing-indicator">
                            <span></span><span></span><span></span>
                        </div>
                     </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area - ONLY FOR BOT MODE */}
            {aiMode === 'bot' && (
                <div className="bot-input-area">
                    <input 
                        ref={inputRef}
                        type="text" 
                        className="bot-text-input"
                        placeholder="Type your message..."
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        disabled={isProcessing || isRecording}
                    />
                    <button 
                        className="bot-send-btn"
                        onClick={() => handleSendMessage()}
                        disabled={!inputMessage.trim() || isProcessing}
                    >
                        <FiPlay style={{ marginLeft: '2px' }} />
                    </button>
                    <button 
                        className={`bot-mic-btn ${isRecording ? 'recording' : ''}`}
                        onClick={handleMicClick}
                        title="Voice Input"
                        disabled={isProcessing}
                    >
                         {isRecording ? <FiSquare /> : <FiMic />}
                    </button>
                </div>
            )}
        </motion.div>
      </div>
    </div>
  );
};

export default AIInterviewer;
