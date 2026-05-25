# SmartCorrect ✨

SmartCorrect is a full-stack AI-powered writing assistant and text transformation platform. Built with a modern React frontend and a robust Node.js backend, it leverages Google's Gemini AI to provide on-demand grammar correction, text formatting, tone adjustments, and detailed productivity analytics.

## 🚀 Features

- **On-Demand AI Analysis:** Manually trigger comprehensive checks to fix spelling, grammar, and structure without disrupting your flow.
- **Tone Converter:** Seamlessly rewrite sentences to sound Professional, Formal, Friendly, or Academic with one click.
- **Real-Time Document Metrics:** Live tracking of Sentiment, Readability, Professionalism, and Clarity scores as you type.
- **Advanced AI Tools:** Quickly Summarize, Expand, Translate (via MyMemory API), or convert text into Bullet points.
- **Advanced Analytics Dashboard:** Visually track your daily goals, current streaks, total words typed, and writing improvement over time.
- **Secure Authentication:** JWT-based registration and login system to persist your progress and analytics.

## 🛠️ Tech Stack

**Frontend:**
- React 19 (Vite)
- Tailwind CSS
- Redux Toolkit (State Management)
- Framer Motion (Animations)
- Socket.io Client (Real-time features)

**Backend:**
- Node.js & Express
- MongoDB & Mongoose (Database)
- Google Generative AI (Gemini API)
- JSON Web Tokens (JWT) for Auth

## 💻 Getting Started

### Prerequisites
Make sure you have Node.js and MongoDB installed on your system.

### 1. Clone the repository
```bash
git clone https://github.com/NishankChauhan3/smartcorrect.git
cd smartcorrect
```

### 2. Backend Setup
Navigate to the server directory and install dependencies:
```bash
cd server
npm install
```

Create a `.env` file in the `server` directory and add your environment variables:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GEMINI_API_KEY=your_gemini_api_key
```

Start the backend server:
```bash
npm start
# or use node server.js
```

### 3. Frontend Setup
Open a new terminal, navigate to the client directory, and install dependencies:
```bash
cd client
npm install
```

Start the frontend development server:
```bash
npm run dev
```

The application should now be running locally. You can access the frontend at `http://localhost:5173`.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome!

## 📝 License
This project is licensed under the ISC License.
