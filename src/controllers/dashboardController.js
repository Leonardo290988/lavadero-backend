const pool = require('../db');
 
const getDashboard = async (req, res) => { 
  try {

    // Caja abierta
  const cajaResult = await pool.query(`
  SELECT id, inicio_caja
  FROM turnos_caja
  WHERE estado = 'abierta'
  ORDER BY id DESC
  LIMIT 1
`);

    const inicioCaja = cajaResult.rows.length
      ? Number(cajaResult.rows[0].inicio_caja)
      : 0;

    // INGRESOS TOTALES HOY
   const ingresosResult = await pool.query(`
  SELECT COALESCE(SUM(monto),0) AS total
  FROM caja_movimientos
  WHERE tipo = 'ingreso'
    AND
      (creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
      =
      (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
`);

    const ingresosDia = Number(ingresosResult.rows[0].total);

    // INGRESOS EFECTIVO
     const efectivoResult = await pool.query(`
  SELECT COALESCE(SUM(monto),0) AS total
  FROM caja_movimientos
  WHERE tipo = 'ingreso'
    AND forma_pago = 'Efectivo'
    AND
      (creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
      =
      (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
`);

    const ingresosEfectivo = Number(efectivoResult.rows[0].total);

    // INGRESOS DIGITALES
   const digitalResult = await pool.query(`
  SELECT COALESCE(SUM(monto),0) AS total
  FROM caja_movimientos
  WHERE tipo = 'ingreso'
    AND forma_pago != 'Efectivo'
    AND
      (creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
      =
      (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
`);

    const ingresosDigital = Number(digitalResult.rows[0].total);

    // ORDENES HOY
    const ordenesResult = await pool.query(`
  SELECT COUNT(*) AS total
  FROM ordenes
  WHERE
    (fecha_ingreso AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
    =
    (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
`);

    const ordenesHoy = Number(ordenesResult.rows[0].total);

    // ✅ CAJA ACTUAL REAL (inicio + ingresos - gastos - guardado)
    let cajaActual = inicioCaja;

    if (cajaResult.rows.length) {

      const cajaId = cajaResult.rows[0].id;

const resumen = await pool.query(`
 SELECT
  COALESCE(SUM(CASE 
    WHEN tipo='ingreso' AND forma_pago='Efectivo' THEN monto END),0) AS ingresos_efectivo,

  COALESCE(SUM(CASE 
    WHEN tipo='gasto' THEN monto END),0) AS gastos,

  COALESCE(SUM(CASE 
    WHEN tipo='guardado' THEN monto END),0) AS guardado

FROM caja_movimientos
WHERE caja_id = $1
`,[cajaId]);
      const ingresosEf = Number(resumen.rows[0].ingresos_efectivo);
      const gastos = Number(resumen.rows[0].gastos);
      const guardado = Number(resumen.rows[0].guardado);

      cajaActual = inicioCaja + ingresosEf - gastos - guardado;
    }

    res.json({
      cajaActual,
      ingresosDia,
      ingresosEfectivo,
      ingresosDigital,
      ordenesHoy
    });

  } catch (error) {
    console.error("❌ ERROR DASHBOARD:", error.message);
    res.status(500).json({ error: "Error dashboard" });
  } 
};
 
module.exports = { getDashboard };