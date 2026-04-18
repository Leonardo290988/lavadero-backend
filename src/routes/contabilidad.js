const express = require("express");
const router = express.Router();
const { getMovimientos, crearMovimiento, eliminarMovimiento, getBalanceMensual } = require("../controllers/contabilidadController");

router.get("/", getMovimientos);
router.post("/", crearMovimiento);
router.delete("/:id", eliminarMovimiento);
router.get("/balance", getBalanceMensual);

module.exports = router;
