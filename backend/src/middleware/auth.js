/**
 * Middleware d'authentification JWT
 * ==================================
 * 
 * Vérifie le token JWT
 * Protège les routes privées
 */

const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

/**
 * Middleware pour vérifier le token JWT
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Fonction next
 */
const verifyToken = (req, res, next) => {
  try {
    // Récupère le token du header Authorization
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new AppError('Accès refusé. Token manquant.', 401);
    }

    // Vérifie le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Stocke l'utilisateur dans la requête
    req.user = decoded;
    
    next();
  } catch (err) {
    // Gère les erreurs JWT
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError('Token invalide ou expiré', 401);
  }
};

/**
 * Génère un token JWT
 * @param {Object} payload - Données à encoder
 * @returns {string} Token JWT
 */
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') {
    throw new AppError('Accès réservé à l’administrateur.', 403);
  }
  next();
};

module.exports = {
  verifyToken,
  requireAdmin,
  generateToken
};
