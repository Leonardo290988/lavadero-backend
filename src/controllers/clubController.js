const pool = require("../db");

// GET todos los valets (con filtro opcional)
const getValets = async (req, res) => {
  const { facturado } = req.query;
  try {
    let query = `SELECT * FROM club_valets WHERE 1=1`;
    const params = [];

    if (facturado !== undefined) {
      params.push(facturado === "true");
      query += ` AND facturado = $${params.length}`;
    }

    query += ` ORDER BY fecha DESC`;
    const r = await pool.query(query, params);
    res.json(r.rows);
  } catch (error) {
    console.error("ERROR getValets:", error);
    res.status(500).json({ error: "Error obteniendo valets" });
  }
};

// POST crear valet
const crearValet = async (req, res) => {
  const { fecha, cantidad, precio_unitario = 8000, observacion } = req.body;

  if (!fecha || !cantidad) {
    return res.status(400).json({ error: "Fecha y cantidad son obligatorios" });
  }

  try {
    const r = await pool.query(`
      INSERT INTO club_valets (fecha, cantidad, precio_unitario, observacion)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [fecha, cantidad, precio_unitario, observacion || ""]);

    res.status(201).json(r.rows[0]);
  } catch (error) {
    console.error("ERROR crearValet:", error);
    res.status(500).json({ error: "Error creando valet" });
  }
};

// PUT actualizar valet
const actualizarValet = async (req, res) => {
  const { id } = req.params;
  const { cantidad, precio_unitario, observacion } = req.body;

  try {
    const r = await pool.query(`
      UPDATE club_valets
      SET cantidad = $1, precio_unitario = $2, observacion = $3
      WHERE id = $4
      RETURNING *
    `, [cantidad, precio_unitario, observacion, id]);
    res.json(r.rows[0]);
  } catch (error) {
    console.error("ERROR actualizarValet:", error);
    res.status(500).json({ error: "Error actualizando valet" });
  }
};

// DELETE eliminar valet
const eliminarValet = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM club_valets WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (error) {
    console.error("ERROR eliminarValet:", error);
    res.status(500).json({ error: "Error eliminando valet" });
  }
};

// PUT marcar como facturado
const marcarFacturado = async (req, res) => {
  const { ids, numero_factura, fecha_factura } = req.body;

  if (!ids || ids.length === 0) {
    return res.status(400).json({ error: "Seleccioná al menos un día" });
  }

  try {
    await pool.query(`
      UPDATE club_valets
      SET facturado = true,
          numero_factura = $1,
          fecha_factura = $2
      WHERE id = ANY($3)
    `, [numero_factura || null, fecha_factura || null, ids]);

    res.json({ ok: true });
  } catch (error) {
    console.error("ERROR marcarFacturado:", error);
    res.status(500).json({ error: "Error marcando como facturado" });
  }
};

// GET resumen para factura
const getResumenFactura = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        COUNT(*) AS dias,
        SUM(cantidad) AS total_valets,
        SUM(cantidad * precio_unitario) AS total_pesos,
        MIN(fecha) AS fecha_desde,
        MAX(fecha) AS fecha_hasta
      FROM club_valets
      WHERE facturado = false
    `);
    res.json(r.rows[0]);
  } catch (error) {
    console.error("ERROR getResumenFactura:", error);
    res.status(500).json({ error: "Error obteniendo resumen" });
  }
};

module.exports = { getValets, crearValet, actualizarValet, eliminarValet, marcarFacturado, getResumenFactura };
