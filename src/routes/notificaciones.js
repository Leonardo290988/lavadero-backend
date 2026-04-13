const express = require("express");
const router = express.Router();
const pool = require("../db");

// Guardar el push token del dispositivo del local
// POST /notificaciones/token
router.post("/token", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token requerido" });
  }

  try {
    // Usamos un registro único con clave "local_owner"
    await pool.query(`
      INSERT INTO push_tokens (clave, token, actualizado_en)
      VALUES ('local_owner', $1, NOW())
      ON CONFLICT (clave)
      DO UPDATE SET token = $1, actualizado_en = NOW()
    `, [token]);

    res.json({ ok: true });
  } catch (error) {
    console.error("ERROR guardando push token:", error);
    res.status(500).json({ error: "Error guardando token" });
  }
});

// Obtener el token actual (para debug)
// GET /notificaciones/token
router.get("/token", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT token, actualizado_en FROM push_tokens WHERE clave = 'local_owner'"
    );
    if (r.rows.length === 0) {
      return res.json({ token: null });
    }
    res.json({ token: r.rows[0].token, actualizado_en: r.rows[0].actualizado_en });
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo token" });
  }
});

module.exports = router;
