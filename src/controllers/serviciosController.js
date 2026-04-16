const pool = require('../db');

// GET /servicios
const getServicios = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM servicios ORDER BY nombre ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('GET SERVICIOS ERROR:', error);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
};

// GET /servicios/publicos
const getServiciosPublicos = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nombre, precio
      FROM servicios
      WHERE activo = true OR activo IS NULL
      ORDER BY nombre ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error obteniendo servicios:", error);
    res.status(500).json({ error: "Error obteniendo servicios" });
  }
};

// POST /servicios
const createServicio = async (req, res) => {
  const { nombre, precio } = req.body;

  if (!nombre || precio == null) {
    return res.status(400).json({ error: 'Nombre y precio son obligatorios' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO servicios (nombre, precio, activo) VALUES ($1, $2, true) RETURNING *`,
      [nombre, precio]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('CREATE SERVICIO ERROR:', error);
    res.status(500).json({ error: 'Error al crear servicio' });
  }
};

// PUT /servicios/:id
const actualizarServicio = async (req, res) => {
  const { id } = req.params;
  const { nombre, precio } = req.body;

  if (!nombre || precio == null) {
    return res.status(400).json({ error: 'Nombre y precio son obligatorios' });
  }

  try {
    const result = await pool.query(
      `UPDATE servicios SET nombre = $1, precio = $2 WHERE id = $3 RETURNING *`,
      [nombre, precio, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('UPDATE SERVICIO ERROR:', error);
    res.status(500).json({ error: 'Error al actualizar servicio' });
  }
};

// PUT /servicios/:id/toggle
const toggleServicio = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE servicios SET activo = NOT COALESCE(activo, true) WHERE id = $1 RETURNING *`,
      [id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('TOGGLE SERVICIO ERROR:', error);
    res.status(500).json({ error: 'Error al cambiar estado del servicio' });
  }
};

module.exports = {
  getServiciosPublicos,
  getServicios,
  createServicio,
  actualizarServicio,
  toggleServicio
};
