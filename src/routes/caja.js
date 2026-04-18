const express = require("express");
const router = express.Router();

const cajaController = require("../controllers/cajaController");

console.log("📦 archivo routes/caja.js cargado");
console.log("💰 ROUTES CAJA CARGADAS");

// Abrir caja
router.post("/abrir", cajaController.abrirCaja);

// Obtener caja actual
router.get("/actual", cajaController.getCajaActual);

// Registrar movimiento
router.post("/movimiento", cajaController.registrarMovimiento);

// Cerrar caja
router.post("/cerrar/:cajaId", cajaController.cerrarCaja);

// Último cierre
router.get("/ultimo-cierre", cajaController.getUltimoCierre);

// Turnos
router.get("/turnos", cajaController.getTurnos);

router.get("/movimientos/:caja_id", cajaController.getDetalleMovimientosTurno);

// Resumen turno individual
router.get("/resumen/turno/:caja_id", cajaController.getResumenTurno);

// Resúmenes
router.get("/resumenes/diarios", cajaController.getResumenesDiarios);
router.get("/resumenes/semanales", cajaController.getResumenesSemanales);
router.get("/resumenes/mensuales", cajaController.getResumenesMensuales);

// Imprimir resumen por ID (diario/semanal/mensual)
router.get("/resumenes/imprimir/:id", cajaController.imprimirResumenPorId);

// Imprimir resumen de turno por caja_id
router.get("/resumenes/imprimir-turno/:caja_id", cajaController.imprimirResumenTurno);

// PDFs
router.get("/pdf/:tipo/:archivo", cajaController.imprimirPDFResumen);

// ⚡ ENDPOINT TEMPORAL — generar resumen semanal de esta semana
router.get("/generar-semanal-hoy", async (req, res) => {
  const pool = require("../db");
  const generarTicketPDF = require("../utils/generarTicketPDF");
  try {
    const hoy = new Date().toISOString().slice(0, 10);

    const existente = await pool.query(`
      SELECT id FROM resumenes
      WHERE tipo='semanal'
        AND fecha_desde BETWEEN DATE_TRUNC('week',$1::date) AND $1::date
      LIMIT 1
    `, [hoy]);

    if (existente.rows.length > 0) {
      return res.json({ ok: false, mensaje: "Ya existe un resumen semanal para esta semana", id: existente.rows[0].id });
    }

    const r = await pool.query(`
      SELECT
        COALESCE(SUM(ingresos_efectivo),0) efectivo,
        COALESCE(SUM(ingresos_digital),0) digital,
        COALESCE(SUM(gastos),0) gastos,
        COALESCE(SUM(guardado),0) guardado,
        COALESCE(SUM(total_ventas),0) total,
        (SELECT caja_final FROM resumenes WHERE tipo='diario'
          AND fecha_desde BETWEEN DATE_TRUNC('week',$1::date) AND $1::date
          ORDER BY fecha_desde DESC LIMIT 1) AS caja
      FROM resumenes
      WHERE tipo='diario'
        AND fecha_desde BETWEEN DATE_TRUNC('week',$1::date) AND $1::date
    `, [hoy]);

    const s = r.rows[0];

    if (!s || Number(s.total) === 0) {
      return res.json({ ok: false, mensaje: "No hay datos diarios esta semana" });
    }

    await pool.query(`
      INSERT INTO resumenes (tipo,fecha_desde,fecha_hasta,ingresos_efectivo,ingresos_digital,gastos,guardado,total_ventas,caja_final)
      VALUES ('semanal',$1,$1,$2,$3,$4,$5,$6,$7)
    `, [hoy, s.efectivo, s.digital, s.gastos, s.guardado, s.total, s.caja]);

    await generarTicketPDF("semanal", {
      periodo: hoy, efectivo: s.efectivo, digital: s.digital,
      gastos: s.gastos, guardado: s.guardado, total: s.total, caja: s.caja
    });

    res.json({ ok: true, mensaje: `Resumen semanal generado para ${hoy}`, total: s.total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;