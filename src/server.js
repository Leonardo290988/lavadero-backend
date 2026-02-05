require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const path = require("path");

app.use("/pdf", express.static(path.join(__dirname, "pdf")));

app.use(cors({ origin: "*" }));
app.options("*", cors());   // ✅ PRE-FLIGHT CORS FIX
app.use(express.json());

console.log('🔥🔥🔥 ESTE SERVER ES EL NUEVO 🔥🔥🔥');

// RUTAS
const dashboardRoutes = require('./routes/dashboard');
const clientesRoutes = require('./routes/clientes');
const serviciosRoutes = require('./routes/servicios');
const ordenesRoutes  = require('./routes/ordenes');
const cajaRoutes     = require('./routes/caja');
const retirosRoutes = require('./routes/retiros');
const pagosRoutes = require("./routes/pagos");
const webhookRoutes = require("./routes/webhook");
const enviosRoutes = require("./routes/envios");

app.use('/api/dashboard', dashboardRoutes);
app.use('/clientes', clientesRoutes);
app.use('/servicios', serviciosRoutes);
app.use('/ordenes', ordenesRoutes);
app.use('/caja', cajaRoutes);
app.use('/retiros', retirosRoutes);
app.use("/pagos", pagosRoutes);
app.use("/webhook", webhookRoutes);
app.use("/envios", enviosRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});