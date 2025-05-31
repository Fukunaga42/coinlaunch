const xOAuth2Service = require('../services/XOAuth2Service').getInstance();

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
      
      // Exchange code for tokens
      const tokens = await xOAuth2Service.exchangeCodeForToken(code, codeVerifier);
      
      // Save tokens
      xOAuth2Service.saveTokens(tokens);
      
      // Redirect to success page or return success response
      res.send(`
        <html>
          <head>
            <title>Twitter OAuth Success</title>
            <style>
              body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f0f0; }
              .container { text-align: center; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              h1 { color: #1DA1F2; }
              p { color: #333; margin: 20px 0; }
              .close-btn { background: #1DA1F2; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>✅ Authentication Successful!</h1>
              <p>Twitter OAuth2 has been configured successfully.</p>
              <p>You can now close this window and return to the application.</p>
              <button class="close-btn" onclick="window.close()">Close Window</button>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.status(500).send(`
        <html>
          <head>
            <title>Authentication Error</title>
            <style>
              body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f0f0; }
              .container { text-align: center; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              h1 { color: #E1444D; }
              p { color: #333; margin: 20px 0; }
              pre { background: #f5f5f5; padding: 10px; border-radius: 5px; text-align: left; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ Authentication Failed</h1>
              <p>There was an error during the authentication process:</p>
              <pre>${error.message}</pre>
            </div>
          </body>
        </html>
      `);
    }
  }

  // Check authentication status
  static checkAuthStatus(req, res) {
    try {
      if (!xOAuth2Service.isConfigured) {
        return res.json({
          authenticated: false,
          configured: false,
          message: "OAuth2 not configured - Please set environment variables"
        });
      }
      
      const tokens = xOAuth2Service.loadUserBearerToken();
      const isAuthenticated = !!tokens?.access_token;
      
      res.json({
        authenticated: isAuthenticated,
        configured: true,
        hasTokens: !!tokens,
        tokenCreatedAt: tokens?.created_at || null
      });
    } catch (error) {
      console.error('Error checking auth status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = AuthController; 