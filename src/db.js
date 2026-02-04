const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres:yeSmDUOoFbjOftXEDRZNQwtDJIunOMxT@postgres.railway.internal:5432/railway",
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT 1')
  .then(() => console.log('✅ PostgreSQL conectado correctamente'))
  .catch(err => console.error('❌ PostgreSQL error:', err));

module.exports = pool;