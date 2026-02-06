const express = require("express");
const router = express.Router();

const { login } = require("../controllers/usuariosController");

router.post("/login", login);

module.exports = router;