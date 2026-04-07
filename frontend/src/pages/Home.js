import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiMic, FiAward, FiBriefcase, FiTrendingUp, FiGlobe, FiCpu, FiDownload, FiCheckCircle, FiHeadphones } from 'react-icons/fi';
import { useWhisper } from '../contexts/WhisperContext';
import AuroraBackground from '../components/AuroraBackground';
import { HoverEffect } from '../components/CardHoverEffect';
import '../styles/Home.css';

const ModelManager = () => {
  const { status, progress, loadModel } = useWhisper();

  if (status === 'loading') {
    return (
      <div style={{ width: '200px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9rem' }}>
          <span>Downloading...</span>
          <span>{progress}%</span>
        </div>
        <div style={{ width: '100%', height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent-primary)', transition: 'width 0.3s ease' }}></div>
        </div>
      </div>
    );
  }

  if (status === 'ready') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--success)' }}>
          <FiCheckCircle /> <span>Installed & Ready</span>
        </div>
      </div>
    );
  }

  return (
    <button 
      onClick={loadModel}
      className="neon-button"
      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
    >
      <FiDownload /> Install Model (140MB)
    </button>
  );
};

const Home = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5
      }
    }
  };

  return (
    <AuroraBackground className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container hero-container">
          <motion.div 
            className="hero-content"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="hero-title">
              Master Languages with <span className="gradient-text">LanguaBot</span>
            </h1>
            <p className="hero-subtitle">
              Your AI-powered speaking partner. Practice conversations, improve grammar, and ace interviews with real-time feedback.
            </p>
            <div className="hero-buttons">
              <Link to="/topic-practice" className="neon-button">Start Learning</Link>
              <Link to="/dashboard" className="neon-button-outline">View Dashboard</Link>
            </div>
            
            {(() => {
              const streak = parseInt(localStorage.getItem('userStreak') || '0');
              if (streak < 0) return null;
              
              let emoji = "🌱"; // Fresh start
              if (streak >= 1) emoji = "💡"; // Building the habit
              if (streak >= 3) emoji = "🔥"; // On fire
              if (streak >= 7) emoji = "🚀"; // Going fast
              if (streak >= 30) emoji = "👑"; // Master
              
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  style={{ marginTop: '25px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 152, 0, 0.1)', border: '1px solid rgba(255, 152, 0, 0.3)', padding: '8px 16px', borderRadius: '30px', color: '#ff9800', fontWeight: 'bold' }}
                >
                  <FiTrendingUp /> {streak} Day Learning Streak {emoji}
                </motion.div>
              );
            })()}
          </motion.div>
          
          <motion.div 
            className="hero-visuals"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="floating-icon icon-1"><FiMic /></div>
            <div className="floating-icon icon-2"><FiAward /></div>
            <div className="floating-icon icon-3"><FiBriefcase /></div>
            <div className="glow-orb"></div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <motion.h2 
            className="section-title"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Practice Modes
          </motion.h2>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <HoverEffect items={[
              {
                title: "Topic Practice",
                description: "Speak on trending topics to improve fluency and clarity with AI feedback.",
                link: "/topic-practice",
                icon: <FiMic />
              },
              {
                title: "Grammar Practice",
                description: "Master complex sentence structures through targeted repetition exercises.",
                link: "/grammar-practice",
                icon: <FiAward />
              },
              {
                title: "AI Bot",
                description: "Ask daily questions, get quotes, or explore general knowledge with your AI assistant.",
                link: { pathname: "/ai-interviewer", state: { mode: "bot" } },
                icon: <FiCpu />
              },
              {
                title: "AI Interviewer",
                description: "Practice face-to-face AI interviews with real-time feedback and interactive sessions.",
                link: { pathname: "/ai-interviewer", state: { mode: "interviewer" } },
                icon: <FiMic />
              },
              {
                title: "Listen & Read",
                description: "Improve your comprehension with varied audio exercises and reading materials.",
                link: "/listen-and-read",
                icon: <FiHeadphones />
              },
              {
                title: "Dashboard",
                description: "View your learning stats, track progress, and analyze your performance.",
                link: "/dashboard",
                icon: <FiTrendingUp />
              }
            ]} />
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="benefits-section">
        <div className="container">
          <motion.h2 
            className="section-title"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Why Choose LanguaBot?
          </motion.h2>

          <motion.div 
            className="benefits-grid"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.div className="benefit-card" variants={itemVariants}>
              <div className="benefit-icon"><FiCpu /></div>
              <h3>AI-Powered Feedback</h3>
              <p>Get instant analysis on filler words, repetition, and fluency.</p>
            </motion.div>

            <motion.div className="benefit-card" variants={itemVariants}>
              <div className="benefit-icon"><FiTrendingUp /></div>
              <h3>Track Progress</h3>
              <p>Visualize your improvement over time with detailed analytics.</p>
            </motion.div>

            <motion.div className="benefit-card" variants={itemVariants}>
              <div className="benefit-icon"><FiGlobe /></div>
              <h3>Real-world Context</h3>
              <p>Practice with content relevant to modern life and careers.</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* AI Model Management Section */}
      <section className="model-section">
        <div className="container">
          <motion.div 
            className="model-card"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="model-info">
              <h3>
                <FiCpu className="model-icon" /> 
                Offline AI Model (Whisper Base)
              </h3>
              <p>
                Download the high-accuracy speech recognition model to run entirely on your device. 
                <br/>
                <span className="model-meta">Size: ~75MB | Privacy: 100% Offline</span>
              </p>
            </div>

            <div className="model-actions">
              <ModelManager />
            </div>
          </motion.div>
        </div>
      </section>


      {/* Footer */}
      <footer className="footer">
        <div className="container footer-container">
          <div className="footer-col">
            <h3 className="gradient-text">LanguaBot</h3>
            <p>Empowering language learners with cutting-edge AI technology.</p>
          </div>
          <div className="footer-col">
            <h4>Quick Links</h4>
            <Link to="/">Home</Link>
            <Link to="/topic-practice">Topic Practice</Link>
            <Link to="/dashboard">Dashboard</Link>
          </div>
          <div className="footer-col">
            <h4>Support</h4>
            <Link to="#">Help Center</Link>
            <Link to="#">Privacy Policy</Link>
            <Link to="#">Terms of Service</Link>
          </div>
          <div className="footer-col">
            <h4>Contact</h4>
            <p>support@languabot.com</p>
            <p>1-800-LANG-BOT</p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2024 LanguaBot. All rights reserved.</p>
        </div>
      </footer>
    </AuroraBackground>
  );
};

export default Home;
