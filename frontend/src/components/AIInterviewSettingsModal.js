import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiSettings, FiMic, FiBriefcase } from 'react-icons/fi';

const AIInterviewSettingsModal = ({ isOpen, onClose, onSave }) => {
  const [voiceOption, setVoiceOption] = useState('us-female');
  const [interviewType, setInterviewType] = useState('hr');
  const [speechSpeed, setSpeechSpeed] = useState('medium');
  const [sttMode, setSttMode] = useState('fast');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Check if settings already configured
    const isConfigured = localStorage.getItem('ai_interview_settings_configured') === 'true';
    
    if (!isConfigured && !isOpen) {
      // Show modal on first visit after a small delay
      const timer = setTimeout(() => setShowModal(true), 800);
      return () => clearTimeout(timer);
    } else if (isOpen) {
      setShowModal(true);
    }
  }, [isOpen]);

  useEffect(() => {
    // Load saved settings
    const savedVoice = localStorage.getItem('ai_interview_voice') || 'us-female';
    const savedType = localStorage.getItem('ai_interview_type') || 'hr';
    const savedSpeed = localStorage.getItem('ai_interview_speed') || 'medium';
    const savedSTT = localStorage.getItem('ai_interview_stt_mode') || 'fast';
    setVoiceOption(savedVoice);
    setInterviewType(savedType);
    setSpeechSpeed(savedSpeed);
    setSttMode(savedSTT);
  }, []);

  const handleSave = () => {
    // Save to localStorage
    localStorage.setItem('ai_interview_voice', voiceOption);
    localStorage.setItem('ai_interview_type', interviewType);
    localStorage.setItem('ai_interview_speed', speechSpeed);
    localStorage.setItem('ai_interview_stt_mode', sttMode);
    localStorage.setItem('ai_interview_settings_configured', 'true');
    
    // Callback to parent
    if (onSave) {
      onSave({ voice: voiceOption, type: interviewType, speed: speechSpeed, sttMode: sttMode });
    }
    
    handleClose();
  };

  const handleClose = () => {
    setShowModal(false);
    if (onClose) onClose();
  };

  const voiceOptions = [
    { value: 'uk-english', label: 'UK English' },
    { value: 'us-female', label: 'US English Female' },
    { value: 'us-male', label: 'US English Male' },
    { value: 'indian-male', label: 'Indian English Male' },
    { value: 'indian-female', label: 'Indian English Female' }
  ];

  const interviewTypes = [
    { value: 'technical', label: 'Technical' },
    { value: 'hr', label: 'HR' },
    { value: 'behavioral', label: 'Behavioral' },
    { value: 'mixed', label: 'Mixed' },
    { value: 'domain-specific', label: 'Domain Specific' }
  ];

  const speechSpeedOptions = [
    { value: 'slow', label: 'Slow (0.9x)' },
    { value: 'medium', label: 'Medium (1.0x)' },
    { value: 'fast', label: 'Fast (1.15x)' }
  ];

  const sttModeOptions = [
    { value: 'fast', label: 'Fast Mode (Browser STT)' },
    { value: 'accurate', label: 'High Accuracy (Whisper)' }
  ];

  return (
    <AnimatePresence>
      {showModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(5px)',
            zIndex: 4000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--accent-primary)',
              borderRadius: '20px',
              padding: '30px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 0 30px rgba(0, 243, 255, 0.2)',
              position: 'relative'
            }}
          >
            <button 
              onClick={handleClose}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '1.2rem',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.color = 'var(--accent-primary)'}
              onMouseLeave={(e) => e.target.style.color = 'var(--text-secondary)'}
            >
              <FiX />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '25px' }}>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                background: 'rgba(0, 243, 255, 0.1)', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 15px',
                color: 'var(--accent-primary)',
                fontSize: '1.8rem'
              }}>
                <FiSettings />
              </div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '10px', color: 'var(--text-primary)' }}>
                Interview Settings
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem' }}>
                Customize your AI interviewer experience
              </p>
            </div>

            {/* Settings Grid - 2x2 Layout */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr',
              gap: '20px',
              marginBottom: '25px'
            }}>
              
              {/* Voice Selection */}
              <div>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '8px'
                }}>
                  <FiMic style={{ color: 'var(--accent-primary)', fontSize: '1rem' }} />
                  AI Voice
                </label>
                <select
                  value={voiceOption}
                  onChange={(e) => setVoiceOption(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                >
                  {voiceOptions.map(option => (
                    <option 
                      key={option.value} 
                      value={option.value}
                      style={{
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Interview Type */}
              <div>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '8px'
                }}>
                  <FiBriefcase style={{ color: 'var(--accent-primary)', fontSize: '1rem' }} />
                  Interview Type
                </label>
                <select
                  value={interviewType}
                  onChange={(e) => setInterviewType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                >
                  {interviewTypes.map(option => (
                    <option 
                      key={option.value} 
                      value={option.value}
                      style={{
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Speech Speed */}
              <div>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '8px'
                }}>
                  <FiMic style={{ color: 'var(--accent-primary)', fontSize: '1rem' }} />
                  Speech Speed
                </label>
                <select
                  value={speechSpeed}
                  onChange={(e) => setSpeechSpeed(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                >
                  {speechSpeedOptions.map(option => (
                    <option 
                      key={option.value} 
                      value={option.value}
                      style={{
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* STT Mode */}
              <div>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '8px'
                }}>
                  <FiMic style={{ color: 'var(--accent-primary)', fontSize: '1rem' }} />
                  STT Mode
                </label>
                <select
                  value={sttMode}
                  onChange={(e) => setSttMode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                >
                  {sttModeOptions.map(option => (
                    <option 
                      key={option.value} 
                      value={option.value}
                      style={{
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
                <p style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-secondary)',
                  marginTop: '4px',
                  opacity: 0.7
                }}>
                  {sttMode === 'fast' ? '⚡ Fast' : '🎯 Accurate'}
                </p>
              </div>

            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '15px' }}>
              <button 
                onClick={handleClose}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.target.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.color = 'var(--text-secondary)';
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="neon-button"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <FiSettings /> Save Settings
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AIInterviewSettingsModal;
