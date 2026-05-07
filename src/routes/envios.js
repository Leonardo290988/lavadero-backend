const express = require("express");
const router = express.Router();

const {
  getEnvioActivo,
  crearEnvioPrePago,
  crearEnvioDesdeOrden,
  entregarEnvio,
  getEnviosEntregados,
  getEnviosPendientes,
  envioFallido,
  marcarEnvioEnCamino
} = require("../controllers/enviosController");

router.get("/activo", getEnvioActivo);
router.post("/prepago", crearEnvioPrePago);
router.get("/pendientes", getEnviosPendientes);
router.post("/desde-orden", crearEnvioDesdeOrden);

router.put("/:id/entregar", entregarEnvio);
router.put("/:id/fallido", envioFallido);
router.put("/:id/en-camino", marcarEnvioEnCamino); // 🆕
router.get("/entregados", getEnviosEntregados);

module.exports = router;
