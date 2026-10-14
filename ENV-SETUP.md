# 🔐 Configuration des Variables d'Environnement

## Vue d'ensemble

Ce document explique toutes les variables d'environnement nécessaires pour déployer l'application Sara Decorex en production.

---

## 🚀 Frontend (Vercel)

### Variables Requises

| Variable | Description | Exemple | Notes |
|----------|-------------|---------|-------|
| `VITE_API_URL` | URL complète de l'API backend | `https://api.monapp.onrender.com/api` | ⚠️ Obligatoire pour les appels API |
| `VITE_API_TIMEOUT` | Timeout des requêtes (ms) | `30000` | Optionnel, défaut 30s |

### Configuration sur Vercel

1. Allez dans **Settings** de votre projet Vercel
2. Sélectionnez **Environment Variables**
3. Ajoutez chaque variable:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://votre-backend-xxxxx.onrender.com/api`
   - **Environments**: Production, Preview, Development

4. **Redéployez** votre application après chaque changement

### Exemple Complet

```bash
VITE_API_URL=https://erp-backend-xxxx.onrender.com/api
VITE_API_TIMEOUT=30000
```

---

## 🔌 Backend (Render/Railway)

### Variables Obligatoires

| Variable | Description | Exemple | Défaut |
|----------|-------------|---------|--------|
| `NODE_ENV` | Environnement d'exécution | `production` | `development` |
| `PORT` | Port d'écoute du serveur | `3000` ou `5000` | `5000` |
| `JWT_SECRET` | Clé secrète JWT | (générée aléatoirement) | ⚠️ Obligatoire |
| `CORS_ORIGIN` | Domaines autorisés | `https://monapp.vercel.app` | `http://localhost:3000` |

### Base de données PostgreSQL (Neon)

Le backend utilise PostgreSQL via une seule variable `DATABASE_URL`. Pour repartir
sur une base vide, créez un nouveau projet PostgreSQL chez Neon, puis copiez son
URL de connexion dans les variables d'environnement du service backend Render.
Ne partagez et ne versionnez jamais cette URL : elle contient un mot de passe.

Au démarrage, le backend crée automatiquement ses tables si elles n'existent pas.
Il ne faut donc ni exécuter un script de réinitialisation ni importer l'ancienne
base pour commencer avec une base vide.

Le forfait gratuit Neon peut mettre la base en veille après une période
d'inactivité et ne fournit pas de sauvegardes planifiées. Faites régulièrement
un export indépendant de la base et conservez-le dans un emplacement sûr.

### Variables Optionnelles

| Variable | Description | Exemple |
|----------|-------------|---------|
| `LOG_LEVEL` | Niveau de logging | `info`, `debug`, `error` |
| `SESSION_SECRET` | Clé de session | (générée aléatoirement) |

### Configuration sur Render

1. Allez dans votre **Web Service** Render
2. Sélectionnez **Environment**
3. Configurez les variables suivantes:

```
NODE_ENV = production
DATABASE_URL = (URL de connexion PostgreSQL du nouveau projet Neon)
CORS_ORIGIN = https://votre-frontend.vercel.app
```

Conservez la valeur actuelle de `JWT_SECRET` pendant le changement de base afin
de ne pas invalider les sessions existantes. Ne renseignez ni `DB_TYPE` ni
`DB_PATH` : le backend n'utilise pas SQLite.

4. Redéployez le service. L'initialisation crée alors les tables vides dans Neon.

### Générer une Clé JWT Sécurisée

```bash
# Linux/Mac
openssl rand -base64 32

# Windows
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🔗 Intégration Frontend-Backend

### Processus de Configuration

1. **Déployer le Backend d'abord**
   - Notez l'URL: `https://votre-backend-xxxxx.onrender.com`

2. **Ajouter à Vercel**
   - `VITE_API_URL = https://votre-backend-xxxxx.onrender.com/api`

3. **Mettre à jour le Backend**
   - `CORS_ORIGIN = https://votre-frontend.vercel.app`

4. **Vérifier la Connexion**
   - Testez une requête API depuis le frontend

### Format de Configuration

```bash
# .env.production (Backend)
NODE_ENV=production
PORT=5000
JWT_SECRET=votre_clé_très_secrète
CORS_ORIGIN=https://votre-frontend.vercel.app
DATABASE_URL=postgresql://...
```

```bash
# .env.production (Frontend)
VITE_API_URL=https://votre-backend.onrender.com/api
```

---

## ⚠️ Points de Sécurité Importants

### Ne Jamais

- ❌ Versionner des fichiers `.env` avec données sensibles
- ❌ Utiliser les mêmes secrets en dev et prod
- ❌ Partager `JWT_SECRET` ou `DB_PASSWORD` en public
- ❌ Logger les tokens JWT ou mots de passe

### Bonnes Pratiques

- ✅ Régénérez `JWT_SECRET` régulièrement
- ✅ Utilisez des secrets générés aléatoirement
- ✅ Stockez les secrets dans les variables d'environnement du provider
- ✅ Limitez les accès CORS à votre domaine uniquement
- ✅ Utilisez HTTPS en production

---

## 🧪 Vérification des Variables

### Checklist Pré-Déploiement

```bash
# Frontend
[ ] VITE_API_URL pointant vers le backend
[ ] VITE_API_TIMEOUT configuré (30000)
[ ] Build réussit: npm run build

# Backend
[ ] NODE_ENV=production
[ ] PORT configuré
[ ] JWT_SECRET défini (min 32 caractères)
[ ] CORS_ORIGIN pointant vers le frontend
[ ] DATABASE_URL pointe vers le nouveau PostgreSQL Neon

# Intégration
[ ] Frontend peut se connecter au backend
[ ] Les requêtes API fonctionnent
[ ] CORS ne bloque pas les requêtes
[ ] Authentification JWT fonctionne
```

---

## 🐛 Dépannage

### "CORS error"

```
Access to XMLHttpRequest from origin 'https://app.vercel.app' 
has been blocked by CORS policy
```

**Solution:**
1. Vérifiez `CORS_ORIGIN` dans les variables du backend
2. L'URL doit correspondre exactement au domaine du frontend

```bash
CORS_ORIGIN=https://votre-frontend.vercel.app
```

### "API 404 / Cannot POST /api/..."

**Solution:**
1. Vérifiez `VITE_API_URL` sur Vercel
2. L'URL doit se terminer par `/api`

```bash
VITE_API_URL=https://backend.onrender.com/api  # ✅
VITE_API_URL=https://backend.onrender.com     # ❌
```

### "JWT verification failed"

**Solution:**
1. Vérifiez que `JWT_SECRET` est identique entre le backend et les cookies
2. Régénérez `JWT_SECRET` si changer

```bash
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

### "Database locked" ou données perdues

**Solution:**
1. Utilisez PostgreSQL en production (SQLite est ephemère en Free)
2. Sauvegardez régulièrement `./data/erp.db`

---

## 📚 Ressources

- [Documentation Vercel - Env Variables](https://vercel.com/docs/projects/environment-variables)
- [Documentation Render - Environment Variables](https://render.com/docs/environment-variables)
- [JWT Secret Generation](https://tools.ietf.org/html/rfc4648)

---

**Configuration Complète ✅**

Une fois toutes les variables configurées, testez l'application complète avant de la mettre en production!
