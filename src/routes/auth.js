const express = require("express");
const router = express.Router();
const pool = require("../db");

router.post("/login", async (req, res) => {
  const { telefono } = req.body;

  if (!telefono) {
    return res.status(400).json({ error: "Teléfono requerido" });
  }

  try {
    const result = await pool.query(
      "SELECT id, nombre, telefono FROM clientes WHERE telefono = $1",
      [telefono]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    // 🔥 Login simple (sin token todavía)
    res.json({
      ok: true,
      cliente: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

module.exports = router;