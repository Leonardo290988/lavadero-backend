require("dotenv").config();
const { Pool } = require("pg");

// Mostrar solo que existe, sin revelar secretos
console.log("DATABASE_URL existe:", !!process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test al iniciar
pool
  .query("SELECT 1")
  .then(() => console.log("✅ PostgreSQL conectado correctamente"))
  .catch(err => console.error("❌ Error conectando a PostgreSQL:", err));

module.exports = pool;