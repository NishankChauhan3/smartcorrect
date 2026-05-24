const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    analytics: {
        dailyGoal: { type: Number, default: 500 },
        streak: { type: Number, default: 0 },
        lastActiveDate: { type: String, default: null },
        wordsTypedToday: { type: Number, default: 0 },
        totalWordsTyped: { type: Number, default: 0 },
        totalMistakesFixed: { type: Number, default: 0 },
        correctionsBreakdown: {
            grammar: { type: Number, default: 0 },
            professional: { type: Number, default: 0 },
            formal: { type: Number, default: 0 },
            friendly: { type: Number, default: 0 },
            academic: { type: Number, default: 0 }
        },
        improvementHistory: [{
            date: { type: String }, // e.g., 'Mon', 'Tue'
            score: { type: Number }
        }]
    }
}, { timestamps: true });

userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
