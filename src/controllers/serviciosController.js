console.log('🔥🔥🔥 CONTROLLER SERVICIOS CARGADO 🔥🔥🔥');
const pool = require('../db');

// GET /servicios
const getServicios = async (req, res) => {
  console.log('🚀 GET /servicios ENTRO AL CONTROLLER');
  try {
    const result = await pool.query(
      'SELECT * FROM servicios ORDER BY id ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('GET SERVICIOS ERROR:', error);
    res.status(500).json({ error: 'Error al obtener servicios' });
  }
};

// POST /servicios
const createServicio = async (req, res) => {
  const { nombre, precio } = req.body;

  if (!nombre || precio == null) {
    return res.status(400).json({
      error: 'Nombre y precio son obligatorios',
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO servicios (nombre, precio)
       VALUES ($1, $2)
       RETURNING *`,
      [nombre, precio]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('CREATE SERVICIO ERROR:', error);
    res.status(500).json({ error: 'Error al crear servicio' });
  }
};

// GET /servicios/publicos
const getServiciosPublicos = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nombre, precio
      FROM servicios
      ORDER BY nombre ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Error obteniendo servicios:", error);
    res.status(500).json({ error: "Error obteniendo servicios" });
  }
};

module.exports = {
  getServiciosPublicos,
  getServicios,
  createServicio,
};