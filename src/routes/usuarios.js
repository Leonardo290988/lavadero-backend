const express = require("express");
const router = express.Router();

const { login, cambiarPassword } = require("../controllers/usuariosController");

router.post("/login", login);
router.post("/cambiar-password", cambiarPassword);

module.exports = router;
