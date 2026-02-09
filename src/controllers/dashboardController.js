const pool = require('../db');

const getDashboard = async (req, res) => {
  try {

    // ===============================
    // FECHA HOY (ARGENTINA)
    // ===============================
    const fechaHoyResult = await pool.query(`
      SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS hoy
    `);
    const hoy = fechaHoyResult.rows[0].hoy;

    // ===============================
    // INGRESOS DEL DÍA (POR TURNOS)
    // ===============================
    const ingresosResult = await pool.query(`
      SELECT
        COALESCE(SUM(cm.monto),0) AS total,
        COALESCE(SUM(CASE WHEN cm.forma_pago = 'Efectivo' THEN cm.monto END),0) AS efectivo,
        COALESCE(SUM(CASE WHEN cm.forma_pago != 'Efectivo' THEN cm.monto END),0) AS digital
      FROM caja_movimientos cm
      JOIN turnos_caja tc ON tc.id = cm.caja_id
      WHERE cm.tipo = 'ingreso'
        AND tc.fecha = $1
    `, [hoy]);

    const ingresosDia = Number(ingresosResult.rows[0].total);
    const ingresosEfectivo = Number(ingresosResult.rows[0].efectivo);
    const ingresosDigital = Number(ingresosResult.rows[0].digital);

    // ===============================
    // ÓRDENES DEL DÍA
    // ===============================
    const ordenesResult = await pool.query(`
      SELECT COUNT(*) AS total
      FROM ordenes
      WHERE DATE(fecha_ingreso) = $1
    `, [hoy]);

    const ordenesHoy = Number(ordenesResult.rows[0].total);

    // ===============================
    // CAJA ACTUAL (SOLO CAJA ABIERTA)
    // ===============================
    const cajaResult = await pool.query(`
      SELECT id, inicio_caja
      FROM turnos_caja
      WHERE estado = 'abierta'
      ORDER BY id DESC
      LIMIT 1
    `);

    let cajaActual = 0;

    if (cajaResult.rows.length) {
      const cajaId = cajaResult.rows[0].id;
      const inicioCaja = Number(cajaResult.rows[0].inicio_caja);

      const resumenCaja = await pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN tipo='ingreso' AND forma_pago='Efectivo' THEN monto END),0) AS ingresos,
          COALESCE(SUM(CASE WHEN tipo='gasto' THEN monto END),0) AS gastos,
          COALESCE(SUM(CASE WHEN tipo='guardado' THEN monto END),0) AS guardado
        FROM caja_movimientos
        WHERE caja_id = $1
      `, [cajaId]);

      cajaActual =
        inicioCaja +
        Number(resumenCaja.rows[0].ingresos) -
        Number(resumenCaja.rows[0].gastos) -
        Number(resumenCaja.rows[0].guardado);
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