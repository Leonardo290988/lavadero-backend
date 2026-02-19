const express = require("express");
const router = express.Router();
const { generarQR,
    crearPreferencia } = require("../controllers/pagosController");

router.post("/crear-preferencia", crearPreferencia);
router.post("/qr", generarQR);

module.exports = router;