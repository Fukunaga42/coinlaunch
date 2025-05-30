require("dotenv").config();
const express = require("express");
const uploadRoute = require("./routes/upload");
const { connectDB } = require("./services/db");

const app = express();
const PORT = process.env.PORT || 5050;

app.use(express.json()); // MUST be above any routes using req.body

// 🔍 Log every request
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.originalUrl}`);
  next();
});

// Route mounting
app.use("/upload-to-ipfs", uploadRoute);
app.get("/", (req, res) => {
  console.log("👋 Root route hit");
  res.send("Hackathon is up and running!");
});

// Start server after DB is ready
connectDB().then(() => {
  console.log("✅ MongoDB connected");
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});
