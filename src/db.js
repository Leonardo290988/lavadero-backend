require('dotenv').config();
const { Pool } = require('pg');

console.log("DATABASE_URL =", process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.query('select 1')
  .then(() => console.log("✅ DB OK"))
  .catch(err => console.error("❌ DB ERROR:", err));

module.exports = pool;