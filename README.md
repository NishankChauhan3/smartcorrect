# SmartCorrect ✨

SmartCorrect is a full-stack AI-powered writing assistant and text transformation platform. Built with a modern React frontend and a robust Node.js backend, it leverages Google's Gemini AI to provide real-time autocorrection, text summarization, tone adjustments, and detailed productivity analytics.

## 🚀 Features

- **AI Text Transformation:** Instantly summarize, expand, or translate text using advanced AI models.
- **Smart Autocorrect:** Real-time grammar and spelling corrections.
- **User Authentication:** Secure JWT-based registration and login system.
- **Analytics Dashboard:** Track your productivity, text processing history, and usage metrics over time.
- **Modern UI/UX:** A responsive, beautiful interface styled with Tailwind CSS and Framer Motion.

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
