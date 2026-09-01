/**
 * Contrôleur d'authentification
 * =============================
 * 
 * Gère :
 * - Inscription des utilisateurs
 * - Connexion (login)
 * - Rafraîchissement du token
 * - Récupération de l'utilisateur courant
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { generateToken } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const { query } = require('../config/database');

/**
 * Inscription d'un nouvel utilisateur
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const register = async (req, res, next) => {
  try {
    const { nom, prenom, email, password, passwordConfirm } = req.body;

    // Validation basique
    if (!email || !password || !passwordConfirm) {
      throw new AppError('Tous les champs sont requis', 400);
    }

    if (password !== passwordConfirm) {
      throw new AppError('Les mots de passe ne correspondent pas', 400);
    }

    if (password.length < 6) {
      throw new AppError('Le mot de passe doit contenir au moins 6 caractères', 400);
    }

    // Vérifie si l'utilisateur existe déjà
    const userExists = query(
      'SELECT email FROM users WHERE email = ?',
      [email]
    );

    if (userExists.rows.length > 0) {
      throw new AppError('Cet email est déjà utilisé', 400);
    }

    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crée l'utilisateur avec un UUID
    const id = uuidv4();
    query(
      `INSERT INTO users (id, nom, prenom, email, password, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, nom || '', prenom || '', email, hashedPassword]
    );

    // Récupère l'utilisateur créé
    const user = query(
      'SELECT id, email, nom, prenom FROM users WHERE id = ?',
      [id]
    );

    if (!user.rows || user.rows.length === 0) {
      throw new AppError('Erreur lors de la création de l\'utilisateur', 500);
    }

    const userData = user.rows[0];

    // Génère le token
    const token = generateToken({
      id: userData.id,
      email: userData.email,
      nom: userData.nom,
      prenom: userData.prenom,
      role: userData.role || 'USER'
    });

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      token,
      user: {
        id: userData.id,
        email: userData.email,
        nom: userData.nom,
        prenom: userData.prenom,
        role: userData.role || 'USER'
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Connexion d'un utilisateur
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      throw new AppError('Email et mot de passe requis', 400);
    }

    // Récupère l'utilisateur
    const result = query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (result.rows.length === 0) {
      throw new AppError('Email ou mot de passe incorrect', 401);
    }

    const user = result.rows[0];

    // Vérifie le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new AppError('Email ou mot de passe incorrect', 401);
    }

    // Génère le token
    const token = generateToken({
      id: user.id,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      role: user.role || 'USER'
    });

    res.json({
      success: true,
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role || 'USER'
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Rafraîchissement du token
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const refresh = async (req, res, next) => {
  try {
    // L'utilisateur est récupéré du middleware verifyToken
    const newToken = generateToken({
      id: req.user.id,
      email: req.user.email,
      nom: req.user.nom,
      prenom: req.user.prenom
    });

    res.json({
      success: true,
      token: newToken
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Récupère l'utilisateur courant
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const getCurrentUser = async (req, res, next) => {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Déconnexion (côté client - suppression du token)
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 */
const logout = async (req, res, next) => {
  try {
    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  refresh,
  getCurrentUser,
  logout
};
