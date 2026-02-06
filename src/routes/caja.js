const express = require('express');
const router = express.Router();

console.log("📦 archivo routes/caja.js cargado");

const {
  abrirCaja,
  getCajaActual,
  imprimirPDFResumen,
  imprimirResumenPorId,
  registrarMovimiento,
  getUltimoCierre,
  cerrarCaja,
  getTurnos,
  getResumenTurno,
  getResumenesDiarios,
  getResumenesSemanales,
  getResumenesMensuales
} = require('../controllers/cajaController');

console.log('💰 ROUTES CAJA CARGADAS');

// Abrir caja
router.post('/abrir', abrirCaja);

// Obtener caja actual
router.get('/actual', getCajaActual);
router.get("/resumenes/imprimir/:id", imprimirResumenPorId);


router.get('/pdf/:tipo/:archivo', imprimirPDFResumen);
router.get('/ultimo-cierre', getUltimoCierre);

router.get('/resumenes/semanales', getResumenesSemanales);
router.get('/resumenes/mensuales', getResumenesMensuales);

// Registrar movimiento
router.post('/movimiento', registrarMovimiento);

// Resumen diario
router.get('/resumenes/diarios', getResumenesDiarios);

// Resumen por turno
router.get('/resumen/turno/:caja_id', getResumenTurno);

router.get("/turnos", getTurnos);

// Cerrar caja
router.post('/cerrar/:cajaId', cerrarCaja);

module.exports = router;