

const express = require('express');
const router = express.Router();

console.log('🚨🚨🚨 SERVICIOS ROUTE REAL CARGADO 🚨🚨🚨');

const {
  getServiciosPublicos,
  getServicios,
  createServicio,
} = require('../controllers/serviciosController');

// GET /servicios → DB
router.get('/', getServicios);

router.get("/servicios/publicos", getServiciosPublicos);

// POST /servicios → DB
router.post('/', createServicio);

module.exports = router;