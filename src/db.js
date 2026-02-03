require('dotenv').config(); // 🔥 CARGA EL .env SÍ O SÍ

const { Pool } = require('pg');

// 🔎 DEBUG (dejalo hasta que todo funcione)
console.log('DB CONFIG =>', {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  passwordType: typeof process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: String(process.env.DB_PASSWORD), // 🔥 fuerza string
  port: Number(process.env.DB_PORT),          // 🔥 fuerza número
});

// Test de conexión al iniciar
pool
  .query('SELECT 1')
  .then(() => console.log('✅ PostgreSQL conectado correctamente'))
  .catch(err => console.error('❌ Error conectando a PostgreSQL:', err));

module.exports = pool;