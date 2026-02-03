const express = require("express");
const router = express.Router();
const { crearPreferencia } = require("../controllers/pagosController");

router.post("/crear-preferencia", crearPreferencia);

module.exports = router;