const { Pool } = require('pg');

// 🚄 En Railway usamos DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test al iniciar
pool
  .query('SELECT 1')
  .then(() => console.log('✅ PostgreSQL conectado correctamente (Railway)'))
  .catch(err => console.error('❌ Error conectando a PostgreSQL:', err));

module.exports = pool;