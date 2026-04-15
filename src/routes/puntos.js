const express = require("express");
const router = express.Router();
const { getPuntosCliente, canjearDescuento, getTodosLosPuntos } = require("../controllers/puntosController");

router.get("/todos", getTodosLosPuntos);
router.get("/cargar-historicos", async (req, res) => {
  const pool = require("../db");
  try {
    const r = await pool.query(`
      INSERT INTO puntos_clientes (cliente_id, puntos_acumulados, total_gastado, ultima_actualizacion)
      SELECT 
        o.cliente_id,
        SUM(FLOOR(o.total / 1000))::INTEGER,
        SUM(o.total),
        NOW()
      FROM ordenes o
      WHERE o.estado = 'retirada' AND o.total > 0
      GROUP BY o.cliente_id
      ON CONFLICT (cliente_id) DO UPDATE
        SET puntos_acumulados = EXCLUDED.puntos_acumulados,
            total_gastado = EXCLUDED.total_gastado,
            ultima_actualizacion = NOW()
      RETURNING cliente_id
    `);
    res.json({ ok: true, clientes_actualizados: r.rowCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get("/cliente/:clienteId", getPuntosCliente);
router.post("/canjear", canjearDescuento);

module.exports = router;
