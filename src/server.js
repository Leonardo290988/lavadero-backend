process.env.TZ = "America/Argentina/Buenos_Aires";
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

console.log("🕒 Hora servidor:", new Date().toString());
console.log("🔥🔥🔥 ESTE SERVER ES EL NUEVO 🔥🔥🔥");

// ========================
// MIDDLEWARES
// ========================
app.use(cors({ origin: "*" }));
app.options("*", cors());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  next();
});

app.use(express.json());

// ========================
// ARCHIVOS ESTÁTICOS
// ========================
app.use("/pdf", express.static(path.join(__dirname, "pdf")));

// ========================
// RUTAS
// ========================
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/clientes", require("./routes/clientes"));
app.use("/servicios", require("./routes/servicios"));
app.use("/ordenes", require("./routes/ordenes"));
app.use("/caja", require("./routes/caja"));
app.use("/retiros", require("./routes/retiros"));
app.use("/pagos", require("./routes/pagos"));
app.use("/webhook", require("./routes/webhook"));
app.use("/envios", require("./routes/envios"));
app.use("/usuarios", require("./routes/usuarios"));
app.use("/auth", require("./routes/auth"));

// ========================
// SERVER
// ========================
const PORT = 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor corriendo en http://0.0.0.0:${PORT}`);
});