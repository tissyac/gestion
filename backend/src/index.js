/**
 * Point d'entrée principal de l'application backend
 * ===================================================
 * 
 * Configuration et initialisation du serveur Express
 * - Middleware de sécurité et CORS
 * - Connexion à la base de données
 * - Routes API
 * - Gestion des erreurs
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Import des routes
const authRoutes = require('./routes/auth.routes');
const devisRoutes = require('./routes/devis.routes');
const factureRoutes = require('./routes/facture.routes');
const bonCommandeRoutes = require('./routes/bon-commande.routes');
const bonVersionnementRoutes = require('./routes/bon-versement.routes');
const adminRoutes = require('./routes/admin.routes');

// Import des middlewares
const { errorHandler } = require('./middleware/errorHandler');
const { testConnection, initDatabase } = require('./config/database');

// Initialisation Express
const app = express();

// ===== INITIALISATION BASE DE DONNÉES =====
console.log('\n🔧 Initialisation de la base de données...');

// ===== CONFIGURATION SÉCURITÉ =====
app.use(helmet());

// ===== CONFIGURATION CORS =====
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(o => o.trim());
console.log(`🌐 CORS Origin: ${corsOrigins.join(', ')}`);
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

// ===== MIDDLEWARE DE PARSING =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ===== FICHIERS STATIQUES =====
app.use(express.static(path.resolve(__dirname, '../public')));

// ===== LOGGING =====
app.use(morgan('combined'));

// ===== ROUTES API =====
// Authentification
app.use('/api/auth', authRoutes);

// Devis
app.use('/api/devis', devisRoutes);

// Factures
app.use('/api/factures', factureRoutes);

// Bons de commande
app.use('/api/bons-commande', bonCommandeRoutes);

// Bons de versement
app.use('/api/bons-versement', bonVersionnementRoutes);

// Administration (réservée au rôle ADMIN)
app.use('/api/admin', adminRoutes);

// ===== ROUTE DE SANTÉ =====
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// ===== ROUTE 404 =====
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    path: req.originalUrl
  });
});

// ===== GESTION DES ERREURS =====
app.use(errorHandler);

// ===== DÉMARRAGE DU SERVEUR =====
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await initDatabase();
    testConnection();
    app.listen(PORT, () => {
      console.log(`✅ Serveur démarré sur le port ${PORT}`);
      console.log(`📝 Mode: ${process.env.NODE_ENV}`);
      console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN}`);
    });
  } catch (err) {
    console.error('❌ Échec de l\'initialisation de la base:', err.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
