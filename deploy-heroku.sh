#!/bin/bash

# Script de déploiement Heroku pour CoinLaunch
# Ce script déploie les apps Twitter et API sur Heroku

echo "🚀 Déploiement des applications CoinLaunch sur Heroku"
echo "=================================================="

# Vérifier que nous sommes dans le bon répertoire
if [ ! -d "apps/twitter" ] || [ ! -d "apps/api" ]; then
    echo "❌ Erreur: Ce script doit être exécuté depuis le répertoire coinlaunch/"
    exit 1
fi

# Vérifier que Heroku CLI est installé
if ! command -v heroku &> /dev/null; then
    echo "❌ Erreur: Heroku CLI n'est pas installé"
    echo "👉 Installez-le depuis: https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

# Fonction pour déployer une app
deploy_app() {
    local app_dir=$1
    local heroku_app=$2
    local app_name=$3
    
    echo ""
    echo "📦 Déploiement de $app_name vers $heroku_app..."
    echo "----------------------------------------------"
    
    cd "apps/$app_dir"
    
    # Initialiser git si nécessaire
    if [ ! -d ".git" ]; then
        echo "📝 Initialisation de git..."
        git init
        git add .
        git commit -m "Initial commit for $app_name"
    fi
    
    # Ajouter le remote Heroku
    if ! git remote | grep -q heroku; then
        echo "🔗 Ajout du remote Heroku..."
        heroku git:remote -a "$heroku_app"
    else
        echo "🔗 Mise à jour du remote Heroku..."
        git remote remove heroku
        heroku git:remote -a "$heroku_app"
    fi
    
    # Déployer
    echo "🚢 Déploiement en cours..."
    git add .
    git commit -m "Deploy to Heroku" || true
    
    # Déterminer le nom de la branche actuelle
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    echo "📌 Branche actuelle: $CURRENT_BRANCH"
    
    # Pousser vers Heroku
    git push heroku $CURRENT_BRANCH:main -f
    
    echo "✅ $app_name déployé avec succès!"
    
    # Retour au répertoire principal
    cd ../..
}

# Déployer l'app Twitter
deploy_app "twitter" "coinlaunch-twitter" "Twitter Service"

# Déployer l'app API
deploy_app "api" "coinlaunch" "API Service"

echo ""
echo "🎉 Déploiement terminé!"
echo ""
echo "📋 Prochaines étapes:"
echo "1. Configurez les variables d'environnement sur Heroku"
echo "2. Pour l'app Twitter: heroku config:set -a coinlaunch-twitter"
echo "3. Pour l'app API: heroku config:set -a coinlaunch"
echo ""
echo "💡 Commandes utiles:"
echo "- Voir les logs Twitter: heroku logs --tail -a coinlaunch-twitter"
echo "- Voir les logs API: heroku logs --tail -a coinlaunch"
echo "- Redémarrer Twitter: heroku restart -a coinlaunch-twitter"
echo "- Redémarrer API: heroku restart -a coinlaunch" 