const { PrivyClient } = require("@privy-io/server-auth");

const appId = process.env.PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

console.log("🔑 Initializing PrivyClient");
console.log("🆔 PRIVY_APP_ID:", appId);
console.log("🔐 PRIVY_APP_SECRET starts with:", appSecret?.slice(0, 10));

if (!appId || !appSecret) {
    throw new Error("❌ Privy credentials are not set in environment variables.");
}

const privyClient = new PrivyClient(appId, appSecret);

module.exports = privyClient;
