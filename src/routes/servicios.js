const express = require('express');
const router = express.Router();

const {
  getServiciosPublicos,
  getServicios,
  createServicio,
  actualizarServicio,
  toggleServicio
} = require('../controllers/serviciosController');

router.get('/publicos', getServiciosPublicos);
router.get('/', getServicios);
router.post('/', createServicio);
router.put('/:id', actualizarServicio);
router.put('/:id/toggle', toggleServicio);

module.exports = router;
