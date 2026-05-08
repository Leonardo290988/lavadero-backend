const express = require('express');
const router = express.Router();

const {
  getOrdenesCliente,
  getOrdenesListasCliente,
  getOrdenesEnCursoCliente,
  getRetirosHoy,
  getRetiros,
  eliminarServicioDeOrden,
  getServiciosDeOrden, 
  getServiciosOrden,
  confirmarOrden,
  getOrdenesRetiradas,
  getOrdenesListasParaRetiro, 
  getOrdenes,
  crearOrden,
  cerrarOrden,
  retirarOrden,
  agregarServicioAOrden,
  getOrdenesAbiertas,
  actualizarSenia,
  getDetalleOrden,
  reimprimirTicketOrden,
  reimprimirTicketRetiro,
  eliminarOrden,
  getOrdenesSinRetirar,
  registrarRecordatorio,
  actualizarNotas
} = require('../controllers/ordenesController');

router.get("/cliente/:id/listas", getOrdenesListasCliente); // 🆕 ANTES de /cliente/:clienteId
router.get("/cliente/:id/en-curso", getOrdenesEnCursoCliente); // 🆕
router.get("/cliente/:clienteId", getOrdenesCliente);
router.get('/abiertas', getOrdenesAbiertas);
router.get('/retiradas', getOrdenesRetiradas);
router.get('/listas', getOrdenesListasParaRetiro); 
router.get('/retiros-hoy', getRetirosHoy);
router.get('/sin-retirar', getOrdenesSinRetirar);
router.get('/', getOrdenes);
router.post('/', crearOrden);
router.post("/:id/confirmar", confirmarOrden);
router.get("/:id/servicios", getServiciosOrden);
router.get('/:id/detalle', getDetalleOrden);
router.put('/:id/retirar', retirarOrden);
router.put('/:id/senia', actualizarSenia);
router.put('/:id/notas', actualizarNotas);
router.put('/:id/cerrar', cerrarOrden);
router.post('/:id/servicios', agregarServicioAOrden);
router.get('/:id/servicios', getServiciosDeOrden);
router.delete("/servicios/:id", eliminarServicioDeOrden);
router.post("/:id/reimprimir-orden", reimprimirTicketOrden);
router.post("/:id/reimprimir-retiro", reimprimirTicketRetiro);
router.delete("/:id", eliminarOrden);
router.post("/:ordenId/recordatorio", registrarRecordatorio);

// 🆕 Endpoint para disparar manualmente la revisión de multas (testing)
const { ejecutarRevisionMultas } = require("../helpers/cronMultas");
router.post("/multas/ejecutar-ahora", async (req, res) => {
  try {
    await ejecutarRevisionMultas();
    res.json({ ok: true, mensaje: "Revisión de multas ejecutada. Ver logs del servidor." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
