const mongoose = require('mongoose');

const VocabularyWordSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    word: {
        type: String,
        required: true,
        trim: true
    },
    meaning: {
        type: String,
        required: true
    },
    examples: {
        type: [String],
        default: []
    },
    source: {
        type: String,
        default: 'grammar'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

VocabularyWordSchema.index({ user: 1, word: 1 }, { unique: true });

module.exports = mongoose.model('VocabularyWord', VocabularyWordSchema);
