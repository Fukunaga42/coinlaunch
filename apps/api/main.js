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


// Start server after DB is ready
connectDB().then(() => {
  console.log("✅ MongoDB connected");
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});
