# CoinLaunch Twitter Service

Cette app gère l'intégration Twitter pour CoinLaunch, permettant la création de tokens via des mentions Twitter.

## 🚀 Fonctionnalités

- **Écoute des mentions Twitter** : Détecte `@coinlaunchnow launch <name> <symbol>`
- **Création automatique de tokens** : Via escrow wallets uniques par utilisateur
- **Commentaires automatiques** : Répond avec l'adresse du contrat
- **Système de claim fees** : Les créateurs peuvent réclamer leurs fees accumulés

## 📋 Prérequis

- Node.js 18+
- MongoDB (partagé avec l'app API principale)
- Compte Twitter Developer avec API v2
- Wallet Ethereum avec ETH pour financer les escrow wallets

## 🔧 Installation

Depuis la racine du monorepo :

```bash
# Installer les dépendances
pnpm install

# Ou pour cette app uniquement
cd apps/twitter
npm install
```

## ⚙️ Configuration

1. Copiez `env.example` vers `.env` :
   ```bash
   cp env.example .env
   ```

2. Remplissez les variables d'environnement (voir env.example)

## 🏃 Démarrage

### Depuis la racine du monorepo :
```bash
pnpm dev --filter @coinlaunch/twitter
```

### Ou directement :
```bash
cd apps/twitter
npm run dev
```

## 🔗 Intégration avec les autres apps

### Partage de la base de données

Cette app partage MongoDB avec l'app API principale. Les modèles `Token` et `EscrowWallet` sont utilisés par les deux services.

### Communication entre services

- **API principale** (port 5050) : Gère les tokens, trading, etc.
- **Twitter Service** (port 5051) : Gère l'intégration Twitter

Les deux services peuvent accéder aux mêmes données dans MongoDB.

## 📡 Endpoints

### OAuth2 Twitter
- `GET /auth/twitter/login` - Initier l'authentification
- `GET /auth/twitter/callback` - Callback OAuth2
- `GET /auth/twitter/status` - Vérifier le statut

### Claim Fees (Requiert auth Privy)
- `GET /claim-fees/check/:twitterUsername` - Vérifier les fees
- `POST /claim-fees/claim` - Réclamer les fees

### Test (Dev only)
- `POST /test/mint-token` - Tester le minting
- `POST /test/comment-tweet` - Tester les commentaires

## 🧪 Mode Mock

Pour tester sans API Twitter réelle, dans `services/XService.js` :
```javascript
static ShouldMock = true;
```

## 🏗️ Architecture

```
apps/twitter/
├── services/           # Services métier
│   ├── XService.js     # Intégration Twitter
│   ├── dbListenerService.js # Polling DB
│   ├── tokenMinter.js  # Minting sur Ethereum
│   └── escrowWalletService.js # Gestion des wallets
├── models/            # Modèles MongoDB
├── controllers/       # Controllers Express
├── middleware/        # Middleware (Privy auth)
└── abi/              # Smart contract ABIs
```

## 🔐 Sécurité

- Les clés privées des escrow wallets sont chiffrées en DB
- OAuth2 pour poster des réponses Twitter
- Authentification Privy pour les claim fees

## 📝 Notes

- Ce service peut tourner indépendamment ou avec l'API principale
- Les tokens OAuth2 sont stockés dans `tokens-{NODE_ENV}.json`
- Le DB polling vérifie toutes les 5 secondes par défaut 