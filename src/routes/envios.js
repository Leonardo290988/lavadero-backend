const express = require("express");
const router = express.Router();

const {
  getEnvioActivo,
  crearEnvioPrePago,
  crearEnvioDesdeOrden,
  entregarEnvio,
  getEnviosEntregados,
  getEnviosPendientes
} = require("../controllers/enviosController");
router.get("/activo", getEnvioActivo);
router.post("/prepago", crearEnvioPrePago);
router.get("/pendientes", getEnviosPendientes);
router.post("/desde-orden", crearEnvioDesdeOrden);

router.put("/:id/entregar", entregarEnvio);
router.get("/entregados", getEnviosEntregados);

module.exports = router;