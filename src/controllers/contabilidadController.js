const pool = require("../db");

// ======================================
// OBTENER TODOS LOS MOVIMIENTOS
// ======================================
const getMovimientos = async (req, res) => {
  const { mes, anio } = req.query;
  try {
    let query = `
      SELECT * FROM contabilidad
      WHERE 1=1
    `;
    const params = [];

    if (mes && anio) {
      params.push(anio, mes);
      query += ` AND EXTRACT(YEAR FROM fecha) = $1 AND EXTRACT(MONTH FROM fecha) = $2`;
    }

    query += ` ORDER BY fecha DESC, id DESC`;

    const r = await pool.query(query, params);
    res.json(r.rows);
  } catch (error) {
    console.error("ERROR getMovimientos:", error);
    res.status(500).json({ error: "Error obteniendo movimientos" });
  }
};

// ======================================
// CREAR MOVIMIENTO
// ======================================
const crearMovimiento = async (req, res) => {
  const { tipo, categoria, descripcion, monto, fecha } = req.body;

  if (!tipo || !categoria || !monto || !fecha) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  try {
    const r = await pool.query(`
      INSERT INTO contabilidad (tipo, categoria, descripcion, monto, fecha)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [tipo, categoria, descripcion || "", monto, fecha]);

    res.status(201).json(r.rows[0]);
  } catch (error) {
    console.error("ERROR crearMovimiento:", error);
    res.status(500).json({ error: "Error creando movimiento" });
  }
};

// ======================================
// ELIMINAR MOVIMIENTO
// ======================================
const eliminarMovimiento = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM contabilidad WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (error) {
    console.error("ERROR eliminarMovimiento:", error);
    res.status(500).json({ error: "Error eliminando movimiento" });
  }
};

// ======================================
// BALANCE MENSUAL
// ======================================
const getBalanceMensual = async (req, res) => {
  const { mes, anio } = req.query;

  if (!mes || !anio) {
    return res.status(400).json({ error: "Mes y año son requeridos" });
  }

  try {
    // Ingresos del sistema de caja (órdenes retiradas ese mes)
    const cajaMes = await pool.query(`
      SELECT
        COALESCE(SUM(ingresos_efectivo), 0) AS efectivo,
        COALESCE(SUM(ingresos_digital), 0) AS digital,
        COALESCE(SUM(gastos), 0) AS gastos,
        COALESCE(SUM(total_ventas), 0) AS total
      FROM resumenes
      WHERE tipo = 'diario'
        AND EXTRACT(MONTH FROM fecha_desde) = $1
        AND EXTRACT(YEAR FROM fecha_desde) = $2
    `, [mes, anio]);

    // Ingresos externos (contabilidad)
    const ingresosExternos = await pool.query(`
      SELECT
        categoria,
        COALESCE(SUM(monto), 0) AS total
      FROM contabilidad
      WHERE tipo = 'ingreso'
        AND EXTRACT(MONTH FROM fecha) = $1
        AND EXTRACT(YEAR FROM fecha) = $2
      GROUP BY categoria
    `, [mes, anio]);

    // Egresos externos (contabilidad)
    const egresos = await pool.query(`
      SELECT
        categoria,
        descripcion,
        COALESCE(SUM(monto), 0) AS total
      FROM contabilidad
      WHERE tipo = 'egreso'
        AND EXTRACT(MONTH FROM fecha) = $1
        AND EXTRACT(YEAR FROM fecha) = $2
      GROUP BY categoria, descripcion
      ORDER BY categoria
    `, [mes, anio]);

    const totalCaja = Number(cajaMes.rows[0]?.total || 0) - Number(cajaMes.rows[0]?.gastos || 0);
    const totalIngresosExternos = ingresosExternos.rows.reduce((acc, r) => acc + Number(r.total), 0);
    const totalEgresos = egresos.rows.reduce((acc, r) => acc + Number(r.total), 0);
    const totalIngresos = totalCaja + totalIngresosExternos;
    const balance = totalIngresos - totalEgresos;

    res.json({
      caja: cajaMes.rows[0],
      ingresos_externos: ingresosExternos.rows,
      egresos: egresos.rows,
      resumen: {
        total_caja: totalCaja,
        total_ingresos_externos: totalIngresosExternos,
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        balance
      }
    });

  } catch (error) {
    console.error("ERROR getBalanceMensual:", error);
    res.status(500).json({ error: "Error calculando balance" });
  }
};

module.exports = { getMovimientos, crearMovimiento, eliminarMovimiento, getBalanceMensual };
