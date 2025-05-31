# Guide de Déploiement Heroku pour CoinLaunch

## 📱 Applications

1. **coinlaunch-twitter** - Service Twitter (worker dyno)
2. **coinlaunch** - API principale (web dyno)

## 🚀 Déploiement Rapide

```bash
# Depuis le répertoire coinlaunch/
chmod +x deploy-heroku.sh
./deploy-heroku.sh
```

## 🔧 Configuration Manuelle

### Option 1: Déploiement avec Git Subtree (Recommandé)

```bash
# Depuis le répertoire racine coinlaunch/

# Pour l'app Twitter
heroku git:remote -a coinlaunch-twitter
git subtree push --prefix=apps/twitter heroku main

# Pour l'app API
heroku git:remote -a coinlaunch
git subtree push --prefix=apps/api heroku main
```

### Option 2: Déploiement avec repos séparés

```bash
# Pour l'app Twitter
cd apps/twitter
git init
heroku git:remote -a coinlaunch-twitter
git add .
git commit -m "Deploy Twitter service"
git push heroku main

# Pour l'app API
cd apps/api
git init
heroku git:remote -a coinlaunch
git add .
git commit -m "Deploy API service"
git push heroku main
```

## 🔐 Variables d'Environnement

### Pour coinlaunch-twitter (Twitter Service)

```bash
heroku config:set -a coinlaunch-twitter \
  NODE_ENV=production \
  PORT=5051 \
  MONGODB_URI="mongodb+srv://..." \
  X_APP_BEARER_TOKEN="Bearer ..." \
  X_CLIENT_ID="..." \
  X_CLIENT_SECRET="..." \
  X_OAUTH_2_REDIRECT_URL="https://coinlaunch-twitter.herokuapp.com/auth/twitter/callback" \
  INFURA_URL="https://mainnet.infura.io/v3/..." \
  ESCROW_ENCRYPTION_KEY="..." \
  FUNDING_PRIVATE_KEY="0x..." \
  TOKEN_FACTORY_ADDRESS="0x..." \
  MINTER_SERVICE_URL="http://localhost:5052" \
  API_URL="https://coinlaunch.herokuapp.com"
```

### Pour coinlaunch (API Service)

```bash
heroku config:set -a coinlaunch \
  NODE_ENV=production \
  PORT=5001 \
  MONGODB_URI="mongodb+srv://..." \
  PRIVY_APP_ID="..." \
  PRIVY_APP_SECRET="..." \
  IPFS_GATEWAY_URL="https://gateway.pinata.cloud/ipfs/"
```

## 📊 Scaling et Dynos

### Twitter Service (Worker)
```bash
# Activer le worker dyno
heroku ps:scale worker=1 -a coinlaunch-twitter

# Désactiver le web dyno (pas nécessaire)
heroku ps:scale web=0 -a coinlaunch-twitter
```

### API Service (Web)
```bash
# S'assurer que le web dyno est actif
heroku ps:scale web=1 -a coinlaunch
```

## 🔍 Monitoring

### Logs en temps réel
```bash
# Twitter service
heroku logs --tail -a coinlaunch-twitter

# API service
heroku logs --tail -a coinlaunch
```

### Status des dynos
```bash
heroku ps -a coinlaunch-twitter
heroku ps -a coinlaunch
```

## 🛠️ Dépannage

### Erreur "No app specified"
```bash
# Spécifiez l'app avec -a
heroku logs -a coinlaunch-twitter
```

### Erreur de build
```bash
# Vérifier les buildpacks
heroku buildpacks -a coinlaunch-twitter
heroku buildpacks -a coinlaunch

# Si nécessaire, ajouter Node.js buildpack
heroku buildpacks:set heroku/nodejs -a coinlaunch-twitter
```

### Service ne démarre pas
1. Vérifier les logs : `heroku logs --tail -a [app-name]`
2. Vérifier les variables d'env : `heroku config -a [app-name]`
3. Redémarrer : `heroku restart -a [app-name]`

## 🔄 Mise à jour

Pour mettre à jour après des changements :

```bash
# Option 1: Avec le script
./deploy-heroku.sh

# Option 2: Manuellement pour Twitter
git subtree push --prefix=apps/twitter heroku main --force

# Option 2: Manuellement pour API
git subtree push --prefix=apps/api heroku main --force
```

## ⚠️ Notes Importantes

1. **MongoDB Atlas** : Assurez-vous d'ajouter les IPs Heroku à la whitelist MongoDB Atlas (ou autoriser 0.0.0.0/0)

2. **OAuth Callback** : Mettez à jour l'URL de callback Twitter dans le portail développeur :
   - Dev: `http://localhost:5051/auth/twitter/callback`
   - Prod: `https://coinlaunch-twitter.herokuapp.com/auth/twitter/callback`

3. **Tokens OAuth** : Les tokens OAuth2 sont stockés localement. Pour la production, considérez une solution de stockage persistante.

4. **Secrets** : Ne commitez JAMAIS les fichiers `.env` ou `tokens-*.json`

5. **Worker Dyno** : Le service Twitter utilise un worker dyno car il écoute en continu. Il ne répond pas aux requêtes HTTP. 