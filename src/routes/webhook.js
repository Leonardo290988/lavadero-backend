const express = require("express");
const router = express.Router();
const { webhookMercadoPago } = require("../controllers/webhookController");

router.post("/mercadopago", webhookMercadoPago);

module.exports = router;