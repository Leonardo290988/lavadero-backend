const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres:yeSmDUOoFbjOftXEDRZNQwtDJIunOMxT@postgres.railway.internal:5432/railway",
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT 1')
  .then(() => console.log('✅ PostgreSQL conectado correctamente'))
  .catch(err => console.error('❌ PostgreSQL error:', err));

// Crear tabla push_tokens si no existe
pool.query(`
  CREATE TABLE IF NOT EXISTS push_tokens (
    clave VARCHAR(50) PRIMARY KEY,
    token TEXT NOT NULL,
    actualizado_en TIMESTAMP DEFAULT NOW()
  )
`).catch(err => console.error('❌ Error creando push_tokens:', err));

module.exports = pool;