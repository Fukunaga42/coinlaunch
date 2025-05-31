const { HttpStatusCode } = require("axios");
const privyClient = require("../services/privyClient");

const authenticateWithPrivy = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log("🛂 Incoming Authorization header:", authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn("⚠️ Missing or invalid Authorization header");
      return res.status(HttpStatusCode.Unauthorized).json({
        error: "Missing or invalid Authorization header",
      });
    }

    const accessToken = authHeader.substring(7);
    console.log("🔍 Access token received:", accessToken.slice(0, 20) + "...");

    const tokenClaims = await privyClient.verifyAuthToken(accessToken);
    console.log("✅ Token claims:", tokenClaims);

    const userProfile = await privyClient.getUserById(tokenClaims.userId);
    console.log("👤 Fetched user profile:", userProfile);

    req.user = userProfile;

    next();
  } catch (error) {
    console.error("🔥 Authentication failed:", error.message);
    return res.status(HttpStatusCode.Unauthorized).json({
      error: "Authentication failed",
      details: error.message,
    });
  }
};

module.exports = authenticateWithPrivy;
