require("dotenv").config();
const express = require("express");
const uploadRoute = require("./routes/upload");
const { connectDB } = require("./services/db");
const authenticateWithPrivy = require("./middleware/authenticateWithPrivy");
const Token = require("./models/Token");
const {HttpStatusCode} = require("axios");

const app = express();
const PORT = process.env.PORT || 5050;

app.use(express.json()); // MUST be above any routes using req.body

// 🔍 Log every request
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.originalUrl}`);
  next();
});

app.use("/upload-to-ipfs", uploadRoute);
app.get("/", (req, res) => {
  console.log("👋 Root route hit");
  res.send("Hackathon is up and running!");
});
  app.get("/privy", authenticateWithPrivy, async (req, res) => {
    return res.status(HttpStatusCode.Ok).json({
      success: true,
      message: "Authentication successful",
    });
  });

app.patch("/api/tokens/update/:address", async (req, res) => {
  const address = req.params.address;
  const data = req.body;

  console.log("✏️ PATCH /api/tokens/update/:address hit");
  console.log("🔎 URL param address:", address);
  console.log("📦 Body data:", JSON.stringify(data, null, 2));

  if (!address || !data) {
    console.warn("⚠️ Missing address or data");
    return res.status(400).json({ error: "Missing address or update data" });
  }

  try {
    const lowerAddress = address.toLowerCase();
    const query = { address: lowerAddress };

    console.log("🧾 updateFields:", data);

    const updateFields = {
      logo: data.logo || "",
      name: data.name || "",
      symbol: data.symbol || "",
      description: data.description || "",
      website: data.website || "",
      telegram: data.telegram || "",
      discord: data.discord || "",
      twitter: data.twitter || "",
      youtube: data.youtube || "",
    };

    console.log("🧾 updateFields:", updateFields);

    const updatedToken = await Token.findOneAndUpdate(
        query,
        {
          $set: updateFields,
          $setOnInsert: {
            address: lowerAddress,
            createdAt: new Date(),
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
    );

    console.log("✅ Token updated or created:", updatedToken.address);
    return res.status(200).json(updatedToken);
  } catch (err) {
    console.error("🔥 Error updating/creating token:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/api/tokens/trending', async (req, res) => {
  console.log('📥 GET /api/tokens/trending hit');

  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 100;

  try {
    let tokens = [];

    // Try trending first
    const trendingCount = await TrendingToken.countDocuments();
    if (trendingCount > 0) {
      console.log(`📈 Returning ${pageSize} trending tokens`);
      tokens = await TrendingToken.find()
          .sort({ rank: 1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize);
    }

    // Fallback
    if (tokens.length === 0) {
      console.log('📉 Falling back to all created tokens');
      tokens = await Token.find()
          .sort({ createdAt: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize);
    }

    res.json(tokens); // <- this matches FE expectations
  } catch (err) {
    console.error('❌ Error fetching tokens:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/tokens/creator/:creatorAddress', async (req, res) => {
  console.log('📥 GET /api/ports/getTokensByCreator hit');
  console.log('[DEBUG] Query:', req.query);
  console.log('[DEBUG] Full URL:', req.url);

  // Manually extract the creator address from the URL path
  const creatorAddress = req.url?.split('/api/tokens/creator/')[1]?.split('?')[0];

  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;

  if (!creatorAddress || typeof creatorAddress !== 'string') {
    return res.status(400).json({ error: 'creatorAddress is required in URL path' });
  }

  try {
    // Filter tokens by creator and only include those with a twitterAuthorId
    const filter = {
      creator: creatorAddress.toLowerCase(),
    };

    const total = await Token.countDocuments(filter);
    const tokens = await Token.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize);

    const responseTokens = tokens.map(token => ({
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      description: token.description,
      logo: token.logo || null,
      creator: token.creator,
      isComplete: !!token.twitterAuthorId
    }));

    res.json({
      tokens: responseTokens,
      currentPage: page,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (err) {
    console.error('❌ Error fetching tokens by creator:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('')

// Start server after DB is ready
connectDB().then(() => {
  console.log("✅ MongoDB connected");
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});
