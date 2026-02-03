

const express = require('express');
const router = express.Router();

console.log('🚨🚨🚨 SERVICIOS ROUTE REAL CARGADO 🚨🚨🚨');

const {
  getServicios,
  createServicio,
} = require('../controllers/serviciosController');

// GET /servicios → DB
router.get('/', getServicios);

// POST /servicios → DB
router.post('/', createServicio);

module.exports = router;