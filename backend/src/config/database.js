/**
 * Configuration de la base de données
 * ====================================
 * 
 * Utilise sql.js pour un stockage SQLite léger sans compilation native.
 */

const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const configuredDbPath = process.env.DB_PATH || './data/erp.db';
const dbPath = path.resolve(__dirname, '../..', configuredDbPath);

// Crée le dossier data s'il n'existe pas
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlJsDistPath = path.dirname(require.resolve('sql.js'));
let db = null;
let SQL = null;

/**
 * Charge ou initialise la base de données SQLite
 */
async function initDatabase() {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: file => path.join(sqlJsDistPath, file)
    });
  }

  if (!db) {
    const exists = fs.existsSync(dbPath);
    if (exists) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(new Uint8Array(fileBuffer));
    } else {
      db = new SQL.Database();
    }

    db.run('PRAGMA foreign_keys = ON;');
    createSchema();
    await ensureAdminUser();
    saveDatabase();
  }
}

/**
 * Sauvegarde la base de données sur le disque
 */
function saveDatabase() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

/**
 * Teste la connexion à la base de données
 */
function testConnection() {
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }
    db.exec('SELECT 1');
    console.log('✅ Connexion à la base de données SQLite réussie');
    console.log(`📁 Base de données: ${dbPath}`);
    return true;
  } catch (err) {
    console.error('❌ Erreur de connexion:', err.message);
    return false;
  }
}

/**
 * Exécute une requête SQL avec liaison de paramètres
 */
function query(sql, params = []) {
  if (!db) {
    throw new Error('Database not initialised. Call initDatabase() first.');
  }

  const modifiedSql = sql
    .replace(/\$\d+/g, '?')
    .replace(/\bNOW\(\)/gi, "datetime('now')");

  try {
    const statement = db.prepare(modifiedSql);
    statement.bind(params);

    const rows = [];
    const isSelect = /^\s*SELECT/i.test(modifiedSql);

    if (isSelect) {
      while (statement.step()) {
        rows.push(statement.getAsObject());
      }
      statement.free();
      return {
        rows,
        rowCount: rows.length
      };
    }

    const result = statement.run();
    const rowCount = db.getRowsModified ? db.getRowsModified() : 0;
    statement.free();
    saveDatabase();

    return {
      rows: [],
      rowCount
    };
  } catch (err) {
    console.error('❌ Erreur requête SQL:', err.message);
    throw err;
  }
}

/**
 * Initialise les tables de la base de données
 */
function createSchema() {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nom TEXT,
      prenom TEXT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'USER',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS devis (
      id TEXT PRIMARY KEY,
      numero TEXT UNIQUE NOT NULL,
      client_nom TEXT NOT NULL,
      client_prenom TEXT NOT NULL,
      client_adresse TEXT,
      client_telephone TEXT NOT NULL,
      client_email TEXT,
      date_devis TEXT,
      tva INTEGER DEFAULT 0,
      statut TEXT DEFAULT 'BROUILLON',
      user_id TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS devis_articles (
      id TEXT PRIMARY KEY,
      devis_id TEXT NOT NULL,
      numero_ligne INTEGER NOT NULL,
      designation TEXT NOT NULL,
      unite TEXT DEFAULT 'pièce',
      quantite DECIMAL(10, 2) NOT NULL,
      prix_unitaire DECIMAL(12, 2) NOT NULL,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY(devis_id) REFERENCES devis(id) ON DELETE CASCADE,
      UNIQUE(devis_id, numero_ligne)
    );

    CREATE TABLE IF NOT EXISTS factures (
      id TEXT PRIMARY KEY,
      numero TEXT UNIQUE NOT NULL,
      client TEXT NOT NULL,
      montant DECIMAL(12, 2) NOT NULL,
      description TEXT,
      statut TEXT DEFAULT 'EN_ATTENTE',
      date_facture DATETIME DEFAULT (datetime('now')),
      date_echeance DATETIME,
      montant_paye DECIMAL(12, 2) DEFAULT 0,
      user_id TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS bons_commande (
      id TEXT PRIMARY KEY,
      numero TEXT UNIQUE NOT NULL,
      fournisseur TEXT NOT NULL,
      montant DECIMAL(12, 2) NOT NULL,
      description TEXT,
      statut TEXT DEFAULT 'EN_ATTENTE',
      date_commande DATETIME DEFAULT (datetime('now')),
      date_livraison DATETIME,
      user_id TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS bons_versement (
      id TEXT PRIMARY KEY,
      numero TEXT UNIQUE NOT NULL,
      montant DECIMAL(12, 2) NOT NULL,
      description TEXT,
      statut TEXT DEFAULT 'EN_ATTENTE',
      date_versement DATETIME DEFAULT (datetime('now')),
      date_reception DATETIME,
      user_id TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_devis_statut ON devis(statut);
    CREATE INDEX IF NOT EXISTS idx_devis_user_id ON devis(user_id);
    CREATE INDEX IF NOT EXISTS idx_devis_articles_devis_id ON devis_articles(devis_id);
    CREATE INDEX IF NOT EXISTS idx_factures_statut ON factures(statut);
    CREATE INDEX IF NOT EXISTS idx_factures_user_id ON factures(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `;

  db.exec(schema);
  ensureDevisUnitColumn();
  ensureDevisEmailColumn();
  ensureDevisDateColumn();
  ensureBonVersementColumns();
  ensureUserRoleColumn();
}

function ensureUserRoleColumn() {
  const result = db.exec('PRAGMA table_info(users)');
  const columns = result[0]?.values || [];
  if (!columns.some(column => column[1] === 'role')) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'USER'");
    saveDatabase();
  }
}

async function ensureAdminUser() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  const existing = query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.rows.length > 0) {
    query('UPDATE users SET role = ? WHERE email = ?', ['ADMIN', email]);
    return;
  }

  const { v4: uuidv4 } = require('uuid');
  const passwordHash = await bcrypt.hash(password, 10);
  query(
    `INSERT INTO users (id, nom, prenom, email, password, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'ADMIN', datetime('now'), datetime('now'))`,
    [uuidv4(), process.env.ADMIN_NOM || 'Administrateur', process.env.ADMIN_PRENOM || '', email, passwordHash]
  );
  console.log(`✅ Compte administrateur prêt: ${email}`);
}

function ensureDevisUnitColumn() {
  const result = db.exec('PRAGMA table_info(devis_articles)');
  const columns = result[0]?.values || [];

  if (!columns.some(column => column[1] === 'unite')) {
    db.exec("ALTER TABLE devis_articles ADD COLUMN unite TEXT DEFAULT 'pièce'");
    saveDatabase();
  }
}

function ensureDevisEmailColumn() {
  if (!db) return;

  try {
    const result = db.exec("PRAGMA table_info(devis)");
    const columns = result[0]?.values || [];
    const hasClientEmail = columns.some(column => column[1] === 'client_email');

    if (!hasClientEmail) {
      db.exec('ALTER TABLE devis ADD COLUMN client_email TEXT');
      saveDatabase();
    }
  } catch (err) {
    console.warn('⚠️ Impossible de vérifier/ajouter la colonne client_email:', err.message);
  }
}

function ensureDevisDateColumn() {
  if (!db) return;

  try {
    const result = db.exec("PRAGMA table_info(devis)");
    const columns = result[0]?.values || [];
    const hasDateDevis = columns.some(column => column[1] === 'date_devis');

    if (!hasDateDevis) {
      db.exec('ALTER TABLE devis ADD COLUMN date_devis TEXT');
      saveDatabase();
    }
  } catch (err) {
    console.warn('⚠️ Impossible de vérifier/ajouter la colonne date_devis:', err.message);
  }
}

function ensureBonVersementColumns() {
  if (!db) return;

  const columnsToAdd = [
    ['beneficiaire_nom', 'TEXT'],
    ['beneficiaire_prenom', 'TEXT'],
    ['beneficiaire_entreprise', 'TEXT'],
    ['beneficiaire_adresse', 'TEXT'],
    ['beneficiaire_telephone', 'TEXT'],
    ['beneficiaire_email', 'TEXT'],
    ['mode_paiement', 'TEXT'],
    ['objet', 'TEXT'],
    ['reference', 'TEXT'],
    ['banque', 'TEXT'],
    ['numero_piece', 'TEXT'],
    ['observation', 'TEXT'],
    ['total_global', 'DECIMAL(12,2)'],
    ['montant_verse', 'DECIMAL(12,2)'],
    ['montant_reste', 'DECIMAL(12,2)']
  ];

  try {
    const result = db.exec('PRAGMA table_info(bons_versement)');
    const existingColumns = result[0]?.values || [];
    const currentColumns = existingColumns.map(column => column[1]);

    columnsToAdd.forEach(([columnName, columnType]) => {
      if (!currentColumns.includes(columnName)) {
        db.exec(`ALTER TABLE bons_versement ADD COLUMN ${columnName} ${columnType}`);
      }
    });

    saveDatabase();
  } catch (err) {
    console.warn('⚠️ Impossible de vérifier/ajouter les colonnes du bon de versement:', err.message);
  }
}

/**
 * Ferme la base de données
 */
function closeConnection() {
  if (!db) return;
  db.close();
}

module.exports = {
  query,
  testConnection,
  initDatabase,
  closeConnection
};
