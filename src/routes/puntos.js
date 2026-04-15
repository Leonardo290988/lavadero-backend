const express = require("express");
const router = express.Router();
const { getPuntosCliente, canjearDescuento } = require("../controllers/puntosController");

router.get("/cliente/:clienteId", getPuntosCliente);
router.post("/canjear", canjearDescuento);

module.exports = router;
