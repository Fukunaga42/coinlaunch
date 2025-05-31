const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const OAuthToken = require("../models/OAuthToken");

class XOAuth2Service {
  static instance;
  static tokensFilePath = path.join(
    process.cwd(),
    `tokens-${process.env.NODE_ENV}.json`
  );
  static twitterOAuth2AuthorizationUrl = "https://twitter.com/i/oauth2/authorize";

  constructor() {
    this.isConfigured = false;
    
    if (
      !process.env.X_CLIENT_ID ||
      !process.env.X_CLIENT_SECRET ||
      !process.env.X_OAUTH_2_REDIRECT_URL
    ) {
      console.warn("⚠️ X_CLIENT_ID, X_CLIENT_SECRET, or X_OAUTH_2_REDIRECT_URL missing");
      console.warn("⚠️ OAuth2 features disabled - Twitter replies will not work");
      console.warn("⚠️ To enable: Set the required environment variables and restart");
      return;
    }
    
    this.isConfigured = true;
  }

  static getInstance() {
    if (!XOAuth2Service.instance) {
      XOAuth2Service.instance = new XOAuth2Service();
    }
    return XOAuth2Service.instance;
  }

  async loadUserBearerToken() {
    if (!this.isConfigured) {
      return null;
    }
    
    try {
      // In production, always use MongoDB
      if (process.env.NODE_ENV === 'production') {
        const tokenDoc = await OAuthToken.findOne({ service: 'twitter' });
        if (!tokenDoc) {
          console.log("📊 No OAuth token found in database");
          return null;
        }
        console.log("📊 OAuth token loaded from database");
        return {
          access_token: tokenDoc.access_token,
          refresh_token: tokenDoc.refresh_token,
          expires_in: tokenDoc.expires_in,
          scope: tokenDoc.scope,
          token_type: tokenDoc.token_type,
          created_at: tokenDoc.created_at.toISOString()
        };
      }
      
      // In development, use file system
      if (!fs.existsSync(XOAuth2Service.tokensFilePath)) {
        // Silent return - main.js will handle OAuth status display
        return null;
      }
      
      return JSON.parse(fs.readFileSync(XOAuth2Service.tokensFilePath, "utf8"));
    } catch (error) {
      console.error("Error loading tokens:", error);
      return null;
    }
  }

  async refreshAccessToken() {
    if (!this.isConfigured) {
      throw new Error("OAuth2 not configured");
    }
    
    try {
      const tokenData = await this.loadUserBearerToken();
      if (!tokenData) throw new Error("No tokens found");

      const refreshToken = tokenData.refresh_token;
      if (!refreshToken) throw new Error("No refresh token available");

      const basicAuthHeader = Buffer.from(
        `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
      ).toString("base64");

      const requestParams = new URLSearchParams();
      requestParams.append("grant_type", "refresh_token");
      requestParams.append("refresh_token", refreshToken);
      requestParams.append("client_id", process.env.X_CLIENT_ID);

      const response = await axios.post(
        "https://api.twitter.com/2/oauth2/token",
        requestParams,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${basicAuthHeader}`,
          },
        }
      );

      const newTokenData = {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        created_at: new Date().toISOString(),
        expires_in: response.data.expires_in,
        scope: response.data.scope,
        token_type: response.data.token_type,
      };

      await this.saveTokens(newTokenData);
      return newTokenData;
      
    } catch (error) {
      console.error("Error refreshing access token:", error.response?.data || error);
      throw new Error(error.response?.data?.error_description || "Failed to refresh token");
    }
  }

  generatePKCE() {
    const codeVerifier = crypto.randomBytes(32).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    return { codeVerifier, codeChallenge };
  }

  generateAuthUrl() {
    if (!this.isConfigured) {
      return { 
        error: "OAuth2 not configured",
        authUrl: null,
        state: null
      };
    }
    
    const { codeVerifier, codeChallenge } = this.generatePKCE();
    const sessionState = Buffer.from(`session:${codeVerifier}`).toString("base64");

    const requestParams = new URLSearchParams();
    requestParams.append("response_type", "code");
    requestParams.append("client_id", process.env.X_CLIENT_ID);
    requestParams.append("redirect_uri", process.env.X_OAUTH_2_REDIRECT_URL);
    requestParams.append("scope", "tweet.read users.read tweet.write offline.access");
    requestParams.append("state", sessionState);
    requestParams.append("code_challenge", codeChallenge);
    requestParams.append("code_challenge_method", "S256");

    const twitterAuthorizationUrl = `https://twitter.com/i/oauth2/authorize?${requestParams.toString()}`;

    return { authUrl: twitterAuthorizationUrl, state: sessionState };
  }

  async exchangeCodeForToken(code, codeVerifier) {
    if (!this.isConfigured) {
      throw new Error("OAuth2 not configured");
    }
    
    const basicAuthHeader = Buffer.from(
      `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
    ).toString("base64");

    try {
      const requestParams = new URLSearchParams();
      requestParams.append("code", code);
      requestParams.append("grant_type", "authorization_code");
      requestParams.append("client_id", process.env.X_CLIENT_ID);
      requestParams.append("redirect_uri", process.env.X_OAUTH_2_REDIRECT_URL);
      requestParams.append("code_verifier", codeVerifier);

      const response = await axios.post(
        "https://api.twitter.com/2/oauth2/token",
        requestParams,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${basicAuthHeader}`,
          },
        }
      );

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        created_at: new Date().toISOString(),
        expires_in: response.data.expires_in,
        scope: response.data.scope,
        token_type: response.data.token_type,
      };
    } catch (error) {
      console.error("Token exchange error:", error.response?.data || error);
      throw error;
    }
  }

  async saveTokens(tokenData) {
    if (!this.isConfigured) {
      return;
    }
    
    try {
      // In production, save to MongoDB
      if (process.env.NODE_ENV === 'production') {
        await OAuthToken.findOneAndUpdate(
          { service: 'twitter' },
          {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_in: tokenData.expires_in,
            scope: tokenData.scope,
            token_type: tokenData.token_type,
            created_at: new Date(tokenData.created_at || Date.now()),
            updated_at: new Date()
          },
          { upsert: true, new: true }
        );
        console.log("💾 OAuth tokens saved to database");
      } else {
        // In development, also save to file
        fs.writeFileSync(
          XOAuth2Service.tokensFilePath,
          JSON.stringify(tokenData, null, 2)
        );
        console.log("💾 OAuth tokens saved to file");
      }
    } catch (error) {
      console.error("Error saving tokens:", error);
      throw error;
    }
  }
}

module.exports = {
  getInstance: () => XOAuth2Service.getInstance()
}; 