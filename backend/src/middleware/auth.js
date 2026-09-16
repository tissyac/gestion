/**
 * Middleware d'authentification JWT
 * ==================================
 * 
 * Vérifie le token JWT
 * Protège les routes privées
 */

const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');
const { query } = require('../config/database');

/**
 * Middleware pour vérifier le token JWT
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Fonction next
 */
const verifyToken = async (req, res, next) => {
  try {
    // Récupère le token du header Authorization
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new AppError('Accès refusé. Token manquant.', 401);
    }

    // Vérifie le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await query(
      'SELECT id, email, nom, prenom, role, is_active FROM users WHERE id = ?',
      [decoded.id]
    );

    if (result.rows.length === 0 || result.rows[0].is_active === false) {
      throw new AppError('Session invalide. Veuillez vous reconnecter.', 401);
    }

    // Use the current database user so role changes and new accounts are reflected.
    req.user = {
      ...decoded,
      ...result.rows[0]
    };
    
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
