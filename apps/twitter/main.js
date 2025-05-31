require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const XService = require("./services/XService");
const TokenMinterService = require("./services/tokenMinter");
const TwitterCommenterService = require("./services/twitterCommenter");
const DBListenerService = require("./services/dbListenerService");
const EscrowWalletService = require("./services/escrowWalletService");
const AuthController = require("./controllers/authController");

const app = express();
const PORT = process.env.PORT || process.env.TWITTER_SERVICE_PORT || 5051; // Use Heroku's PORT first

// Initialize services
let xService = null;
let dbListener = null;
const tokenMinter = new TokenMinterService();
const twitterCommenter = new TwitterCommenterService();
const escrowWallet = new EscrowWalletService();

app.use(express.json());

// 🔍 Log every request
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.originalUrl}`);
  next();
});

// Health check
app.get("/", (req, res) => {
  res.json({ 
    service: "CoinLaunch Twitter Service",
    status: "running",
    mock: XService.ShouldMock || false
  });
});

// Twitter OAuth2 routes
app.get("/auth/twitter/login", AuthController.generateAuthUrl);
app.get("/auth/twitter/callback", AuthController.handleCallback);
app.get("/auth/twitter/status", AuthController.checkAuthStatus);

// Claim fees endpoints - Simplified without Privy
// NOTE: These endpoints are temporarily simplified. 
// Another team is building the Privy authentication part.
app.get("/claim-fees/check/:twitterUsername", async (req, res) => {
  try {
    const { twitterUsername } = req.params;
    
    console.log(`💰 Checking claimable fees for @${twitterUsername}`);
    
    // TODO: When Privy integration is ready, verify ownership
    // For now, just return the claimable info
    const claimableInfo = await escrowWallet.getClaimableFees(twitterUsername);
    
    res.json({
      success: true,
      warning: "Authentication not implemented yet",
      ...claimableInfo
    });
    
  } catch (error) {
    console.error("Error checking claimable fees:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/claim-fees/claim", async (req, res) => {
  try {
    const { twitterUsername, destinationAddress } = req.body;
    
    if (!twitterUsername || !destinationAddress) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    console.log(`💸 Processing claim for @${twitterUsername} to ${destinationAddress}`);
    
    // TODO: When Privy integration is ready, verify ownership
    // For now, return error
    res.status(501).json({ 
      error: "Claim functionality not available yet",
      message: "Privy authentication integration pending"
    });
    
  } catch (error) {
    console.error("Error claiming fees:", error);
    res.status(500).json({ error: error.message });
  }
});

// Testing endpoints (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.post("/test/mint-token", async (req, res) => {
    try {
      const { tokenId, name, symbol, imageUrl, xPostId } = req.body;

      if (!tokenId || !name || !symbol) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      tokenMinter.mintToken({ tokenId, name, symbol, imageUrl, xPostId })
        .then(result => {
          console.log("✅ Minting completed:", result);
        })
        .catch(error => {
          console.error("❌ Minting error:", error);
        });

      res.status(200).json({ 
        success: true, 
        message: "Minting process started",
        tokenId 
      });

    } catch (error) {
      console.error("❌ Error in /test/mint-token:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/test/comment-tweet", async (req, res) => {
    try {
      const { tokenId, tokenAddress } = req.body;

      if (!tokenId || !tokenAddress) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      twitterCommenter.commentOnTweet(tokenId, tokenAddress)
        .then(result => {
          console.log("✅ Comment posted:", result);
        })
        .catch(error => {
          console.error("❌ Comment error:", error);
        });

      res.status(200).json({ 
        success: true, 
        message: "Comment process started" 
      });

    } catch (error) {
      console.error("❌ Error in /test/comment-tweet:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
}

// Connect to MongoDB and start services
async function startService() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.MONGO_DB_NAME || 'coinlaunch'
    });
    console.log("✅ MongoDB connected");
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Twitter Service running on http://localhost:${PORT}`);
      
      // Check Twitter OAuth2 authentication status
      try {
        xService = XService.getInstance();
        if (xService.isUserAuthenticated()) {
          console.log("✅ Twitter OAuth2 authenticated - ready to post replies");
        } else if (!XService.ShouldMock) {
          console.log("⚠️ Twitter OAuth2 not authenticated - visit http://localhost:" + PORT + "/auth/twitter/login");
        }
      } catch (error) {
        console.error("❌ Error checking Twitter auth:", error);
      }
      
      // Start DB Listener Service
      if (process.env.ENABLE_DB_LISTENER !== 'false') {
        console.log("🔄 Starting DB Listener Service...");
        dbListener = new DBListenerService(tokenMinter, twitterCommenter);
        dbListener.start();
      } else {
        console.log("⚠️ DB Listener disabled (set ENABLE_DB_LISTENER=true to enable)");
      }
      
      // Start Twitter listener if enabled
      if (process.env.ENABLE_TWITTER_LISTENER === 'true') {
        console.log("🐦 Starting Twitter stream listener...");
        xService.startStream()
          .catch(error => console.error("❌ Failed to start Twitter stream:", error));
      } else {
        console.log("⚠️ Twitter stream disabled (set ENABLE_TWITTER_LISTENER=true to enable)");
      }
    });
    
  } catch (error) {
    console.error("❌ Failed to start Twitter Service:", error);
    process.exit(1);
  }
}

// Start the service
startService();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  if (xService) {
    xService.stopStream();
  }
  
  if (dbListener) {
    dbListener.stop();
  }
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}); 