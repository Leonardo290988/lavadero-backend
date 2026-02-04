const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool
  .query("SELECT 1")
  .then(() => console.log("✅ PostgreSQL conectado correctamente"))
  .catch(err => console.error("❌ Error conectando a PostgreSQL:", err));

module.exports = pool;