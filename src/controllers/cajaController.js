import { fechaArgentina } from "../utils/fecha";
const pool = require('../db');
const generarTicketPDF = require("../utils/generarTicketPDF");
const path = require("path");


// ======================================
// ABRIR CAJA
// ======================================
const abrirCaja = async (req, res) => {
  console.log("📥 BODY abrirCaja:", req.body);
  const { turno, inicio_caja } = req.body;

  if (inicio_caja === undefined || inicio_caja === null) {
    return res.status(400).json({ error: "Monto inicial requerido" });
  }

  try {

    // 👉 Verificar SOLO cajas ABIERTAS hoy en ese turno
    const existente = await pool.query(
      `
      SELECT id
      FROM turnos_caja
      WHERE fecha = CURRENT_DATE
        AND turno = $1
      `,
      [turno]
    );

    if (existente.rows.length > 0) {
      return res.status(400).json({
        error: "Turno seleccionado erroneo para abrir Caja"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO turnos_caja
      (fecha, turno, inicio_caja, estado)
      VALUES (CURRENT_DATE, $1, $2, 'abierta')
      RETURNING *
      `,
      [turno, inicio_caja]
    );

    res.json(result.rows[0]);

  } catch (error) {
    console.error("ERROR abrirCaja:", error);
    res.status(500).json({ error: "Error al abrir caja" });
  }
};

// ======================================
// OBTENER CAJA ABIERTA
// ======================================
const getCajaActual = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM turnos_caja
      WHERE fecha = CURRENT_DATE
        AND estado = 'abierta'
      ORDER BY id DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No hay caja abierta' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('ERROR CAJA ACTUAL:', error);
    res.status(500).json({ error: 'Error al obtener caja actual' });
  }
};

// ======================================
// REGISTRAR MOVIMIENTO
// ======================================
const registrarMovimiento = async (req, res) => {
  const { caja_id, tipo, descripcion, monto, forma_pago } = req.body;

  try {
    await pool.query(
      `
      INSERT INTO caja_movimientos
      (caja_id, tipo, descripcion, monto, forma_pago)
      VALUES ($1,$2,$3,$4,$5)
      `,
      [caja_id, tipo, descripcion, monto, forma_pago]
    );

    res.json({ ok: true });

  } catch (error) {
    console.error("ERROR movimiento:", error);
    res.status(500).json({ error: "Error movimiento" });
  }
};

// ======================================
// RESUMEN TURNO
// ======================================
const getResumenTurno = async (req, res) => {
  const { caja_id } = req.params;

try {

 const result = await pool.query(
  `
  SELECT
    COALESCE(SUM(CASE 
      WHEN tipo='ingreso' AND forma_pago='Efectivo' THEN monto END),0) AS ingresos_efectivo,

    COALESCE(SUM(CASE 
      WHEN tipo='ingreso' AND forma_pago='Transferencia/MercadoPago' THEN monto END),0) AS transferencias,

    COALESCE(SUM(CASE 
      WHEN tipo='gasto' THEN monto END),0) AS gastos,

    COALESCE(SUM(CASE 
      WHEN tipo='guardado' THEN monto END),0) AS guardado

  FROM caja_movimientos
  WHERE caja_id = $1
  `,
  [caja_id]
);

  const caja = await pool.query(
   ` SELECT inicio_caja FROM turnos_caja WHERE id=$1`,
    [caja_id]
  );

  const inicio = Number(caja.rows[0].inicio_caja);
  const ingresosEf = Number(result.rows[0].ingresos_efectivo);
  const transfer = Number(result.rows[0].transferencias);
  const gastos = Number(result.rows[0].gastos);
  const guardado = Number(result.rows[0].guardado);

  const efectivo_final = inicio + ingresosEf - gastos - guardado;

  res.json({
  ingresos_efectivo: ingresosEf,
  transferencias: transfer,
  gastos,
  guardado,
  total_ventas: ingresosEf + transfer,
  efectivo_final
});

} catch (error) {
  console.error("ERROR resumen:", error);
  res.status(500).json({ error: "Error resumen" });
}
}

// ======================================
// CERRAR CAJA
// ======================================
const cerrarCaja = async (req, res) => {
  const { cajaId } = req.params;

  try {

    const result = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo='ingreso' AND forma_pago='Efectivo' THEN monto END),0) AS ingresos,
        COALESCE(SUM(CASE WHEN tipo='ingreso' AND forma_pago!='Efectivo' THEN monto END),0) AS ingresos_digital,
        COALESCE(SUM(CASE WHEN tipo='gasto' THEN monto END),0) AS gastos,
        COALESCE(SUM(CASE WHEN tipo='guardado' THEN monto END),0) AS guardado
      FROM caja_movimientos
      WHERE caja_id=$1
    `,[cajaId]);

    const caja = await pool.query(
      `SELECT inicio_caja, fecha, turno, creado_en FROM turnos_caja WHERE id=$1`,
      [cajaId]
    );

    const inicio = Number(caja.rows[0].inicio_caja);
    const ingresos = Number(result.rows[0].ingresos);
    const digital = Number(result.rows[0].ingresos_digital);
    const gastos = Number(result.rows[0].gastos);
    const guardado = Number(result.rows[0].guardado);

    const efectivoFinal = inicio + ingresos - gastos - guardado;
    const totalVentas = ingresos + digital;

    // ========= TURNO =========
    await pool.query(`
      INSERT INTO resumenes
      (tipo,fecha_desde,fecha_hasta,turno,
       ingresos_efectivo,ingresos_digital,
       gastos,guardado,total_ventas,caja_final,ordenes)
      VALUES
      ('turno',$1,$1,$2,$3,$4,$5,$6,$7,$8,0)
    `,
    [
      caja.rows[0].fecha,
      caja.rows[0].turno,
      ingresos,
      digital,
      gastos,
      guardado,
      totalVentas,
      efectivoFinal
    ]);

    await generarTicketPDF("turno", {
      periodo: `${caja.rows[0].fecha} ${caja.rows[0].turno} ${fechaArgentina()}`,
      efectivo: ingresos,
      digital,
      gastos,
      guardado,
      total: totalVentas,
      caja: efectivoFinal
    });

    // ========= DIARIO =========
    if (caja.rows[0].turno === "tarde") {

      const diarios = await pool.query(`
        SELECT
          COALESCE(SUM(ingresos_efectivo),0) efectivo,
          COALESCE(SUM(ingresos_digital),0) digital,
          COALESCE(SUM(gastos),0) gastos,
          COALESCE(SUM(guardado),0) guardado,
          COALESCE(SUM(total_ventas),0) total,
          COALESCE(SUM(caja_final),0) caja
        FROM resumenes
        WHERE tipo='turno'
        AND fecha_desde=$1
      `,[caja.rows[0].fecha]);

      const d = diarios.rows[0];

      await pool.query(`
        INSERT INTO resumenes
        (tipo,fecha_desde,fecha_hasta,
         ingresos_efectivo,ingresos_digital,
         gastos,guardado,total_ventas,caja_final)
        VALUES ('diario',$1,$1,$2,$3,$4,$5,$6,$7)
      `,
      [
        caja.rows[0].fecha,
        d.efectivo,
        d.digital,
        d.gastos,
        d.guardado,
        d.total,
        d.caja
      ]);

      await generarTicketPDF("diario", {
        periodo: fechaArgentina(),
        efectivo: d.efectivo,
        digital: d.digital,
        gastos: d.gastos,
        guardado: d.guardado,
        total: d.total,
        caja: d.caja
      });
    }

    // ========= SEMANAL =========
    const fechaCaja = fechaArgentina(caja.rows[0].fecha);

    if (fechaCaja.getDay() === 6) {

      const semanal = await pool.query(`
        SELECT
          COALESCE(SUM(ingresos_efectivo),0) efectivo,
          COALESCE(SUM(ingresos_digital),0) digital,
          COALESCE(SUM(gastos),0) gastos,
          COALESCE(SUM(guardado),0) guardado,
          COALESCE(SUM(total_ventas),0) total,
          COALESCE(SUM(caja_final),0) caja
        FROM resumenes
        WHERE tipo='diario'
        AND fecha_desde BETWEEN
        DATE_TRUNC('week',$1::date) AND $1::date
      `,[caja.rows[0].fecha]);

      const s = semanal.rows[0];

      await pool.query(`
        INSERT INTO resumenes
        (tipo,fecha_desde,fecha_hasta,
         ingresos_efectivo,ingresos_digital,
         gastos,guardado,total_ventas,caja_final)
        VALUES ('semanal',$1,$1,$2,$3,$4,$5,$6,$7)
      `,
      [
        caja.rows[0].fecha,
        s.efectivo,
        s.digital,
        s.gastos,
        s.guardado,
        s.total,
        s.caja
      ]);

      await generarTicketPDF("semanal", {
        periodo: fechaArgentina(),
        efectivo: s.efectivo,
        digital: s.digital,
        gastos: s.gastos,
        guardado: s.guardado,
        total: s.total,
        caja: s.caja
      });
    }

    // ========= MENSUAL =========
    const ultimoDia = new Date(
      fechaCaja.getFullYear(),
      fechaCaja.getMonth() + 1,
      0
    ).getDate();

    if (fechaCaja.getDate() === ultimoDia) {

      const mensual = await pool.query(`
        SELECT
          COALESCE(SUM(ingresos_efectivo),0) efectivo,
          COALESCE(SUM(ingresos_digital),0) digital,
          COALESCE(SUM(gastos),0) gastos,
          COALESCE(SUM(guardado),0) guardado,
          COALESCE(SUM(total_ventas),0) total,
          COALESCE(SUM(caja_final),0) caja
        FROM resumenes
        WHERE tipo='diario'
        AND DATE_TRUNC('month',fecha_desde)
        = DATE_TRUNC('month',$1::date)
      `,[caja.rows[0].fecha]);

      const m = mensual.rows[0];

      await pool.query(`
        INSERT INTO resumenes
        (tipo,fecha_desde,fecha_hasta,
         ingresos_efectivo,ingresos_digital,
         gastos,guardado,total_ventas,caja_final)
        VALUES ('mensual',$1,$1,$2,$3,$4,$5,$6,$7)
      `,
      [
        caja.rows[0].fecha,
        m.efectivo,
        m.digital,
        m.gastos,
        m.guardado,
        m.total,
        m.caja
      ]);

      await generarTicketPDF("mensual", {
        periodo: fechaArgentina(),
        efectivo: m.efectivo,
        digital: m.digital,
        gastos: m.gastos,
        guardado: m.guardado,
        total: m.total,
        caja: m.caja
      });
    }

    // ========= CIERRE =========
    await pool.query(`
      UPDATE turnos_caja
      SET estado='cerrada',
          cierre_caja=NOW(),
          monto_cierre=$2
      WHERE id=$1
    `,[cajaId, efectivoFinal]);

    res.json({ ok:true, efectivoFinal });

  } catch (error) {
    console.error("ERROR cerrarCaja:", error);
    res.status(500).json({ error: "Error cerrar caja" });
  }
};

// =======================
const imprimirPDFResumen = async (req,res)=>{
  const { tipo, archivo } = req.params;

  const ruta = path.join(
    __dirname,
    "..",
    "pdf",
    tipo,
    archivo
  );

  res.sendFile(ruta);
};

// =======================
const getResumenesDiarios = async (req,res)=>{
  const r = await pool.query(`
  SELECT 
    id,
    fecha_desde,
    creado_en,
    ingresos_efectivo,
    ingresos_digital,
    gastos,
    guardado,
    total_ventas,
    caja_final
  FROM resumenes
  WHERE tipo='diario'
  ORDER BY creado_en DESC
`);
  res.json(r.rows);
};

const getResumenesSemanales = async (req,res)=>{
 const r = await pool.query(`
  SELECT 
    id,
    fecha_desde,
    creado_en,
    ingresos_efectivo,
    ingresos_digital,
    gastos,
    guardado,
    total_ventas,
    caja_final
  FROM resumenes
  WHERE tipo='semanal'
  ORDER BY creado_en DESC
`);
  res.json(r.rows);
};

const getResumenesMensuales = async (req,res)=>{
 const r = await pool.query(`
  SELECT 
    id,
    fecha_desde,
    creado_en,
    ingresos_efectivo,
    ingresos_digital,
    gastos,
    guardado,
    total_ventas,
    caja_final
  FROM resumenes
  WHERE tipo='mensual'
  ORDER BY creado_en DESC
`);
  res.json(r.rows);
};

const getUltimoCierre = async (req,res)=>{
  const r = await pool.query(`
    SELECT monto_cierre
    FROM turnos_caja
    WHERE estado='cerrada'
    ORDER BY id DESC
    LIMIT 1
  `);

  if (r.rows.length === 0) {
    return res.json({ monto: 0 });
  }

  res.json({
    monto: r.rows[0].monto_cierre
  });
};
    
module.exports = {
  abrirCaja,
  getCajaActual,
  registrarMovimiento,
  getUltimoCierre,
  cerrarCaja,
  getResumenTurno,
  imprimirPDFResumen,
  getResumenesDiarios,
  getResumenesSemanales,
  getResumenesMensuales
};