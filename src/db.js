require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.POSTGRES_DB,
  port: Number(process.env.PGPORT),
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT 1')
  .then(() => console.log('✅ PostgreSQL conectado'))
  .catch(err => console.error('❌ PostgreSQL error:', err));

module.exports = pool;