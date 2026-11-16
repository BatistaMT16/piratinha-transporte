const { Pool } = require('pg');

const pool = new Pool({
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
