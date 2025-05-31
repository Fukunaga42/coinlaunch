const { HttpStatusCode } = require("axios");
const privyClient = require("../services/privyClient");

const authenticateWithPrivy = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn("⚠️ Missing or invalid Authorization header");
      return res.status(HttpStatusCode.Unauthorized).json({
        error: "Missing or invalid Authorization header",
      });
    }

    const accessToken = authHeader.substring(7);
    const tokenClaims = await privyClient.verifyAuthToken(accessToken);
    const userProfile = await privyClient.getUserById(tokenClaims.userId);

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