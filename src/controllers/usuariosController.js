const pool = require("../db");

const login = async (req, res) => {
  const { usuario, password } = req.body;

  try {
    const result = await pool.query(
      `SELECT id, usuario, nombre 
       FROM usuarios
       WHERE usuario = $1
         AND password = $2
         AND activo = true`,
      [usuario, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ error: "Error servidor" });
  }
};

module.exports = {
  login
};