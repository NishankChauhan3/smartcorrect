const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_hackathon');
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// GET /api/analytics
router.get('/', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        if (!user.analytics) {
            user.analytics = {
                totalWordsTyped: 0,
                totalMistakesFixed: 0,
                correctionsBreakdown: { grammar: 0, professional: 0, formal: 0, friendly: 0, academic: 0 },
                improvementHistory: []
            };
        }
        
        // Initialize default history if empty
        if (!user.analytics.improvementHistory || user.analytics.improvementHistory.length === 0) {
            const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            user.analytics.improvementHistory = days.map(day => ({ date: day, score: 0 }));
            await user.save();
        }
        
        res.json(user.analytics);
    } catch (err) {
        console.error("GET Analytics Error:", err.stack);
        res.status(500).send('Server Error');
    }
});

// POST /api/analytics/update
router.post('/update', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (!user.analytics) {
            user.analytics = {
                totalWordsTyped: 0,
                totalMistakesFixed: 0,
                correctionsBreakdown: { grammar: 0, professional: 0, formal: 0, friendly: 0, academic: 0 },
                improvementHistory: []
            };
        }

        const { wordsTyped, mistakeFixed, correctionType, readabilityScore, dailyGoal } = req.body;

        if (dailyGoal) {
            user.analytics.dailyGoal = dailyGoal;
        }

        const todayFull = new Date().toISOString().split('T')[0];
        if (user.analytics.lastActiveDate !== todayFull) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayFull = yesterday.toISOString().split('T')[0];

            if (user.analytics.lastActiveDate === yesterdayFull) {
                user.analytics.streak += 1;
            } else {
                user.analytics.streak = 1;
            }
            user.analytics.wordsTypedToday = 0;
            user.analytics.lastActiveDate = todayFull;
        }

        if (wordsTyped) {
            user.analytics.totalWordsTyped = Math.max(user.analytics.totalWordsTyped, wordsTyped);
            user.analytics.wordsTypedToday = Math.max(user.analytics.wordsTypedToday || 0, wordsTyped);
        }

        if (mistakeFixed) {
            user.analytics.totalMistakesFixed += 1;
            if (correctionType) {
                const lowerType = correctionType.toLowerCase();
                if (user.analytics.correctionsBreakdown[lowerType] !== undefined) {
                    user.analytics.correctionsBreakdown[lowerType] += 1;
                }
            }
        }

        if (readabilityScore) {
            const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
            let history = user.analytics.improvementHistory;
            
            // Find today's entry or the last entry
            let todayEntryIndex = history.findIndex(h => h.date === today);
            
            if (todayEntryIndex !== -1) {
                 // Simple moving average for the day
                 const currentScore = history[todayEntryIndex].score;
                 history[todayEntryIndex].score = currentScore === 0 ? readabilityScore : Math.round((currentScore + readabilityScore) / 2);
            } else {
                 // Push new day, shift old one
                 history.shift();
                 history.push({ date: today, score: readabilityScore });
            }
            user.analytics.improvementHistory = history;
        }

        user.markModified('analytics');
        await user.save();
        res.json(user.analytics);
    } catch (err) {
        console.error("POST Analytics Error:", err.stack);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
