const { PrivyClient } = require("@privy-io/server-auth");

if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
    throw new Error("Privy credentials are not set in environment variables.");
}


const privyClient = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
);


module.exports = privyClient;
