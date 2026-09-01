const { query } = require('../config/database');

const getOverview = async (req, res, next) => {
  try {
    const users = query(
      'SELECT id, nom, prenom, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
    ).rows;
    const devis = query(`
      SELECT d.*, u.email AS user_email,
        COALESCE(SUM(da.quantite * da.prix_unitaire), 0) AS montant_ht
      FROM devis d LEFT JOIN devis_articles da ON d.id = da.devis_id
      LEFT JOIN users u ON u.id = d.user_id
      GROUP BY d.id ORDER BY d.created_at DESC
    `).rows;
    const devisArticles = query('SELECT * FROM devis_articles ORDER BY devis_id, numero_ligne').rows;
    const factures = query(`
      SELECT f.*, u.email AS user_email FROM factures f
      LEFT JOIN users u ON u.id = f.user_id ORDER BY f.created_at DESC
    `).rows;
    const bonsCommande = query(`
      SELECT b.*, u.email AS user_email FROM bons_commande b
      LEFT JOIN users u ON u.id = b.user_id ORDER BY b.created_at DESC
    `).rows;
    const bonsVersement = query(`
      SELECT b.*, u.email AS user_email FROM bons_versement b
      LEFT JOIN users u ON u.id = b.user_id ORDER BY b.created_at DESC
    `).rows;

    res.json({
      success: true,
      data: { users, devis, devisArticles, factures, bonsCommande, bonsVersement }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getOverview };