const express = require("express");
const router = express.Router();
const {
  getServiciosMasVendidos,
  getDiasMasMovidos,
  getTicketPromedio,
  getComparativaSemanal,
  getClientesNuevosVsRecurrentes
} = require("../controllers/estadisticasController");

router.get("/servicios-mas-vendidos", getServiciosMasVendidos);
router.get("/dias-mas-movidos", getDiasMasMovidos);
router.get("/ticket-promedio", getTicketPromedio);
router.get("/comparativa-semanal", getComparativaSemanal);
router.get("/clientes-nuevos-vs-recurrentes", getClientesNuevosVsRecurrentes);

module.exports = router;
