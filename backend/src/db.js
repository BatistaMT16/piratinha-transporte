const { Pool } = require('pg');

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.STORAGE_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST || 'db',
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || 'piratinha',
      password: process.env.DB_PASSWORD || 'piratinha_secret_2026',
      database: process.env.DB_NAME || 'piratinha_db',
    });

pool.on('error', (err) => {
  console.error('[DB] Erro inesperado no pool do PostgreSQL:', err);
});

module.exports = pool;
