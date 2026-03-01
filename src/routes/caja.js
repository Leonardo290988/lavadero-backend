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

router.get("/caja/movimientos/:caja_id", cajaController.getDetalleMovimientosTurno);

// Resumen turno individual
router.get("/resumen/turno/:caja_id", cajaController.getResumenTurno);

// Resúmenes
router.get("/resumenes/diarios", cajaController.getResumenesDiarios);
router.get("/resumenes/semanales", cajaController.getResumenesSemanales);
router.get("/resumenes/mensuales", cajaController.getResumenesMensuales);

// Imprimir resumen por ID
router.get("/resumenes/imprimir/:id", cajaController.imprimirResumenPorId);

// PDFs
router.get("/pdf/:tipo/:archivo", cajaController.imprimirPDFResumen);

module.exports = router;