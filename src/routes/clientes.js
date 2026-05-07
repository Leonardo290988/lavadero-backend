const express = require('express');
const router = express.Router();

const {
  getClientes,
  loginCliente,
  getClienteById,
  createCliente,
  buscarClientes,
  getClientesInactivos,
  marcarContactado,
  guardarPushToken,
  actualizarCliente
} = require('../controllers/clientesController');

// ⚠️ SEARCH SIEMPRE VA ANTES DE '/'
router.get('/search', buscarClientes);
router.get('/inactivos', getClientesInactivos);
router.post('/contactado/:clienteId', marcarContactado);
router.post("/login", loginCliente);

// 🔔 Push token de la app del cliente
router.post('/push-token', guardarPushToken);

// 🆕 Actualizar datos del cliente desde la app
router.put('/:id', actualizarCliente);

router.get('/:id', getClienteById);

router.get('/', getClientes);
router.post('/', createCliente);

module.exports = router;
