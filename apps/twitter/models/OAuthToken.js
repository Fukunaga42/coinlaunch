const mongoose = require('mongoose');

const oAuthTokenSchema = new mongoose.Schema({
  service: {
    type: String,
    required: true,
    enum: ['twitter'],
    default: 'twitter'
  },
  access_token: {
    type: String,
    required: true
  },
  refresh_token: {
    type: String,
    required: true
  },
  token_type: {
    type: String,
    default: 'Bearer'
  },
  expires_in: {
    type: Number
  },
  scope: {
    type: String
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Index unique pour s'assurer qu'il n'y a qu'un seul token Twitter
oAuthTokenSchema.index({ service: 1 }, { unique: true });

// Méthode pour vérifier si le token est expiré
oAuthTokenSchema.methods.isExpired = function() {
  if (!this.expires_in) return false;
  const expirationTime = new Date(this.created_at).getTime() + (this.expires_in * 1000);
  return Date.now() > expirationTime;
};

const OAuthToken = mongoose.model('OAuthToken', oAuthTokenSchema);

module.exports = OAuthToken; 