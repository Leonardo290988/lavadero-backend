const express = require('express');
const router = express.Router();

const {
  getServiciosPublicos,
  getServicios,
  createServicio,
  actualizarServicio,
  toggleServicio,
  getHistorialPrecios,
  getAnalisisPrecios
} = require('../controllers/serviciosController');

router.get('/publicos', getServiciosPublicos);
router.get('/historial-precios', getHistorialPrecios);
router.get('/analisis-precios', getAnalisisPrecios);
router.get('/', getServicios);
router.post('/', createServicio);
router.put('/:id', actualizarServicio);
router.put('/:id/toggle', toggleServicio);

module.exports = router;
