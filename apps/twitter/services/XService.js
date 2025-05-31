const axios = require("axios");
const XOAuth2Service = require("./XOAuth2Service");
const Token = require('../models/Token');

class XService {
  static instance;
  static UserId = process.env.USER_X_ID;
  static ShouldMock = false; // Set to true for testing without real API calls
  
  constructor() {
    // Initialize OAuth2 service
    this.xOAuth2Service = XOAuth2Service.getInstance();
    
    try {
      const tokens = this.xOAuth2Service.loadUserBearerToken();
      if (!tokens) {
        console.warn("⚠️ No X/Twitter access token found - OAuth2 flow needed");
        this.userBearerToken = null;
        this.isAuthenticated = false;
      } else {
        this.userBearerToken = tokens.access_token;
        this.isAuthenticated = true;
      }
    } catch (error) {
      console.error("Error loading Twitter tokens:", error.message || "Unknown error");
      this.userBearerToken = null;
      this.isAuthenticated = false;
    }
    
    // If OAuth2 is not configured, enable mock mode automatically
    if (!this.xOAuth2Service.isConfigured) {
      console.warn("⚠️ OAuth2 not configured - Enabling MOCK mode automatically");
      XService.ShouldMock = true;
    }
    
    // Log current mode
    console.log(`🔧 XService initialized - Mode: ${XService.ShouldMock ? '🎭 MOCK' : '🌐 LIVE'}`);
    if (XService.ShouldMock) {
      console.log("🎭 Running in MOCK mode - No real API calls will be made");
    }
    
    // Create axios client for Twitter API
    this.apiClient = axios.create({
      baseURL: 'https://api.twitter.com/',
      timeout: 0
    });
    
    // Add response interceptor to log only relevant data
    this.apiClient.interceptors.response.use(
      (response) => {
        // Log only the important parts of successful responses
        if (response.config.url?.includes('stream')) {
          // Don't log stream responses as they're handled separately
          return response;
        }
        return response;
      },
      (error) => {
        // Log only the important parts of error responses
        if (error.response) {
          console.error(`❌ API Error: ${error.response.status} ${error.response.statusText}`);
          if (error.response.data) {
            console.error('Error details:', JSON.stringify(error.response.data, null, 2));
          }
        } else if (error.code === 'ECONNRESET') {
          // Connection reset - don't log the full error object
          console.error('❌ Connection reset by Twitter');
        } else {
          console.error('❌ Request error:', error.message);
        }
        return Promise.reject(error);
      }
    );
    
    // Stream configuration
    this.accountToMonitor = '@coinlaunchnow';
    this.streamUrl = '2/tweets/search/stream';
    this.rulesUrl = '2/tweets/search/stream/rules';
    this.stream = null;
  }

  static getInstance() {
    if (!XService.instance) {
      XService.instance = new XService();
    }
    return XService.instance;
  }

  async refreshAccessToken() {
    if (!this.xOAuth2Service.isConfigured) {
      console.warn("⚠️ Cannot refresh token - OAuth2 not configured");
      return;
    }
    
    const refreshUserBearerToken = await this.xOAuth2Service.refreshAccessToken();
    this.userBearerToken = refreshUserBearerToken.access_token;
    this.isAuthenticated = true;
  }

  attachUserBearerToken() {
    if (!this.userBearerToken) {
      throw new Error("No user bearer token available");
    }
    return {
      Authorization: `Bearer ${this.userBearerToken}`,
      "Content-Type": "application/json",
    };
  }

  attachAppBearerToken() {
    // Use X_APP_BEARER_TOKEN for consistency with developer's code
    const bearerToken = process.env.X_APP_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
    if (!bearerToken) {
      if (XService.ShouldMock) {
        console.warn("⚠️ No bearer token configured - Using mock mode");
        return {};
      }
      throw new Error("X_APP_BEARER_TOKEN or TWITTER_BEARER_TOKEN not configured");
    }
    return {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    };
  }

  // Validate token name and symbol
  validateTokenData(name, symbol) {
    // Token name validation
    if (!name || name.length < 2 || name.length > 32) {
      return { valid: false, error: 'Token name must be between 2 and 32 characters' };
    }
    
    // Check for special characters in name (allow only alphanumeric and spaces)
    if (!/^[a-zA-Z0-9\s]+$/.test(name)) {
      return { valid: false, error: 'Token name can only contain letters, numbers and spaces' };
    }
    
    // Token symbol validation
    if (!symbol || symbol.length < 2 || symbol.length > 10) {
      return { valid: false, error: 'Token symbol must be between 2 and 10 characters' };
    }
    
    // Symbol should be uppercase alphanumeric only
    if (!/^[A-Z0-9]+$/.test(symbol)) {
      return { valid: false, error: 'Token symbol must be uppercase letters and numbers only' };
    }
    
    return { valid: true };
  }

  // Extract token info from tweet text
  extractTokenData(tweetText) {
    // Match pattern: @coinlaunchnow launch <token_name> <token_symbol>
    const pattern = /@coinlaunchnow\s+launch\s+(.+?)\s+(\S+)$/i;
    const match = tweetText.match(pattern);
    
    if (!match) {
      return { success: false, error: 'Invalid format' };
    }

    const tokenName = match[1].trim();
    const tokenSymbol = match[2].toUpperCase();
    
    // Validate token data
    const validation = this.validateTokenData(tokenName, tokenSymbol);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    return {
      success: true,
      tokenName: tokenName,
      tokenSymbol: tokenSymbol
    };
  }

  // Setup stream rules
  async setupRules() {
    try {
      // Delete existing rules
      const getRulesResponse = await this.apiClient.get(this.rulesUrl, {
        headers: this.attachAppBearerToken()
      });

      if (getRulesResponse.data.data) {
        const ids = getRulesResponse.data.data.map(rule => rule.id);
        await this.apiClient.post(this.rulesUrl, {
          delete: { ids }
        }, {
          headers: this.attachAppBearerToken()
        });
      }

      // Add new rule
      await this.apiClient.post(this.rulesUrl, {
        add: [{
          value: '@coinlaunchnow "launch"',
          tag: 'launch-token-mentions'
        }]
      }, {
        headers: this.attachAppBearerToken()
      });

      console.log('✅ Twitter stream rules configured');
    } catch (error) {
      console.error('❌ Error setting up rules:', error.response?.data || error.message || error);
    }
  }

  // Process incoming tweet
  async processTweet(tweet) {
    console.log('📨 Processing tweet:', tweet.data.id);
    console.log('📝 Tweet text:', tweet.data.text);
    
    const extraction = this.extractTokenData(tweet.data.text);
    
    if (!extraction.success) {
      console.log('❌ Invalid tweet format:', extraction.error);
      return;
    }

    try {
      // Check if token already exists for this tweet
      const existingToken = await Token.findOne({ xPostId: tweet.data.id });
      if (existingToken) {
        console.log('⚠️ Token already exists for this tweet');
        return;
      }

      // Check if token name or symbol already exists
      const existingName = await Token.findOne({ 
        name: extraction.tokenName,
        status: { $ne: 'FAILED' }
      });
      
      if (existingName) {
        console.log('❌ Token name already exists:', extraction.tokenName);
        return;
      }

      const existingSymbol = await Token.findOne({ 
        symbol: extraction.tokenSymbol,
        status: { $ne: 'FAILED' }
      });
      
      if (existingSymbol) {
        console.log('❌ Token symbol already exists:', extraction.tokenSymbol);
        return;
      }

      // Get author info
      const authorId = tweet.data.author_id;
      let userData;
      
      if (XService.ShouldMock) {
        userData = {
          id: authorId,
          username: tweet.includes?.users?.[0]?.username || 'mockuser',
          profile_image_url: tweet.includes?.users?.[0]?.profile_image_url || 'https://example.com/mock.jpg'
        };
      } else {
        const userResponse = await this.apiClient.get(
          `2/users/${authorId}?user.fields=profile_image_url,username`,
          {
            headers: this.attachAppBearerToken()
          }
        );
        userData = userResponse.data.data;
      }

      // Get tweet attachments if any
      let tokenImageUrl = userData.profile_image_url;
      
      if (tweet.includes?.media) {
        const imageMedia = tweet.includes.media.find(m => m.type === 'photo');
        if (imageMedia) {
          tokenImageUrl = imageMedia.url;
          console.log('📷 Using image from tweet:', tokenImageUrl);
        }
      }

      // Create token record with AWAITING_MINT status
      const newToken = new Token({
        name: extraction.tokenName,
        symbol: extraction.tokenSymbol,
        creator: null, // Will be set when minted
        status: 'AWAITING_MINT',
        xPostId: tweet.data.id,
        twitterUsername: userData.username,
        twitterAuthorId: authorId,
        tokenImageUrl: tokenImageUrl,
        createdAt: new Date()
      });

      await newToken.save();
      console.log('✅ Token saved to DB with AWAITING_MINT status:', newToken._id);
      console.log('📊 Token details:', {
        name: newToken.name,
        symbol: newToken.symbol,
        twitterUser: newToken.twitterUsername,
        status: newToken.status
      });

      // DBListenerService will pick it up and process it

    } catch (error) {
      console.error('❌ Error processing tweet:', error.message || error);
    }
  }

  // Start listening to Twitter stream
  async startStream() {
    const bearerToken = process.env.X_APP_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;
    if (!bearerToken && !XService.ShouldMock) {
      console.error('❌ Twitter Bearer Token not set - cannot start stream');
      console.warn('💡 Tip: Enable mock mode by setting XService.ShouldMock = true');
      throw new Error('X_APP_BEARER_TOKEN or TWITTER_BEARER_TOKEN environment variable is required');
    }
    
    // Mock mode for testing
    if (XService.ShouldMock) {
      console.log('🎭 Running in MOCK mode - simulating Twitter stream');
      // Simulate incoming tweets for testing
      setInterval(() => {
        const mockTweet = {
          data: {
            id: `mock_${Date.now()}`,
            text: '@coinlaunchnow launch MockToken MOCK',
            author_id: 'mock_user_123',
            created_at: new Date().toISOString()
          },
          includes: {
            users: [{
              id: 'mock_user_123',
              username: 'mockuser',
              profile_image_url: 'https://example.com/mock.jpg'
            }]
          }
        };
        console.log('🎭 Mock tweet received');
        this.processTweet(mockTweet);
      }, 30000); // Every 30 seconds
      return;
    }
    
    await this.setupRules();

    const streamUrl = `${this.streamUrl}?tweet.fields=author_id,created_at&expansions=author_id,attachments.media_keys&media.fields=url,type`;
    
    const streamResponse = await this.apiClient.get(streamUrl, {
      headers: this.attachAppBearerToken(),
      responseType: 'stream'
    });

    this.stream = streamResponse.data;
    let buffer = '';

    this.stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.data) {
              this.processTweet(data);
            }
          } catch (error) {
            console.error('Error parsing tweet:', error.message || error);
          }
        }
      }
    });

    this.stream.on('error', (error) => {
      // Extract only the important error information
      const errorInfo = {
        message: error.message,
        code: error.code,
        type: error.constructor.name
      };
      
      console.error('Stream error:', errorInfo);
      
      // Reconnect after 5 seconds
      setTimeout(() => this.startStream(), 5000);
    });

    console.log('🎧 Twitter stream started');
  }

  // Stop the stream
  stopStream() {
    if (this.stream) {
      this.stream.destroy();
      console.log('🛑 Twitter stream stopped');
    }
  }

  // Post a reply to a tweet
  async replyToTweet(options) {
    try {
      // Mock mode
      if (XService.ShouldMock) {
        console.log('🎭 MOCK: Would reply to tweet');
        return {
          data: {
            id: `mock_reply_${Date.now()}`,
            text: options.text
          }
        };
      }

      if (!this.isAuthenticated) {
        console.warn("⚠️ Not authenticated - Cannot reply to tweets");
        console.warn("💡 Complete OAuth2 flow at /api/twitter/login");
        return { error: "Not authenticated" };
      }

      if (!options?.reply?.in_reply_to_tweet_id || !options?.text) {
        return { error: "Post ID and message are required to reply" };
      }

      const xPayload = {
        text: options.text,
        reply: {
          in_reply_to_tweet_id: options.reply.in_reply_to_tweet_id,
        },
      };

      if (options.media?.media_ids) {
        xPayload.media = { media_ids: options.media.media_ids };
      }

      const response = await this.apiClient.post(
        "2/tweets",
        xPayload,
        {
          headers: this.attachUserBearerToken(),
        }
      );
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        console.log(`${this.constructor.name} - Token expired or invalid:`, error.response.data);
        await this.refreshAccessToken();
        return this.replyToTweet(options);
      }
      
      console.error(`${this.constructor.name} - Error replying to post:`, error.message || error);
      return {
        error: "Failed to reply to post",
        details: error.response?.data || error.message,
      };
    }
  }

  // Get user profile
  async getUserProfile(username) {
    try {
      // Mock mode
      if (XService.ShouldMock) {
        return {
          id: 'mock_user_123',
          username: username,
          name: 'Mock User',
          profile_image_url: 'https://example.com/mock.jpg'
        };
      }

      const queryParams = new URLSearchParams();
      queryParams.append(
        "user.fields",
        "name,profile_banner_url,profile_image_url,public_metrics"
      );
      queryParams.append("usernames", username);

      const response = await this.apiClient.get(
        `2/users/by?${queryParams.toString()}`,
        {
          headers: this.attachAppBearerToken(),
        }
      );
      
      return response.data.data[0];
    } catch (error) {
      console.error(`${this.constructor.name} - Error retrieving user profile:`, error.message || error);
      throw {
        error: "Failed to retrieve user profile",
        details: error.response?.data || error.message,
      };
    }
  }

  // Check if authenticated
  isUserAuthenticated() {
    return this.isAuthenticated && !XService.ShouldMock;
  }
}

module.exports = XService; 