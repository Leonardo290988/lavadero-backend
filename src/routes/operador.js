const express = require("express");
const router = express.Router();
const pool = require("../db");

// ============================================
// NOTIFICACIONES DE OPERADOR
// Cuando un cliente escribe "operador" en el bot de WhatsApp,
// el bot inserta una fila en notificaciones_operador (directo a la DB).
// Acá exponemos los endpoints que usa el panel del lavadero.
// ============================================

// GET /operador/pendientes
// Devuelve las notificaciones NO atendidas (para la campana del panel)
router.get("/pendientes", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT id, chat_id, telefono, nombre_cliente, mensaje_cliente, fecha_pedido
      FROM notificaciones_operador
      WHERE atendido = false
      ORDER BY fecha_pedido DESC
      LIMIT 50
    `);
    res.json({ total: r.rows.length, notificaciones: r.rows });
  } catch (error) {
    console.error("ERROR obteniendo notificaciones operador:", error.message);
    res.status(500).json({ error: "Error obteniendo notificaciones" });
  }
});

// POST /operador/:id/atender
// Marca UNA notificación como atendida (botón "Atendido" del panel)
router.post("/:id/atender", async (req, res) => {
  const { id } = req.params;
  try {
    const r = await pool.query(`
      UPDATE notificaciones_operador
      SET atendido = true, fecha_atendido = NOW()
      WHERE id = $1
      RETURNING id
    `, [id]);

    if (r.rows.length === 0) {
      return res.status(404).json({ error: "Notificación no encontrada" });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("ERROR atendiendo notificación:", error.message);
    res.status(500).json({ error: "Error atendiendo notificación" });
  }
});

// POST /operador/atender-chat
// Marca TODAS las pendientes de un chat_id como atendidas.
// Lo usa el bot cuando detecta que un empleado respondió por WhatsApp
// (cierre automático). Body: { chat_id }
router.post("/atender-chat", async (req, res) => {
  const { chat_id } = req.body;
  if (!chat_id) {
    return res.status(400).json({ error: "Falta chat_id" });
  }
  try {
    const r = await pool.query(`
      UPDATE notificaciones_operador
      SET atendido = true, fecha_atendido = NOW()
      WHERE chat_id = $1 AND atendido = false
      RETURNING id
    `, [chat_id]);
    res.json({ ok: true, atendidas: r.rows.length });
  } catch (error) {
    console.error("ERROR atendiendo chat:", error.message);
    res.status(500).json({ error: "Error atendiendo chat" });
  }
});

// POST /operador/notificar  (OPCIONAL / fallback)
// Permite crear una notificación vía HTTP en vez de insert directo.
// El bot por defecto escribe directo a la DB, pero dejamos esto por si
// alguna vez querés crear notificaciones desde otro lado.
// Body: { chat_id, telefono, nombre_cliente, mensaje_cliente }
router.post("/notificar", async (req, res) => {
  const { chat_id, telefono, nombre_cliente, mensaje_cliente } = req.body;
  if (!chat_id) {
    return res.status(400).json({ error: "Falta chat_id" });
  }
  try {
    await pool.query(`
      INSERT INTO notificaciones_operador
        (chat_id, telefono, nombre_cliente, mensaje_cliente)
      VALUES ($1, $2, $3, $4)
    `, [chat_id, telefono || null, nombre_cliente || null, mensaje_cliente || null]);
    res.json({ ok: true });
  } catch (error) {
    console.error("ERROR creando notificación operador:", error.message);
    res.status(500).json({ error: "Error creando notificación" });
  }
});

module.exports = router;
