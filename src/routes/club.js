const express = require("express");
const router = express.Router();
const { getValets, crearValet, actualizarValet, eliminarValet, marcarFacturado, getResumenFactura } = require("../controllers/clubController");

router.get("/resumen-factura", getResumenFactura);
router.get("/", getValets);
router.post("/", crearValet);
router.put("/facturar", marcarFacturado);
router.put("/:id", actualizarValet);
router.delete("/:id", eliminarValet);

module.exports = router;
