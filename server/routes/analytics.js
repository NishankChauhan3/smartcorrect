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

const syncImprovementHistory = (history) => {
    const newHistory = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
        const oldEntry = history && history.find(h => h.date === dayStr);
        newHistory.push({ date: dayStr, score: oldEntry ? oldEntry.score : 0 });
    }
    return newHistory;
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
        
        user.analytics.improvementHistory = syncImprovementHistory(user.analytics.improvementHistory);
        user.markModified('analytics');
        await user.save();
        
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

        const { wordsAdded, mistakeFixed, correctionType, readabilityScore, dailyGoal } = req.body;

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

        if (wordsAdded) {
            user.analytics.totalWordsTyped = (user.analytics.totalWordsTyped || 0) + wordsAdded;
            user.analytics.wordsTypedToday = (user.analytics.wordsTypedToday || 0) + wordsAdded;
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
            user.analytics.improvementHistory = syncImprovementHistory(user.analytics.improvementHistory);
            
            const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
            let history = user.analytics.improvementHistory;
            
            // Because we synced, the last element is always today
            let todayEntry = history[history.length - 1];
            
            if (todayEntry.date === today) {
                 // Simple moving average for the day
                 const currentScore = todayEntry.score;
                 todayEntry.score = currentScore === 0 ? readabilityScore : Math.round((currentScore + readabilityScore) / 2);
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
