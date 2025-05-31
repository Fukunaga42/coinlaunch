const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
    address: { type: String, required: true, unique: true },
    name: String,
    symbol: String,
    creator: String,
    logo: String,
    description: String,
    website: String,
    telegram: String,
    discord: String,
    twitter: String,
    youtube: String,
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Token', tokenSchema);
