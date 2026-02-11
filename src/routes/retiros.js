const express = require("express");
const router = express.Router();

const {
  getRetiroActivoCliente,
  getRetirosPendientes,
  crearRetiroPrePago,
  aceptarRetiro,
  rechazarRetiro,
  marcarEnCamino,
  obtenerPreviewRetiro,
  cancelarRetiroCliente
} = require("../controllers/retirosController");


// Listar pendientes
router.get("/pendientes", getRetirosPendientes);
// Preview retiro (app cliente)
router.get("/preview", obtenerPreviewRetiro);
router.post("/prepago", crearRetiroPrePago);
router.get("/activo", getRetiroActivoCliente);

// Local acepta retiro
router.put("/:id/aceptar", aceptarRetiro);

// Local rechaza retiro
router.put("/:id/rechazar", rechazarRetiro);
router.put("/:id/en-camino", marcarEnCamino);

// Cliente cancela retiro
router.put("/:id/cancelar", cancelarRetiroCliente);

module.exports = router;