require("dotenv").config();
const express = require("express");
const uploadRoute = require("./routes/upload");
const { connectDB } = require("./services/db");
const authenticateWithPrivy = require("./middleware/authenticateWithPrivy");

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
// Start server after DB is ready
connectDB().then(() => {
  console.log("✅ MongoDB connected");
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});
