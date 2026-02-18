const express = require('express');
const router = express.Router();

const {
  getOrdenesCliente,
  getRetirosHoy,
  getRetiros,
  getServiciosPublicos,
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
  getDetalleOrden   
} = require('../controllers/ordenesController');

console.log({
  getOrdenes,
  crearOrden,
  agregarServicioAOrden,
  getServiciosDeOrden,
  getOrdenesAbiertas,
  getDetalleOrden   
});
router.get("/cliente/:clienteId", getOrdenesCliente);
router.get("/servicios/publicos", getServiciosPublicos);
router.get('/abiertas', getOrdenesAbiertas);
router.get('/retiradas', getOrdenesRetiradas);
router.get("/:id/servicios", getServiciosOrden);
router.get('/listas', getOrdenesListasParaRetiro); 
router.get('/', getOrdenes);
router.post('/', crearOrden);
router.post("/:id/confirmar", confirmarOrden);
router.get('/retiros-hoy', getRetirosHoy);
router.get('/:id/detalle', getDetalleOrden);
router.put('/:id/retirar', retirarOrden);
router.put('/:id/senia', actualizarSenia);
router.put('/:id/cerrar', cerrarOrden);
router.post('/:id/servicios', agregarServicioAOrden);
router.get('/:id/servicios', getServiciosDeOrden);
router.delete("/servicios/:id", eliminarServicioDeOrden);
module.exports = router;