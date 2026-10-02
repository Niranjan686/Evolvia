const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true
    },
    phone: {
        type: String,
        default: ''
    },
    company: {
        type: String,
        required: true,
        trim: true
    },
    industry: {
        type: String,
        default: 'General'
    },
    country: {
        type: String,
        default: 'Global'
    },
    city: {
        type: String,
        default: ''
    },
    source: {
        type: String,
        default: 'AI Scraper Bot'
    },
    status: {
        type: String,
        enum: ['NEW', 'STEP_1_SENT', 'STEP_2_SENT', 'STEP_3_SENT', 'REPLIED', 'CONVERTED', 'DO_NOT_CONTACT'],
        default: 'NEW'
    },
    step: {
        type: Number,
        default: 0
    },
    lastContactDate: {
        type: Date,
        default: null
    },
    nextFollowUpDate: {
        type: Date,
        default: null
    },
    history: [
        {
            date: { type: Date, default: Date.now },
            action: { type: String, required: true }, // 'PITCH_SENT', 'FOLLOWUP_SENT', 'REPLIED', etc.
            type: { type: String, default: 'EMAIL' },   // 'EMAIL', 'SMS', 'CALL'
            subject: String,
            details: String
        }
    ]
}, {
    timestamps: true
});

module.exports = mongoose.model('Lead', LeadSchema);
