const express = require('express');
const router = express.Router();

const {
  getClientes,
  loginCliente,
  createCliente,
  buscarClientes
} = require('../controllers/clientesController');

// ⚠️ SEARCH SIEMPRE VA ANTES DE '/'
router.get('/search', buscarClientes);
router.post("/login", loginCliente);

router.get('/', getClientes);
router.post('/', createCliente);

module.exports = router;

