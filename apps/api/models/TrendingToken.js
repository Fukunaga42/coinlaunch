const mongoose = require('mongoose');

const trendingTokenSchema = new mongoose.Schema({
    contractAddress: String,
    name: String,
    symbol: String,
    rank: Number,
    score: Number,
    volume: Number,
    logo: String,
    createdAt: Date
});

module.exports = mongoose.model('TrendingToken', trendingTokenSchema);
