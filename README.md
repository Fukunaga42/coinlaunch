# CoinLaunch

Monorepo for the CoinLaunch project - A decentralized token launch platform.

## 🏗️ Architecture

This monorepo contains multiple apps and packages:

### Apps

- **`apps/api`** - Main API service (Port 5050)
  - Handles core functionality
  - IPFS uploads
  - Token management
  
- **`apps/twitter`** - Twitter integration service (Port 5051)
  - Listens for Twitter mentions
  - Creates tokens via escrow wallets
  - Posts automated replies
  - Manages fee claims

- **`apps/nextjs`** - Frontend application

### Packages

- **`packages/ui`** - Shared UI components
- **`packages/smartcontract`** - Smart contracts
- **`packages/subgraph`** - The Graph protocol integration
- **`packages/typescript-config`** - Shared TypeScript configuration
- **`packages/eslint-config`** - Shared ESLint configuration

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9.15.2+
- MongoDB
- Ethereum wallet with ETH (for Twitter service)

### Installation

```bash
# Install all dependencies
pnpm install
```

### Configuration

Each app has its own `.env` file. Copy the examples:

```bash
# API Service
cp apps/api/env.example apps/api/.env

# Twitter Service
cp apps/twitter/env.example apps/twitter/.env
```

### Development

```bash
# Start all services
pnpm dev

# Start specific services
pnpm dev:api      # API service only
pnpm dev:twitter  # Twitter service only

# Start all backend services
pnpm dev:all      # Uses custom script
```

## 📖 Documentation

- [Twitter Integration Guide](./docs/TWITTER_INTEGRATION.md) - Complete guide for Twitter service
- [API Documentation](./apps/api/README.md)
- [Smart Contracts](./packages/smartcontract/README.md)

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Test Twitter integration
pnpm test:twitter
```

## 📝 Key Features

1. **Token Creation via Twitter**: Users can create tokens by tweeting `@coinlaunchnow launch <name> <symbol>`
2. **Escrow Wallets**: Each Twitter user gets a unique wallet for minting
3. **Automated Replies**: Bot replies with contract address after minting
4. **Fee Management**: Creators can claim accumulated trading fees

## 🛠️ Development Tips

1. Use the mock mode in Twitter service for testing without API calls
2. Both services share the same MongoDB instance
3. Services communicate through the shared database
4. Check service health: `http://localhost:5050` and `http://localhost:5051`

## 📦 Build

```bash
# Build all packages
pnpm build

# Build specific app
pnpm build --filter @coinlaunch/api
```

## 🚀 Deployment

See individual app README files for deployment instructions.

## 📄 License

## run no twitter
turbo dev --filter=@coinlaunch/api --filter=coinlaunch-ui