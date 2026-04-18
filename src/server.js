process.env.TZ = "America/Argentina/Buenos_Aires";
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const cron = require("node-cron");
const pool = require("./db");
const generarTicketPDF = require("./utils/generarTicketPDF");

const app = express();

console.log("🕒 Hora servidor:", new Date().toString());
console.log("🔥🔥🔥 ESTE SERVER ES EL NUEVO 🔥🔥🔥");

// ========================
// CRON JOBS — RESÚMENES AUTOMÁTICOS
// ========================

// 📅 SEMANAL: todos los sábados a las 19:00 hs (Argentina)
cron.schedule("0 19 * * 6", async () => {
  console.log("⏰ CRON: generando resumen semanal...");
  try {
    const hoy = new Date().toISOString().slice(0, 10);

    // Verificar que no exista ya uno esta semana
    const existente = await pool.query(`
      SELECT id FROM resumenes
      WHERE tipo='semanal'
        AND fecha_desde BETWEEN DATE_TRUNC('week',$1::date) AND $1::date
      LIMIT 1
    `, [hoy]);

    if (existente.rows.length > 0) {
      console.log("⏭️ Ya existe resumen semanal para esta semana, omitiendo.");
      return;
    }

    const r = await pool.query(`
      SELECT
        COALESCE(SUM(ingresos_efectivo),0) efectivo,
        COALESCE(SUM(ingresos_digital),0) digital,
        COALESCE(SUM(gastos),0) gastos,
        COALESCE(SUM(guardado),0) guardado,
        COALESCE(SUM(total_ventas),0) total,
        (
          SELECT caja_final FROM resumenes
          WHERE tipo='diario'
            AND fecha_desde BETWEEN DATE_TRUNC('week',$1::date) AND $1::date
          ORDER BY fecha_desde DESC, id DESC LIMIT 1
        ) AS caja
      FROM resumenes
      WHERE tipo='diario'
        AND fecha_desde BETWEEN DATE_TRUNC('week',$1::date) AND $1::date
    `, [hoy]);

    const s = r.rows[0];

    if (!s || Number(s.total) === 0) {
      console.log("⏭️ No hay datos diarios esta semana, omitiendo resumen semanal.");
      return;
    }

    await pool.query(`
      INSERT INTO resumenes
      (tipo,fecha_desde,fecha_hasta,ingresos_efectivo,ingresos_digital,gastos,guardado,total_ventas,caja_final)
      VALUES ('semanal',$1,$1,$2,$3,$4,$5,$6,$7)
    `, [hoy, s.efectivo, s.digital, s.gastos, s.guardado, s.total, s.caja]);

    await generarTicketPDF("semanal", {
      periodo: hoy,
      efectivo: s.efectivo, digital: s.digital,
      gastos: s.gastos, guardado: s.guardado,
      total: s.total, caja: s.caja
    });

    console.log("✅ Resumen semanal generado para:", hoy);
  } catch (err) {
    console.error("❌ Error generando resumen semanal:", err.message);
  }
}, { timezone: "America/Argentina/Buenos_Aires" });

// 📅 MENSUAL: último día del mes a las 19:00 hs (Argentina)
cron.schedule("0 19 28-31 * *", async () => {
  try {
    const hoy = new Date();
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();

    if (hoy.getDate() !== ultimoDia) return; // Solo si es el último día real del mes

    console.log("⏰ CRON: generando resumen mensual...");
    const fechaStr = hoy.toISOString().slice(0, 10);

    const existente = await pool.query(`
      SELECT id FROM resumenes
      WHERE tipo='mensual'
        AND DATE_TRUNC('month',fecha_desde) = DATE_TRUNC('month',$1::date)
      LIMIT 1
    `, [fechaStr]);

    if (existente.rows.length > 0) {
      console.log("⏭️ Ya existe resumen mensual para este mes, omitiendo.");
      return;
    }

    const r = await pool.query(`
      SELECT
        COALESCE(SUM(ingresos_efectivo),0) efectivo,
        COALESCE(SUM(ingresos_digital),0) digital,
        COALESCE(SUM(gastos),0) gastos,
        COALESCE(SUM(guardado),0) guardado,
        COALESCE(SUM(total_ventas),0) total,
        (
          SELECT caja_final FROM resumenes
          WHERE tipo='diario'
            AND DATE_TRUNC('month',fecha_desde) = DATE_TRUNC('month',$1::date)
          ORDER BY fecha_desde DESC, id DESC LIMIT 1
        ) AS caja
      FROM resumenes
      WHERE tipo='diario'
        AND DATE_TRUNC('month',fecha_desde) = DATE_TRUNC('month',$1::date)
    `, [fechaStr]);

    const m = r.rows[0];

    if (!m || Number(m.total) === 0) {
      console.log("⏭️ No hay datos diarios este mes, omitiendo resumen mensual.");
      return;
    }

    await pool.query(`
      INSERT INTO resumenes
      (tipo,fecha_desde,fecha_hasta,ingresos_efectivo,ingresos_digital,gastos,guardado,total_ventas,caja_final)
      VALUES ('mensual',$1,$1,$2,$3,$4,$5,$6,$7)
    `, [fechaStr, m.efectivo, m.digital, m.gastos, m.guardado, m.total, m.caja]);

    await generarTicketPDF("mensual", {
      periodo: fechaStr,
      efectivo: m.efectivo, digital: m.digital,
      gastos: m.gastos, guardado: m.guardado,
      total: m.total, caja: m.caja
    });

    console.log("✅ Resumen mensual generado para:", fechaStr);
  } catch (err) {
    console.error("❌ Error generando resumen mensual:", err.message);
  }
}, { timezone: "America/Argentina/Buenos_Aires" });

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
app.use("/caja/pdf", express.static(path.join(__dirname, "pdf")));

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
app.use("/notificaciones", require("./routes/notificaciones"));
app.use("/puntos", require("./routes/puntos"));
app.use("/estadisticas", require("./routes/estadisticas"));
app.use("/contabilidad", require("./routes/contabilidad"));
app.use("/contabilidad", require("./routes/contabilidad"));

// ========================
// SERVER
// ========================
const PORT = 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor corriendo en http://0.0.0.0:${PORT}`);
});