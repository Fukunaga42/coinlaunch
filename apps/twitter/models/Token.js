const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
    address: { type: String, unique: true, sparse: true },
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
    status: { 
        type: String, 
        enum: ['AWAITING_MINT', 'MINTING', 'MINTED', 'COMMENTING', 'COMMENTED', 'FAILED', 'COMMENT_FAILED'], 
        default: 'AWAITING_MINT' 
    },
    xPostId: { type: String, unique: true, sparse: true },
    twitterUsername: String,
    twitterAuthorId: String,
    tokenImageUrl: String,
    escrowWallet: String,
    processingError: String,
    mintTransactionHash: String,
    commentTweetId: String,
    createdAt: { type: Date, default: Date.now },
    mintedAt: Date,
    commentedAt: Date,
});

module.exports = mongoose.model('Token', tokenSchema);
