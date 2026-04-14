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

// ⚡ ENDPOINT TEMPORAL — generar resúmenes históricos
router.get("/generar-historicos", cajaController.generarResumenesHistoricos);

module.exports = router;