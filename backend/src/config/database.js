const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const databaseUrl = process.env.DATABASE_URL;
const environment = (process.env.NODE_ENV || '').toLowerCase();
const isLocalEnvironment = ['development', 'local', 'test'].includes(environment);
const useSsl = databaseUrl && (!isLocalEnvironment || process.env.PGSSL === 'true');

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {})
    })
  : null;

if (pool) {
  pool.on('error', (error) => {
    console.error('Unexpected PostgreSQL pool error:', error.message);
  });
}

function translatePlaceholders(sql) {
  let parameterIndex = 0;

  return sql
    .replace(/\?/g, () => `$${++parameterIndex}`)
    .replace(/datetime\(\s*['"]now['"]\s*\)/gi, 'NOW()');
}

async function query(sql, params = []) {
  if (!pool) {
    throw new Error('PostgreSQL pool is unavailable. Set DATABASE_URL before querying the database.');
  }

  const result = await pool.query(translatePlaceholders(sql), params);
  return { rows: result.rows, rowCount: result.rowCount };
}

async function initDatabase() {
  if (!pool) {
    throw new Error('PostgreSQL pool is unavailable. Set DATABASE_URL before initializing the database.');
  }

  const client = await pool.connect();
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, nom TEXT, prenom TEXT, email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL, role TEXT DEFAULT 'USER', is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS devis (
      id TEXT PRIMARY KEY, numero TEXT UNIQUE NOT NULL, client_nom TEXT NOT NULL,
      client_prenom TEXT NOT NULL, client_adresse TEXT, client_telephone TEXT NOT NULL,
      client_email TEXT, date_devis TEXT, tva NUMERIC(5, 2) DEFAULT 0,
      statut TEXT DEFAULT 'BROUILLON', user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS devis_articles (
      id TEXT PRIMARY KEY, devis_id TEXT NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
      numero_ligne INTEGER NOT NULL, designation TEXT NOT NULL, unite TEXT DEFAULT 'piece',
      quantite NUMERIC(10, 2) NOT NULL, prix_unitaire NUMERIC(12, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(), UNIQUE (devis_id, numero_ligne)
    )`,
    `CREATE TABLE IF NOT EXISTS factures (
      id TEXT PRIMARY KEY, numero TEXT UNIQUE NOT NULL, client TEXT NOT NULL,
      montant NUMERIC(12, 2) NOT NULL, description TEXT, statut TEXT DEFAULT 'EN_ATTENTE',
      date_facture TIMESTAMP DEFAULT NOW(), date_echeance TIMESTAMP,
      montant_paye NUMERIC(12, 2) DEFAULT 0,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS bons_commande (
      id TEXT PRIMARY KEY, numero TEXT UNIQUE NOT NULL, fournisseur TEXT NOT NULL,
      montant NUMERIC(12, 2) NOT NULL, description TEXT, statut TEXT DEFAULT 'EN_ATTENTE',
      date_commande TIMESTAMP DEFAULT NOW(), date_livraison TIMESTAMP,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS bons_versement (
      id TEXT PRIMARY KEY, numero TEXT UNIQUE NOT NULL, montant NUMERIC(12, 2) NOT NULL,
      description TEXT, statut TEXT DEFAULT 'EN_ATTENTE', date_versement TIMESTAMP DEFAULT NOW(),
      date_reception TIMESTAMP, beneficiaire_nom TEXT, beneficiaire_prenom TEXT,
      beneficiaire_entreprise TEXT, beneficiaire_adresse TEXT, beneficiaire_telephone TEXT,
      beneficiaire_email TEXT, mode_paiement TEXT, objet TEXT, reference TEXT, banque TEXT,
      numero_piece TEXT, observation TEXT, total_global NUMERIC(12, 2),
      montant_verse NUMERIC(12, 2), montant_reste NUMERIC(12, 2),
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
    )`,
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'USER'",
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()',
    'ALTER TABLE devis ADD COLUMN IF NOT EXISTS client_email TEXT',
    'ALTER TABLE devis ADD COLUMN IF NOT EXISTS date_devis TEXT',
    "ALTER TABLE devis_articles ADD COLUMN IF NOT EXISTS unite TEXT DEFAULT 'piece'",
    'ALTER TABLE factures ADD COLUMN IF NOT EXISTS date_echeance TIMESTAMP',
    'ALTER TABLE factures ADD COLUMN IF NOT EXISTS montant_paye NUMERIC(12, 2) DEFAULT 0',
    'ALTER TABLE bons_commande ADD COLUMN IF NOT EXISTS date_livraison TIMESTAMP',
    'ALTER TABLE bons_versement ADD COLUMN IF NOT EXISTS beneficiaire_nom TEXT',
    'ALTER TABLE bons_versement ADD COLUMN IF NOT EXISTS beneficiaire_prenom TEXT',
    'ALTER TABLE bons_versement ADD COLUMN IF NOT EXISTS beneficiaire_entreprise TEXT',
    'ALTER TABLE bons_versement ADD COLUMN IF NOT EXISTS beneficiaire_adresse TEXT',
    'ALTER TABLE bons_versement ADD COLUMN IF NOT EXISTS beneficiaire_telephone TEXT',
    'ALTER TABLE bons_versement ADD COLUMN IF NOT EXISTS beneficiaire_email TEXT',
    'ALTER TABLE bons_versement ADD COLUMN IF NOT EXISTS mode_paiement TEXT',
    'ALTER TABLE bons_versement ADD COLUMN IF NOT EXISTS objet TEXT',
    'ALTER TABLE bons_versement ADD COLUMN IF NOT EXISTS reference TEXT',
    'ALTER TABLE bons_versement ADD COLUMN IF NOT EXISTS banque TEXT',
    'ALTER TABLE bons_versement ADD COLUMN IF NOT EXISTS numero_piece TEXT',
    'ALTER TABLE bons_versement ADD COLUMN IF NOT EXISTS observation TEXT',
    'ALTER TABLE bons_versement ADD COLUMN IF NOT EXISTS total_global NUMERIC(12, 2)',
    'ALTER TABLE bons_versement ADD COLUMN IF NOT EXISTS montant_verse NUMERIC(12, 2)',
    'ALTER TABLE bons_versement ADD COLUMN IF NOT EXISTS montant_reste NUMERIC(12, 2)',
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_devis_statut ON devis(statut)',
    'CREATE INDEX IF NOT EXISTS idx_devis_user_id ON devis(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_devis_articles_devis_id ON devis_articles(devis_id)',
    'CREATE INDEX IF NOT EXISTS idx_factures_statut ON factures(statut)',
    'CREATE INDEX IF NOT EXISTS idx_factures_user_id ON factures(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_bons_commande_statut ON bons_commande(statut)',
    'CREATE INDEX IF NOT EXISTS idx_bons_commande_user_id ON bons_commande(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_bons_versement_statut ON bons_versement(statut)',
    'CREATE INDEX IF NOT EXISTS idx_bons_versement_user_id ON bons_versement(user_id)'
  ];

  try {
    await client.query('BEGIN');
    for (const statement of statements) await client.query(statement);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  await ensureAdminUser();
}

async function ensureAdminUser() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.rows.length > 0) {
    await query(
      'UPDATE users SET role = ?, password = ?, updated_at = NOW() WHERE email = ?',
      ['ADMIN', passwordHash, email]
    );
    return;
  }

  await query(
    `INSERT INTO users (id, nom, prenom, email, password, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'ADMIN', NOW(), NOW())`,
    [uuidv4(), process.env.ADMIN_NOM || 'Administrateur', process.env.ADMIN_PRENOM || '', email, passwordHash]
  );
}

async function testConnection() {
  if (!pool) {
    console.error('PostgreSQL pool is unavailable. Set DATABASE_URL before connecting.');
    return false;
  }
  try {
    await pool.query('SELECT 1');
    console.log('PostgreSQL connection successful');
    return true;
  } catch (error) {
    console.error('PostgreSQL connection failed:', error.message);
    return false;
  }
}

async function closeConnection() {
  if (pool) await pool.end();
}

module.exports = { pool, query, testConnection, initDatabase, closeConnection };
