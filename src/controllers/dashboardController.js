const pool = require('../db');
 
const getDashboard = async (req, res) => { 
  try {

    // ===============================
    // CAJA ABIERTA (solo para cajaActual)
    // ===============================
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

    // ===============================
    // INGRESOS DEL DÍA (RESUMEN DIARIO)
    // ===============================
    const ingresosDiaResult = await pool.query(`
      SELECT
        COALESCE(SUM(total_ventas),0) AS total,
        COALESCE(SUM(ingresos_efectivo),0) AS efectivo,
        COALESCE(SUM(ingresos_digital),0) AS digital
      FROM resumenes
      WHERE tipo = 'diario'
        AND fecha_desde = (
          CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires'
        )::date
    `);

    let ingresosDia = Number(ingresosDiaResult.rows[0].total);
    let ingresosEfectivo = Number(ingresosDiaResult.rows[0].efectivo);
    let ingresosDigital = Number(ingresosDiaResult.rows[0].digital);

    // ===============================
    // SUMAR TURNO ABIERTO (si existe)
    // ===============================
    if (cajaResult.rows.length) {
      const cajaId = cajaResult.rows[0].id;

      const turnoActual = await pool.query(`
        SELECT
          COALESCE(SUM(CASE 
            WHEN tipo='ingreso' THEN monto END),0) AS total,
          COALESCE(SUM(CASE 
            WHEN tipo='ingreso' AND forma_pago='Efectivo' THEN monto END),0) AS efectivo,
          COALESCE(SUM(CASE 
            WHEN tipo='ingreso' AND forma_pago!='Efectivo' THEN monto END),0) AS digital
        FROM caja_movimientos
        WHERE caja_id = $1
      `,[cajaId]);

      ingresosDia += Number(turnoActual.rows[0].total);
      ingresosEfectivo += Number(turnoActual.rows[0].efectivo);
      ingresosDigital += Number(turnoActual.rows[0].digital);
    }

    // ===============================
    // ÓRDENES DEL DÍA
    // ===============================
    const ordenesResult = await pool.query(`
      SELECT COUNT(*) AS total
      FROM ordenes
      WHERE
        (fecha_ingreso AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
        =
        (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
    `);

    const ordenesHoy = Number(ordenesResult.rows[0].total);

    // ===============================
    // CAJA ACTUAL REAL
    // ===============================
    let cajaActual = inicioCaja;

    if (cajaResult.rows.length) {
      const cajaId = cajaResult.rows[0].id;

      const resumenCaja = await pool.query(`
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

      const ingresosEf = Number(resumenCaja.rows[0].ingresos_efectivo);
      const gastos = Number(resumenCaja.rows[0].gastos);
      const guardado = Number(resumenCaja.rows[0].guardado);

      cajaActual = inicioCaja + ingresosEf - gastos - guardado;
    }

    // ===============================
    // RESPUESTA
    // ===============================
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