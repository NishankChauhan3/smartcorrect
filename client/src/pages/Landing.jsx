import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Sparkles, Zap, Shield, Edit3 } from 'lucide-react';

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-white font-sans overflow-x-hidden">
      {/* Navbar */}
      <nav className="flex justify-between items-center p-6 lg:px-24">
        <div className="flex items-center gap-2">
          <Sparkles className="text-accentBlue" />
          <span className="text-xl font-bold tracking-tight">SmartCorrect AI</span>
        </div>
        <div className="flex gap-4">
          <Link to="/auth" className="px-5 py-2 font-medium text-slate-300 hover:text-white transition-colors">Log In</Link>
          <Link to="/auth" className="px-5 py-2 bg-accentBlue text-background font-semibold rounded-lg hover:bg-sky-400 transition-colors">Sign Up</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center pt-24 pb-16 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700 mb-8"
        >
          <span className="flex h-2 w-2 rounded-full bg-accentBlue animate-pulse"></span>
          <span className="text-sm font-medium text-slate-300">Powered by Advanced LLMs</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 max-w-4xl leading-tight"
        >
          Write with <span className="text-transparent bg-clip-text bg-gradient-to-r from-accentBlue to-accentPurple">Flawless Confidence.</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10"
        >
          An intelligent writing assistant that fixes grammar, optimizes tone, and analyzes sentiment in real-time. Elevate your writing instantly.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <Link to="/auth" className="px-8 py-4 bg-white text-background font-bold rounded-lg hover:bg-slate-200 transition-colors shadow-[0_0_40px_rgba(56,189,248,0.3)]">
            Get Started for Free
          </Link>
          <a href="#features" className="px-8 py-4 bg-card border border-slate-700 font-semibold rounded-lg hover:bg-slate-800 transition-colors">
            Explore Features
          </a>
        </motion.div>
      </main>

      {/* Features Showcase */}
      <section id="features" className="py-24 px-6 lg:px-24 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to write better</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">From quick typo fixes to complete sentence restructuring, SmartCorrect AI handles it all in milliseconds.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card p-8 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="h-12 w-12 bg-accentBlue/10 rounded-xl flex items-center justify-center mb-6">
                <Edit3 className="text-accentBlue" />
              </div>
              <h3 className="text-xl font-bold mb-3">Real-Time Correction</h3>
              <p className="text-slate-400">Instantly fix spelling, grammar, and punctuation mistakes as you type without breaking your flow.</p>
            </div>

            <div className="bg-card p-8 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="h-12 w-12 bg-accentPurple/10 rounded-xl flex items-center justify-center mb-6">
                <Zap className="text-accentPurple" />
              </div>
              <h3 className="text-xl font-bold mb-3">Tone Converter</h3>
              <p className="text-slate-400">Rewrite your sentences to sound more Professional, Formal, Friendly, or Academic with one click.</p>
            </div>

            <div className="bg-card p-8 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="h-12 w-12 bg-success/10 rounded-xl flex items-center justify-center mb-6">
                <Shield className="text-success" />
              </div>
              <h3 className="text-xl font-bold mb-3">Advanced Analytics</h3>
              <p className="text-slate-400">Track readability scores, sentiment confidence, and your overall writing improvement over time.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
