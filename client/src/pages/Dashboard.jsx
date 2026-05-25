import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import io from 'socket.io-client';
import { LayoutDashboard, FileText, BarChart3, LogOut, Loader2, Check, X, RefreshCw, MessageSquare, Sparkles, Smile, Frown, Meh, TrendingUp, Download, Copy } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const socket = io('https://smartcorrect-backend-8el6.onrender.com');

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('editor');
  const [suggestions, setSuggestions] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stats, setStats] = useState({ words: 0, characters: 0 });
  const [metrics, setMetrics] = useState({
    sentiment: { label: 'Neutral', confidence: 0 },
    readability: { score: 0, grammar: 0, professionalism: 0, clarity: 0 }
  });

  const [analytics, setAnalytics] = useState({
    totalWordsTyped: 0,
    wordsTypedToday: 0,
    dailyGoal: 500,
    streak: 0,
    totalMistakesFixed: 0,
    correctionsBreakdown: { grammar: 0, professional: 0, formal: 0, friendly: 0, academic: 0 },
    improvementHistory: []
  });

  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState(500);

  const updateAnalytics = async (payload) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://smartcorrect-backend-8el6.onrender.com/api/analytics/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if(response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch(e) { console.error(e); }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData) {
      navigate('/auth');
      return;
    }
    setUser(JSON.parse(userData));

    const fetchAnalytics = async () => {
      try {
        const response = await fetch('https://smartcorrect-backend-8el6.onrender.com/api/analytics', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if(response.ok) {
          const data = await response.json();
          setAnalytics(data);
        }
      } catch(e) { console.error(e); }
    };
    fetchAnalytics();

    socket.on('ai_suggestion', (suggestion) => {
      setSuggestions((prev) => [suggestion, ...prev]);
      setIsAnalyzing(false);
    });

    socket.on('document_metrics', (data) => {
      setMetrics(data);
    });

    return () => {
      socket.off('ai_suggestion');
      socket.off('document_metrics');
    };
  }, [navigate]);

  const analyzeTimeoutRef = useRef(null);
  const prevWordCountRef = useRef(0);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Start typing here to see SmartCorrect AI in action...</p>',
    editorProps: {
      attributes: { class: 'prose prose-invert prose-lg max-w-none focus:outline-none min-h-[60vh] text-slate-300' },
    },
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      setStats({
        words: text.trim() === '' ? 0 : text.trim().split(/\\s+/).length,
        characters: text.length
      });
      
      if (analyzeTimeoutRef.current) {
        clearTimeout(analyzeTimeoutRef.current);
      }
      
      analyzeTimeoutRef.current = setTimeout(() => {
        if (text.length > 5) {
          // Send auto flag to force LanguageTool for real-time grammar (saves AI quota)
          setIsAnalyzing(true);
          setSuggestions(prev => prev.filter(s => s.type !== 'grammar' && s.type !== 'tone'));
          socket.emit('analyze_text', { text, mode: 'grammar', auto: true });

          // Auto-update document metrics (now 100% local and free, no API quota used)
          socket.emit('analyze_document', { text });

          const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
          const wordsAdded = Math.max(0, wordCount - prevWordCountRef.current);
          prevWordCountRef.current = wordCount;
          if (wordsAdded > 0) {
            updateAnalytics({ wordsAdded });
          }
          if (metrics.readability.score > 0) {
             updateAnalytics({ readabilityScore: metrics.readability.score });
          }
        }
      }, 1500); // Reduced to 1.5s for a smoother typing experience
    },
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const handleAnalyze = (mode = 'grammar') => {
    if (!editor) return;
    setIsAnalyzing(true);
    setSuggestions(prev => prev.filter(s => s.type !== mode && (mode === 'grammar' ? s.type !== 'tone' : s.type !== 'grammar')));
    socket.emit('analyze_text', { text: editor.getText(), mode });
  };

  const [translateLang, setTranslateLang] = useState('Spanish');

  const handleAITool = (action) => {
    if (!editor) return;
    let text = '';
    const selection = editor.state.selection;
    const hasSelection = !selection.empty;
    
    if (hasSelection) {
        text = editor.state.doc.textBetween(selection.from, selection.to, ' ');
    } else {
        text = editor.getText();
    }

    if (!text || text.trim() === '') return;

    setIsAnalyzing(true);
    setSuggestions(prev => prev.filter(s => s.type !== action));
    socket.emit('ai_tool', { action, text, language: translateLang, hasSelection });
  };

  const [copyText, setCopyText] = useState('Copy Text');
  
  const handleCopy = () => {
    if (!editor) return;
    navigator.clipboard.writeText(editor.getText());
    setCopyText('Copied!');
    setTimeout(() => setCopyText('Copy Text'), 2000);
  };

  const handleExportPDF = () => {
    if (!editor) return;
    const text = editor.getText();
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>Document Export</title>');
    printWindow.document.write('<style>body { font-family: sans-serif; padding: 40px; line-height: 1.6; white-space: pre-wrap; }</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(text.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const acceptSuggestion = (id, original, replacement, type) => {
    if(!editor) return;
    const currentText = editor.getText();
    const newContent = currentText.replace(original, replacement);
    editor.commands.setContent(`<p>${newContent}</p>`);
    setSuggestions(suggestions.filter(s => s.id !== id));
    updateAnalytics({ mistakeFixed: true, correctionType: type });
  };

  const ignoreSuggestion = (id) => {
    setSuggestions(suggestions.filter(s => s.id !== id));
  };

  const getSentimentUI = (label) => {
    const l = label.toLowerCase();
    if (l === 'positive') return { color: 'text-success', Icon: Smile };
    if (l === 'negative') return { color: 'text-error', Icon: Frown };
    return { color: 'text-slate-400', Icon: Meh };
  };

  const { color: sentimentColor, Icon: SentimentIcon } = getSentimentUI(metrics.sentiment.label);

  if (!user) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="animate-spin text-accentBlue w-8 h-8"/></div>;

  return (
    <div className="flex h-screen bg-background text-white font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-800 flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-accentBlue flex items-center justify-center font-bold text-background">AI</div>
          <h2 className="font-bold text-lg">SmartCorrect</h2>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveTab('editor')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'editor' ? 'bg-accentBlue/10 text-accentBlue' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <FileText size={20} /> Editor
          </button>
          <button onClick={() => setActiveTab('analytics')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'analytics' ? 'bg-accentBlue/10 text-accentBlue' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <BarChart3 size={20} /> Analytics
          </button>
        </nav>

        {activeTab === 'editor' && (
          <div className="p-4 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex justify-between items-center">
              AI Tools
            </h4>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                  <select 
                    value={translateLang}
                    onChange={(e) => setTranslateLang(e.target.value)}
                    className="bg-slate-800 text-xs text-white border border-slate-700 rounded outline-none px-1"
                  >
                    <option>English</option>
                    <option>Spanish</option>
                    <option>French</option>
                    <option>German</option>
                    <option>Hindi</option>
                    <option>Japanese</option>
                  </select>
                  <button onClick={() => handleAITool('translate')} className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium transition-colors text-left px-3">🌍 Translate</button>
              </div>
              <button onClick={() => handleAITool('summarize')} className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium transition-colors text-left px-3">📄 Summarize</button>
              <button onClick={() => handleAITool('expand')} className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium transition-colors text-left px-3">↔️ Expand Text</button>
              <button onClick={() => handleAITool('bullets')} className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium transition-colors text-left px-3">📋 Generate Bullets</button>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 text-center">Auto-selects highlighted text</p>
            
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 mt-6 flex justify-between items-center">
              Export & Share
            </h4>
            <div className="flex flex-col gap-2">
              <button onClick={handleExportPDF} className="w-full flex items-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium transition-colors text-left px-3">
                <Download size={14} /> Export PDF
              </button>
              <button onClick={handleCopy} className="w-full flex items-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium transition-colors text-left px-3">
                {copyText === 'Copied!' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />} {copyText}
              </button>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accentPurple flex items-center justify-center font-bold text-sm">
                {user.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="truncate w-32">
                <p className="text-sm font-medium truncate">{user.name}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-error transition-colors"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Editor View */}
        {activeTab === 'editor' && (
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 flex flex-col bg-background">
              <header className="h-16 border-b border-slate-800 px-6 flex items-center justify-between">
                <input type="text" defaultValue="Untitled Document" className="bg-transparent border-none text-xl font-semibold focus:outline-none focus:ring-0 w-1/2" />
                <div className="flex gap-2">
                  <span className="text-sm text-slate-500 self-center mr-4">Auto-saving...</span>
                  <button onClick={() => handleAnalyze('grammar')} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors border border-slate-700 flex items-center gap-2">
                    <RefreshCw size={16} className={isAnalyzing ? 'animate-spin' : ''} /> Analyze Text
                  </button>
                </div>
              </header>
              <div className="flex-1 overflow-y-auto p-8 lg:px-24">
                <EditorContent editor={editor} />
                
                {/* AI Suggestions Below Editor */}
                {suggestions.length > 0 && (
                  <div className="mt-12 border-t border-slate-800 pt-8 pb-12">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                      <Sparkles className="text-accentBlue" size={20} /> 
                      Review AI Suggestions
                    </h3>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {suggestions.map((sugg) => (
                        <div key={sugg.id} className="bg-slate-800/30 border border-slate-700 hover:border-slate-600 rounded-xl p-5 flex flex-col transition-colors shadow-sm">
                          <div className="flex justify-between items-start mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-accentBlue px-2 py-1 bg-accentBlue/10 rounded">{sugg.type}</span>
                          </div>
                          <div className="mb-4 flex-1">
                            <p className="line-through text-slate-500 text-sm mb-2">{sugg.original}</p>
                            <p className="text-white text-lg font-medium">{sugg.suggestion}</p>
                          </div>
                          <p className="text-sm text-slate-400 mb-5">{sugg.message}</p>
                          <div className="flex gap-3 mt-auto">
                            <button onClick={() => acceptSuggestion(sugg.id, sugg.original, sugg.suggestion, sugg.type)} className="flex-1 bg-success/20 text-success hover:bg-success/30 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"><Check size={16} /> Accept</button>
                            <button onClick={() => ignoreSuggestion(sugg.id)} className="flex-1 bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"><X size={16} /> Ignore</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <footer className="h-12 border-t border-slate-800 px-6 flex items-center text-sm text-slate-500">
                {stats.words} words • {stats.characters} characters
              </footer>
            </div>

            {/* AI Assistant Sidebar */}
            <aside className="w-80 bg-card border-l border-slate-800 flex flex-col">
              <div className="p-4 border-b border-slate-800">
                <h3 className="font-semibold text-lg flex items-center gap-2"><Sparkles className="text-accentBlue" size={18} /> AI Assistant</h3>
              </div>
              
              {/* Metrics Section */}
              <div className="p-4 border-b border-slate-800">
                <h4 className="text-sm font-medium text-slate-400 mb-3 flex justify-between">Document Metrics <span className="text-accentBlue cursor-pointer hover:underline" onClick={() => socket.emit('analyze_document', { text: editor.getText() })}>Refresh</span></h4>
                <div className="flex items-center gap-3 mb-3 bg-slate-800/50 p-2 rounded-lg border border-slate-700">
                  <SentimentIcon className={sentimentColor} size={20} />
                  <div>
                    <p className="text-xs text-slate-400">Sentiment</p>
                    <p className={`text-sm font-bold ${sentimentColor}`}>{metrics.sentiment.label} ({metrics.sentiment.confidence}%)</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Readability</span><span className="font-bold">{metrics.readability.score}</span></div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-accentBlue" style={{width: `${metrics.readability.score}%`}}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Grammar</span><span className="font-bold">{metrics.readability.grammar}</span></div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-success" style={{width: `${metrics.readability.grammar}%`}}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Professionalism</span><span className="font-bold">{metrics.readability.professionalism}</span></div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-accentPurple" style={{width: `${metrics.readability.professionalism}%`}}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Clarity</span><span className="font-bold">{metrics.readability.clarity}</span></div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-yellow-500" style={{width: `${metrics.readability.clarity}%`}}></div></div>
                  </div>
                </div>
              </div>

              {/* AI Modes */}
              <div className="p-4 border-b border-slate-800">
                <h4 className="text-sm font-medium text-slate-400 mb-2">Modes</h4>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => handleAnalyze('grammar')} className="px-3 py-1 bg-accentBlue/10 text-accentBlue rounded-md text-xs font-medium border border-accentBlue/20 hover:bg-accentBlue/20 transition-colors">Grammar</button>
                  <button onClick={() => handleAnalyze('professional')} className="px-3 py-1 bg-accentPurple/10 text-accentPurple rounded-md text-xs font-medium border border-accentPurple/20 hover:bg-accentPurple/20 transition-colors">Professional</button>
                  <button onClick={() => handleAnalyze('formal')} className="px-3 py-1 bg-slate-700 text-white rounded-md text-xs font-medium border border-slate-600 hover:bg-slate-600 transition-colors">Formal</button>
                  <button onClick={() => handleAnalyze('friendly')} className="px-3 py-1 bg-success/10 text-success rounded-md text-xs font-medium border border-success/20 hover:bg-success/20 transition-colors">Friendly</button>
                  <button onClick={() => handleAnalyze('academic')} className="px-3 py-1 bg-yellow-500/10 text-yellow-500 rounded-md text-xs font-medium border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors">Academic</button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Analytics View */}
        {activeTab === 'analytics' && (() => {
          let weeklyImprovement = "0%";
          if (analytics.improvementHistory) {
            const validScores = analytics.improvementHistory.filter(h => h.score > 0);
            if (validScores.length >= 2) {
              const first = validScores[0].score;
              const last = validScores[validScores.length - 1].score;
              const diff = last - first;
              weeklyImprovement = diff > 0 ? `+${diff}%` : `${diff}%`;
            }
          }

          const dynamicCorrectionsData = [
            { name: 'Grammar', fixed: analytics.correctionsBreakdown.grammar },
            { name: 'Professional', fixed: analytics.correctionsBreakdown.professional },
            { name: 'Formal', fixed: analytics.correctionsBreakdown.formal },
            { name: 'Friendly', fixed: analytics.correctionsBreakdown.friendly },
            { name: 'Academic', fixed: analytics.correctionsBreakdown.academic },
          ];

          return (
            <div className="flex-1 overflow-y-auto p-8">
              <header className="mb-8">
                <h1 className="text-2xl font-bold mb-2">Writing Goals & Analytics</h1>
                <p className="text-slate-400">Track your progress, streaks, and mistake patterns.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-card border border-slate-800 rounded-xl p-6 relative">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-slate-400 text-sm">Daily Goal Progress</p>
                    {!isEditingGoal ? (
                        <button onClick={() => {
                            setTempGoal(analytics.dailyGoal || 500);
                            setIsEditingGoal(true);
                        }} className="text-xs text-accentBlue hover:underline">Edit Goal</button>
                    ) : (
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                value={tempGoal} 
                                onChange={(e) => setTempGoal(e.target.value)} 
                                className="w-16 bg-slate-800 text-white text-xs px-2 py-1 rounded border border-slate-700 outline-none focus:border-accentBlue"
                            />
                            <button onClick={() => {
                                setIsEditingGoal(false);
                                if (tempGoal && !isNaN(tempGoal)) {
                                    updateAnalytics({ dailyGoal: parseInt(tempGoal) });
                                }
                            }} className="text-xs text-success hover:underline">Save</button>
                            <button onClick={() => setIsEditingGoal(false)} className="text-xs text-slate-400 hover:underline">Cancel</button>
                        </div>
                    )}
                  </div>
                  <div className="flex items-end gap-2 mb-4">
                    <h3 className="text-3xl font-bold text-white">{analytics.wordsTypedToday || 0}</h3>
                    <p className="text-slate-500 mb-1">/ {analytics.dailyGoal || 500} words</p>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-accentBlue transition-all duration-500" style={{width: `${Math.min(((analytics.wordsTypedToday || 0) / (analytics.dailyGoal || 500)) * 100, 100)}%`}}></div>
                  </div>
                </div>

                <div className="bg-card border border-slate-800 rounded-xl p-6 flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Current Streak</p>
                    <h3 className="text-3xl font-bold text-orange-500">{analytics.streak || 0} Days</h3>
                  </div>
                  <div className="text-5xl">🔥</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-card border border-slate-800 rounded-xl p-6">
                  <p className="text-slate-400 text-sm mb-1">Total Words Typed</p>
                  <h3 className="text-3xl font-bold text-accentBlue">{(analytics.totalWordsTyped || 0).toLocaleString()}</h3>
                </div>
                <div className="bg-card border border-slate-800 rounded-xl p-6">
                  <p className="text-slate-400 text-sm mb-1">Total Mistakes Fixed</p>
                  <h3 className="text-3xl font-bold text-success">{(analytics.totalMistakesFixed || 0).toLocaleString()}</h3>
                </div>
                <div className="bg-card border border-slate-800 rounded-xl p-6">
                  <p className="text-slate-400 text-sm mb-1">Weekly Improvement</p>
                  <h3 className={`text-3xl font-bold ${weeklyImprovement.startsWith('+') ? 'text-success' : 'text-slate-300'}`}>{weeklyImprovement}</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card border border-slate-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-6 flex items-center gap-2"><TrendingUp size={18} className="text-accentBlue"/> Writing Improvement</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.improvementHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                        <XAxis dataKey="date" stroke="#64748B" fontSize={12} />
                        <YAxis stroke="#64748B" fontSize={12} domain={[0, 100]} />
                        <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#1E293B', borderRadius: '8px' }} />
                        <Line type="monotone" dataKey="score" stroke="#38BDF8" strokeWidth={3} dot={{ r: 4, fill: '#38BDF8' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-card border border-slate-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-6">Corrections Breakdown</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dynamicCorrectionsData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748B" fontSize={12} />
                        <YAxis stroke="#64748B" fontSize={12} />
                        <Tooltip cursor={{ fill: '#1E293B' }} contentStyle={{ backgroundColor: '#111827', borderColor: '#1E293B', borderRadius: '8px' }} />
                        <Bar dataKey="fixed" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      </main>
    </div>
  );
};

export default Dashboard;
