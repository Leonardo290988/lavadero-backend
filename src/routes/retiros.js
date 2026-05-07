const express = require("express");
const router = express.Router();

const {
  getRetiroActivoCliente,
  getRetirosPendientes,
  getRetirosCliente,
  crearRetiroPrePago,
  aceptarRetiro,
  rechazarRetiro,
  marcarEnCamino,
  marcarRetirado,
  obtenerPreviewRetiro,
  cancelarRetiroCliente
} = require("../controllers/retirosController");


// Listar pendientes
router.get("/pendientes", getRetirosPendientes);
// Preview retiro (app cliente)
router.get("/preview", obtenerPreviewRetiro);
router.post("/prepago", crearRetiroPrePago);
router.get("/activo", getRetiroActivoCliente);

// 🆕 Listar retiros del cliente (para pantalla "Mis órdenes" en la app)
router.get("/cliente/:id", getRetirosCliente);

// Local acepta retiro
router.put("/:id/aceptar", aceptarRetiro);
router.put("/:id/retirado", marcarRetirado);

// Local rechaza retiro
router.put("/:id/rechazar", rechazarRetiro);
router.put("/:id/en-camino", marcarEnCamino);

// Cliente cancela retiro
router.put("/:id/cancelar", cancelarRetiroCliente);

module.exports = router;
