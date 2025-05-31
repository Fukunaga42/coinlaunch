# CoinLaunch Twitter Service

This service handles Twitter integration for CoinLaunch - monitoring Twitter mentions to create tokens and posting replies with contract addresses.

## Features

- 🐦 **Twitter Streaming**: Monitors mentions of @coinlaunchnow in real-time
- 🔄 **OAuth2 Authentication**: Full OAuth2 flow for posting replies
- 💰 **Escrow Wallets**: Creates encrypted wallets for each Twitter user
- 🏦 **Fee Management**: Tracks claimable fees for token creators
- 🚀 **Auto-minting**: Automatically mints tokens when valid launch tweets are detected

## Architecture

```
Twitter Stream API → XService → Database → DBListener → TokenMinter → Twitter Reply
                                                     ↓
                                              Escrow Wallet
```

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp env.example .env
   # Edit .env with your values
   ```

3. **Set up MongoDB**:
   - Ensure MongoDB is running locally or provide a remote URI
   - The service will create required collections automatically

4. **Twitter OAuth2 Setup**:
   - Create a Twitter App at https://developer.twitter.com
   - Set OAuth 2.0 settings with callback URL: `http://localhost:5051/auth/twitter/callback`
   - Add your Client ID and Client Secret to `.env`

5. **Start the service**:
   ```bash
   npm start
   ```

6. **Authenticate with Twitter**:
   - Visit `http://localhost:5051/auth/twitter/login`
   - Complete the OAuth2 flow
   - The service will save tokens for posting replies

## API Endpoints

### Health & Status
- `GET /` - Health check
- `GET /auth/twitter/status` - Check Twitter authentication status

### Twitter OAuth2
- `GET /auth/twitter/login` - Start OAuth2 flow
- `GET /auth/twitter/callback` - OAuth2 callback (handled automatically)

### Fee Management (Pending Authentication)
- `GET /claim-fees/check/:twitterUsername` - Check claimable fees
- `POST /claim-fees/claim` - Claim accumulated fees (Not implemented - waiting for authentication module)

### Testing (Dev Only)
- `POST /test/mint-token` - Manually trigger token minting
- `POST /test/comment-tweet` - Test Twitter reply functionality

## Environment Variables

```env
# Service Configuration
TWITTER_SERVICE_PORT=5051

# MongoDB
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=coinlaunch

# Ethereum
ETHEREUM_RPC_URL=https://base.publicnode.com
FUNDING_PRIVATE_KEY=<wallet_private_key_for_gas_funding>

# Contract
BONDING_CURVE_MANAGER_ADDRESS=<deployed_contract_address>

# Escrow Encryption
ESCROW_ENCRYPTION_KEY=<32_character_encryption_key>

# Twitter OAuth2
X_CLIENT_ID=<your_twitter_client_id>
X_CLIENT_SECRET=<your_twitter_client_secret>
X_OAUTH_2_REDIRECT_URL=http://localhost:5051/auth/twitter/callback

# Feature Flags
ENABLE_TWITTER_LISTENER=true
ENABLE_DB_LISTENER=true
```

## How It Works

1. **Twitter Mention Detection**:
   - Users tweet "@coinlaunchnow launch TokenName SYMBOL"
   - XService detects the mention via Twitter Stream API
   - Creates a token record in MongoDB with status AWAITING_MINT

2. **Token Minting**:
   - DBListener polls for AWAITING_MINT tokens
   - Creates/retrieves escrow wallet for the Twitter user
   - Funds escrow wallet with gas if needed
   - Mints token from escrow wallet (creator = escrow wallet)
   - Updates token status to MINTED

3. **Twitter Reply**:
   - TwitterCommenter uses OAuth2 tokens to reply
   - Posts contract address as a reply to original tweet

4. **Fee Collection**:
   - Trading fees accumulate in escrow wallets
   - Users can check claimable fees (authentication pending)
   - Users can claim fees to their wallet (authentication pending)

## Testing

Run the test suite:
```bash
npm test
```

This will run `test-system.js` which verifies:
- MongoDB connection
- Twitter OAuth2 authentication
- Escrow wallet creation and encryption
- Token minting simulation
- Twitter commenting simulation

## Notes

- **Authentication Module**: The fee claiming functionality requires user authentication which is being developed by another team
- **Mock Mode**: Set `X_MOCK_MODE=true` to test without real Twitter API calls
- **Gas Management**: Ensure funding wallet has sufficient ETH for gas fees

## Troubleshooting

### Twitter Auth Issues
- Ensure OAuth2 callback URL matches exactly
- Check Client ID and Secret are correct
- Delete `tokens-development.json` to reset auth

### Minting Failures
- Verify contract address is deployed on the correct network
- Check funding wallet has ETH
- Ensure RPC URL is accessible

### MongoDB Connection
- Verify MongoDB is running
- Check connection string in `.env`
- Ensure database user has write permissions 