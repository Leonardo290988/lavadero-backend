const express = require("express");
const router = express.Router();
const pool = require("../db");

// Importar funciones del controller de forma segura
const puntosCtrl = require("../controllers/puntosController");

// Cargar puntos históricos desde órdenes retiradas (endpoint temporal)
router.get("/cargar-historicos", async (req, res) => {
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

router.get("/todos", puntosCtrl.getTodosLosPuntos);
router.get("/cliente/:clienteId", puntosCtrl.getPuntosCliente);
router.post("/canjear", puntosCtrl.canjearDescuento);

module.exports = router;
