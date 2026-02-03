const pool = require('../db');

const getClientes = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nombre, telefono, direccion FROM clientes ORDER BY id ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('GET CLIENTES ERROR:', error);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
};

const createCliente = async (req, res) => {
  const { nombre, telefono, direccion } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'Nombre obligatorio' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO clientes (nombre, telefono, direccion)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [nombre, telefono ?? null, direccion ?? null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('CREATE CLIENTE ERROR:', error);
    res.status(500).json({ error: 'Error al crear cliente' });
  }
};




// GET /clientes/search?q=1
const buscarClientes = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await pool.query(`
      SELECT id, nombre, telefono, direccion
      FROM clientes
      WHERE
        id::text = $1
        OR nombre ILIKE '%' || $1 || '%'
        OR telefono ILIKE '%' || $1 || '%'
      LIMIT 10
    `, [q]);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ ERROR BUSCAR CLIENTES:', error.message);
    res.status(500).json({ error: 'Error al buscar clientes' });
  }
};



module.exports = { getClientes,buscarClientes, createCliente };