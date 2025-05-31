const mongoose = require('mongoose');
const crypto = require('crypto');

// IMPORTANT: In production, use a proper key management service (AWS KMS, HashiCorp Vault, etc.)
const ENCRYPTION_KEY = process.env.ESCROW_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;

const escrowWalletSchema = new mongoose.Schema({
    twitterUsername: { 
        type: String, 
        required: true, 
        unique: true,
        index: true 
    },
    address: { 
        type: String, 
        required: true,
        unique: true 
    },
    encryptedPrivateKey: {
        type: String,
        required: true
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    lastUsedAt: Date,
    totalFeesCollected: {
        type: String,
        default: "0"
    }
});

// Encrypt private key before saving
escrowWalletSchema.statics.encryptPrivateKey = function(privateKey) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
        'aes-256-cbc', 
        Buffer.from(ENCRYPTION_KEY, 'hex'), 
        iv
    );
    
    let encrypted = cipher.update(privateKey);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

// Decrypt private key
escrowWalletSchema.statics.decryptPrivateKey = function(encryptedData) {
    const textParts = encryptedData.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    
    const decipher = crypto.createDecipheriv(
        'aes-256-cbc', 
        Buffer.from(ENCRYPTION_KEY, 'hex'), 
        iv
    );
    
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
};

module.exports = mongoose.model('EscrowWallet', escrowWalletSchema); 