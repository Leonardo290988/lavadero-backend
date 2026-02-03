const express = require("express");
const router = express.Router();

const {
  crearEnvioPrePago,
  entregarEnvio,
  getEnviosEntregados,
  marcarEnvioEntregado,
  getEnviosPendientes
} = require("../controllers/enviosController");

router.post("/prepago", crearEnvioPrePago);
router.get("/pendientes", getEnviosPendientes);
router.put("/:id/entregar", marcarEnvioEntregado);
router.put("/:id/entregar", entregarEnvio);
router.get("/entregados", getEnviosEntregados);

module.exports = router;