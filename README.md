# LanguaBot 🎙️

An AI-powered language learning web application that helps users improve their English speaking skills through interactive practice sessions.

## ✨ Features

- **Real-time Speech Recognition**: Uses browser's built-in STT for instant feedback
- **Offline AI Model**: Optional high-accuracy transcription with OpenAI Whisper (runs entirely in browser)
- **Hybrid Mode**: Combines speed of browser STT with accuracy of Whisper
- **Live Feedback**: Detects filler words (um, uh, like) and repetitive words
- **Liquid Jarvis Animation**: Beautiful, state-aware AI visualization
- **Multiple Practice Modes**:
  - Topic Practice: Speak on trending topics
  - Grammar Practice: Master complex sentence structures
  - Interview Prep: Simulate job interviews
- **Progress Tracking**: Dashboard with session history and analytics

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/kandurisripaada/language.git
cd language
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Install frontend dependencies:
```bash
cd ../frontend
npm install
```

### Running the Application

1. Start the backend server:
```bash
cd backend
node server.js
```
The server will run on `http://localhost:5000`

2. In a new terminal, start the frontend:
```bash
cd frontend
npm start
```
The app will open at `http://localhost:3000`

## 🎯 Usage

1. **Choose a Practice Mode**: Select from Topic, Grammar, or Interview practice
2. **Enable High Accuracy (Optional)**: Install the offline Whisper model for enhanced accuracy
3. **Start Speaking**: Click "Start Speaking" and respond to the prompt
4. **Get Feedback**: View real-time transcript and feedback on filler words
5. **Track Progress**: Check your Dashboard for session history and improvement

## 🛠️ Tech Stack

### Frontend
- React 18
- Framer Motion (animations)
- React Router (navigation)
- React Hot Toast (notifications)
- Transformers.js (offline AI)

### Backend
- Node.js
- Express
- CORS

## 📦 Project Structure

```
language/
├── backend/
│   ├── server.js
│   └── data/
│       ├── topics.json
│       ├── grammar.json
│       └── interviews.json
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       ├── contexts/
│       ├── workers/
│       └── styles/
└── README.md
```

## 🎨 Features in Detail

### Hybrid Transcription
- **Live Preview**: See words appear instantly while speaking (Browser STT)
- **Background Enhancement**: Whisper processes audio in background
- **Silent Update**: Transcript updates to high-accuracy version when ready

### Offline AI Model
- Model: `whisper-tiny.en` (~30MB)
- Runs entirely in browser using Web Workers
- 100% private - no audio leaves your device
- One-time download, cached for future use

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 👤 Author

**Kanduri Sripaada**
- GitHub: [@kandurisripaada](https://github.com/kandurisripaada)

## 🙏 Acknowledgments

- OpenAI Whisper for the speech recognition model
- Xenova for Transformers.js
- Google for Web Speech API
