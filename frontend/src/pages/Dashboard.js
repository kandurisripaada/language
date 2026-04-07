import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiMic, FiAward, FiCalendar, FiClock, FiTrendingUp, FiBookOpen, FiHeadphones } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import '../styles/Dashboard.css';
import { API_BASE_URL } from '../config';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalSessions: 0,
    averageScore: 0,
    sessionsThisWeek: 0,
    currentStreak: 0,
    recentActivity: []
  });
  const [savedVocabulary, setSavedVocabulary] = useState([]);

  const safeReadJson = async (response) => {
    const raw = await response.text();
    try {
      return JSON.parse(raw);
    } catch (error) {
      if (raw.trim().startsWith('<')) {
        throw new Error('API returned HTML instead of JSON. Please check backend URL and restart server.');
      }
      throw new Error('Invalid API response.');
    }
  };

  useEffect(() => {
    const fetchHistory = async () => {
      const token = localStorage.getItem('token');
      let history = [];

      try {
        if (token) {
          const response = await fetch(`${API_BASE_URL}/api/practice/history`, {
              headers: {
                  'Authorization': `Bearer ${token}`
              }
          });
          history = await response.json();
        }
        
        // Fallback for guest users
        if (!token || !Array.isArray(history) || history.length === 0) {
          try {
             const localHistory = JSON.parse(localStorage.getItem('practiceHistory') || '[]');
             if (Array.isArray(localHistory) && localHistory.length > 0) {
                 history = localHistory;
             }
          } catch (e) {
             console.error("Failed to parse local history.", e);
          }
        }
        
        if (Array.isArray(history)) {
             const totalSessions = history.length;
             const averageScore = totalSessions > 0 
               ? Math.round(history.reduce((acc, curr) => acc + curr.score, 0) / totalSessions) 
               : 0;
             
             // Calculate sessions this week
             const now = new Date();
             const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
             const sessionsThisWeek = history.filter(s => new Date(s.date) > oneWeekAgo).length;

             // Calculate Streak
             const toDateString = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
             const uniqueDates = [...new Set(history.map(s => toDateString(new Date(s.date))))];
             let streak = 0;
             const today = new Date();
             for (let i = 0; i < 365; i++) {
                 const checkDate = new Date(today);
                 checkDate.setDate(today.getDate() - i);
                 const dateString = toDateString(checkDate);
                 
                 if (uniqueDates.includes(dateString)) {
                     streak++;
                 } else if (i === 0) {
                     continue; // Hasn't practiced today yet, but streak stands from yesterday
                 } else {
                     break;
                 }
             }

             // Keep local storage synced for Home page quick access
             localStorage.setItem('userStreak', streak.toString());

             setStats({
               totalSessions,
               averageScore,
               sessionsThisWeek,
               currentStreak: streak,
               recentActivity: history.slice(0, 20) // Top 20
             });
        }
      } catch (error) {
        console.error("Failed to fetch history:", error);
      }
    };

    fetchHistory();
  }, []);

  useEffect(() => {
    const fetchVocabulary = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setSavedVocabulary([]);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/vocabulary`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) return;
        const data = await safeReadJson(response);
        if (Array.isArray(data)) {
          // Deduplicate by lowercase word to avoid duplicates in UI
          const seen = new Set();
          const deduped = data.filter((item) => {
            const w = (item?.word || '').toLowerCase();
            if (!w || seen.has(w)) return false;
            seen.add(w);
            return true;
          });
          setSavedVocabulary(deduped);
        }
      } catch (error) {
        console.error('Failed to fetch vocabulary:', error);
      }
    };

    fetchVocabulary();
  }, []);

  // Use a local streak fallback if stats.currentStreak is 0 (in case of API delay)
  const displayStreak = Math.max(stats.currentStreak, parseInt(localStorage.getItem('userStreak') || '0'));

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1
    }
  };

  return (
    <div className="dashboard-page">
      <div className="container">
        <div className="dashboard-header">
          <h1 className="gradient-text">Your Learning Dashboard</h1>
          <p>Track your progress and keep improving.</p>
        </div>

        <motion.div 
          className="stats-grid"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="stat-card" variants={itemVariants}>
            <div className="stat-icon icon-blue"><FiMic /></div>
            <div className="stat-info">
              <h3>{stats.totalSessions}</h3>
              <p>Total Sessions</p>
            </div>
          </motion.div>

          <motion.div className="stat-card" variants={itemVariants}>
            <div className="stat-icon icon-purple"><FiAward /></div>
            <div className="stat-info">
              <h3>{stats.averageScore}%</h3>
              <p>Average Score</p>
            </div>
          </motion.div>

          <motion.div className="stat-card" variants={itemVariants}>
            <div className="stat-icon icon-green"><FiCalendar /></div>
            <div className="stat-info">
              <h3>{stats.sessionsThisWeek}</h3>
              <p>This Week</p>
            </div>
          </motion.div>

          <motion.div className="stat-card" variants={itemVariants} style={{ position: 'relative', overflow: 'hidden' }}>
            <div className="stat-icon icon-orange" style={{ color: '#ff9800', background: 'rgba(255, 152, 0, 0.1)' }}><FiTrendingUp /></div>
            <div className="stat-info">
              <h3>{displayStreak} <span style={{ fontSize: '1rem' }}>Days</span></h3>
              <p>Current Streak</p>
            </div>
            {displayStreak > 0 && <div className="glow-orb" style={{ background: '#ff9800', opacity: 0.1, right: '-20px', bottom: '-20px' }}></div>}
          </motion.div>
        </motion.div>

        <div className="dashboard-content">
          <div className="dashboard-left-column">
            <section className="dashboard-section">
              <h2>Start Practicing</h2>
              <div className="practice-modes-grid">
                <Link to="/topic-practice" className="practice-mode-card">
                  <div className="mode-icon"><FiMic /></div>
                  <h3>Topic Practice</h3>
                  <p>Speak on trending topics</p>
                </Link>
                <Link to="/grammar-practice" className="practice-mode-card">
                  <div className="mode-icon"><FiAward /></div>
                  <h3>Grammar Practice</h3>
                  <p>Master sentence structures</p>
                </Link>
                <Link
                  to="/ai-interviewer"
                  state={{ mode: 'interviewer' }}
                  className="practice-mode-card"
                >
                  <div className="mode-icon"><FiBriefcase /></div>
                  <h3>AI Interviewer</h3>
                  <p>Practice interview-style speaking sessions</p>
                </Link>
                <Link to="/listen-and-read" className="practice-mode-card">
                  <div className="mode-icon"><FiHeadphones /></div>
                  <h3>Listen &amp; Read</h3>
                  <p>Build listening and reading comprehension</p>
                </Link>
              </div>
            </section>

            <section className="dashboard-section">
              <h2>Saved Hard Words</h2>
              <div className="activity-list">
                {savedVocabulary.length > 0 ? (
                  savedVocabulary.map((item) => (
                    <motion.div
                      key={item.id || item.word}
                      className="activity-item"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <div className="activity-icon">
                        <FiBookOpen />
                      </div>
                      <div className="activity-details">
                        <div className="vocab-word-hover">
                          <h4
                            style={{ textTransform: 'capitalize' }}
                            className="vocab-word"
                          >
                            {item.word}
                          </h4>
                          <div className="vocab-tooltip" role="tooltip">
                            <div className="vocab-tooltip-meaning">
                              {item.meaning}
                            </div>
                            <div className="vocab-tooltip-examples">
                              {(Array.isArray(item.examples) ? item.examples.slice(0, 2) : []).map((example, idx) => (
                                <div key={`${item.word}-tt-${idx}`} className="vocab-tooltip-example">
                                  {idx + 1}. {example}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="empty-state">
                    <p>No saved hard words yet. Save words from Grammar Practice summary.</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="dashboard-right-column">
            <section className="dashboard-section">
              <h2>Recent Activity</h2>
              <div className="activity-list">
                {stats.recentActivity.length > 0 ? (
                  stats.recentActivity.map((session) => (
                    <motion.div 
                      key={session.id} 
                      className="activity-item"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <div className="activity-icon">
                        {session.type.includes('Topic') && <FiMic />}
                        {session.type.includes('Grammar') && <FiAward />}
                        {session.type.includes('Interview') && <FiBriefcase />}
                        {(session.type.includes('Listening') || session.type.includes('Listen')) && <FiHeadphones />}
                        {session.type.includes('Reading') && <FiBookOpen />}
                      </div>
                      <div className="activity-details">
                        <h4>{session.topic}</h4>
                        <p>{session.type} • {new Date(session.date).toLocaleDateString()}</p>
                      </div>
                      <div className="activity-score">
                        <span className={`score-badge ${session.score >= 80 ? 'high' : session.score >= 60 ? 'medium' : 'low'}`}>
                          {session.score}%
                        </span>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="empty-state">
                    <p>No practice sessions yet. Start one today!</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper component for icon since it wasn't imported in the main file
const FiBriefcase = () => (
  <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
);

export default Dashboard;
