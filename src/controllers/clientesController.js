const pool = require("../db");
const geocodeDireccion = require("../helpers/geocodeDireccion");
const db = require('../db');


// ==========================
// GET CLIENTES
// ==========================
const getClientes = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre, telefono, direccion, lat, lng FROM clientes ORDER BY id ASC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("GET CLIENTES ERROR:", error);
    res.status(500).json({ error: "Error al obtener clientes" });
  }
};

// ==========================
// CREATE CLIENTE
// ==========================

const createCliente = async (req, res) => {
  const { nombre, telefono, direccion } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: "Nombre obligatorio" });
  }

  try {
    // 🔍 Verificar si el teléfono ya está registrado
    if (telefono) {
      const existente = await pool.query(
        "SELECT id FROM clientes WHERE telefono = $1",
        [telefono]
      );
      if (existente.rows.length > 0) {
        return res.status(409).json({
          error: "El número de teléfono ya está registrado. Iniciá sesión con ese número."
        });
      }
    }

    // 📍 Geocodificar dirección
    const { lat, lng } = await geocodeDireccion(direccion);

    // 💾 Guardar cliente
    const result = await pool.query(
      `
      INSERT INTO clientes (nombre, telefono, direccion, lat, lng)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        nombre,
        telefono ?? null,
        direccion ?? null,
        lat,
        lng
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error("CREATE CLIENTE ERROR:", error);
    res.status(500).json({ error: "Error al crear cliente" });
  }
};



// ==========================
// BUSCAR CLIENTES
// ==========================
const buscarClientes = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await pool.query(
      `
      SELECT id, nombre, telefono, direccion, lat, lng
      FROM clientes
      WHERE
        id::text = $1
        OR nombre ILIKE '%' || $1 || '%'
        OR telefono ILIKE '%' || $1 || '%'
      LIMIT 10
      `,
      [q]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("❌ ERROR BUSCAR CLIENTES:", error.message);
    res.status(500).json({ error: "Error al buscar clientes" });
  }
};

// ==========================
// LOGIN CLIENTE (APP)
// ==========================
const loginCliente = async (req, res) => {
  const { telefono } = req.body;

  if (!telefono) {
    return res.status(400).json({ error: "Teléfono requerido" });
  }

  try {
    const result = await pool.query(
      `
      SELECT id, nombre, telefono, direccion, lat, lng
      FROM clientes
      WHERE telefono = $1
      `,
      [telefono]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error("LOGIN CLIENTE ERROR:", error);
    res.status(500).json({ error: "Error login cliente" });
  }
};



const getClienteById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      'SELECT * FROM clientes WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Cliente no encontrado',
      });
    }

    res.json({
      ok: true,
      cliente: result.rows[0],
    });
  } catch (error) {
    console.error('ERROR getClienteById:', error);
    res.status(500).json({
      ok: false,
      message: 'Error del servidor',
    });
  }
};

module.exports = {
  getClientes,
  loginCliente,
  getClienteById,
  buscarClientes,
  createCliente
};
// ======================================
// CLIENTES INACTIVOS (sin órdenes en 45 días)
// ======================================
const getClientesInactivos = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT 
        c.id,
        c.nombre,
        c.telefono,
        MAX(o.fecha_ingreso) AS ultima_orden,
        COUNT(o.id) AS total_ordenes,
        cc.ultimo_contacto
      FROM clientes c
      LEFT JOIN ordenes o ON o.cliente_id = c.id
      LEFT JOIN clientes_contactados cc ON cc.cliente_id = c.id
      WHERE c.telefono IS NOT NULL AND c.telefono != ''
      GROUP BY c.id, c.nombre, c.telefono, cc.ultimo_contacto
      HAVING 
        MAX(o.fecha_ingreso) < NOW() - INTERVAL '45 days'
        OR MAX(o.fecha_ingreso) IS NULL
      ORDER BY ultima_orden ASC NULLS FIRST
    `);
    res.json(r.rows);
  } catch (error) {
    console.error("ERROR getClientesInactivos:", error);
    res.status(500).json({ error: "Error obteniendo clientes inactivos" });
  }
};

// ======================================
// MARCAR CLIENTE COMO CONTACTADO
// ======================================
const marcarContactado = async (req, res) => {
  const { clienteId } = req.params;
  try {
    await pool.query(`
      INSERT INTO clientes_contactados (cliente_id, ultimo_contacto)
      VALUES ($1, NOW())
      ON CONFLICT (cliente_id) DO UPDATE
        SET ultimo_contacto = NOW()
    `, [clienteId]);
    res.json({ ok: true });
  } catch (error) {
    console.error("ERROR marcarContactado:", error);
    res.status(500).json({ error: "Error marcando contacto" });
  }
};

module.exports = {
  ...module.exports,
  getClientesInactivos,
  marcarContactado
};
