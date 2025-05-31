const xOAuth2Service = require('../services/XOAuth2Service').getInstance();
const XService = require('../services/XService');

class AuthController {
  // Generate OAuth2 login URL
  static generateAuthUrl(req, res) {
    try {
      if (!xOAuth2Service.isConfigured) {
        return res.status(503).json({
          success: false,
          error: "OAuth2 not configured",
          message: "Please set X_CLIENT_ID, X_CLIENT_SECRET, and X_OAUTH_2_REDIRECT_URL environment variables"
        });
      }
      
      const { authUrl, state } = xOAuth2Service.generateAuthUrl();
      
      if (authUrl) {
        // Store state in session or temporary storage if needed
        res.json({
          success: true,
          authUrl,
          state
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to generate auth URL"
        });
      }
    } catch (error) {
      console.error('Error generating auth URL:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Handle OAuth2 callback
  static async handleCallback(req, res) {
    try {
      if (!xOAuth2Service.isConfigured) {
        return res.status(503).json({
          success: false,
          error: "OAuth2 not configured"
        });
      }
      
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.status(400).json({
          success: false,
          error: "Missing code or state parameter"
        });
      }
      
      // Extract code verifier from state
      const codeVerifier = Buffer.from(state, 'base64').toString().replace('session:', '');
      
      // Exchange code for token
      const tokenData = await xOAuth2Service.exchangeCodeForToken(code, codeVerifier);
      
      // Save tokens
      await xOAuth2Service.saveTokens(tokenData);
      
      // Refresh XService instance to use new tokens
      const xService = XService.getInstance();
      await xService.initializeOAuth();
      
      res.send(`
        <html>
          <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
            <div style="text-align: center;">
              <h1>✅ Authentication Successful!</h1>
              <p>Twitter OAuth2 has been configured successfully.</p>
              <p>You can now close this window and the service will start posting replies to tweets.</p>
              <script>
                setTimeout(() => {
                  window.close();
                }, 5000);
              </script>
            </div>
          </body>
        </html>
      `);
      
    } catch (error) {
      console.error("Error exchanging code for token:", error);
      res.status(500).send("Authentication failed. Please try again.");
    }
  }

  // Check authentication status
  static async checkAuthStatus(req, res) {
    try {
      const isConfigured = xOAuth2Service.isConfigured;
      const tokens = await xOAuth2Service.loadUserBearerToken();
      const hasTokens = !!tokens;
      
      res.json({
        authenticated: hasTokens,
        configured: isConfigured,
        hasTokens: hasTokens,
        tokenCreatedAt: tokens ? tokens.created_at : null
      });
    } catch (error) {
      console.error('Error checking auth status:', error);
      res.status(500).json({ error: 'Failed to check authentication status' });
    }
  }
}

module.exports = AuthController; 