const express = require("express");
const router = express.Router();
const enviarWhatsApp = require("../helpers/enviarWhatsApp");

// POST /whatsapp/enviar — envía mensaje via bot o devuelve URL manual
router.post("/enviar", async (req, res) => {
  const { telefono, mensaje } = req.body;

  if (!telefono || !mensaje) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  try {
    const result = await enviarWhatsApp({ telefono, mensaje });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
