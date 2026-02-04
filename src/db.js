const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});

pool.query('SELECT 1')
  .then(() => console.log('✅ PostgreSQL conectado'))
  .catch(err => console.error('❌ PostgreSQL error:', err));

module.exports = pool;