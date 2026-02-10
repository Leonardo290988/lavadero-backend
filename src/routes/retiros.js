const express = require("express");
const router = express.Router();

const {
  getRetirosPendientes,
  aceptarRetiro,
  rechazarRetiro,
  marcarEnCamino,
  crearRetiroPrePago,
  obtenerPreviewRetiro,
  cancelarRetiroCliente
} = require("../controllers/retirosController");

// Cliente solicita retiro
//router.post("/", solicitarRetiro);
router.post("/prepago", crearRetiroPrePago);

// Listar pendientes
router.get("/pendientes", getRetirosPendientes);
// Preview retiro (app cliente)
router.get("/preview", obtenerPreviewRetiro);

// Local acepta retiro
router.put("/:id/aceptar", aceptarRetiro);

// Local rechaza retiro
router.put("/:id/rechazar", rechazarRetiro);
router.put("/:id/en-camino", marcarEnCamino);

// Cliente cancela retiro
router.put("/:id/cancelar", cancelarRetiroCliente);

module.exports = router;