const pool = require("../db");
const geocodeDireccion = require("../helpers/geocodeDireccion");
const calcularDistanciaKm = require("../helpers/calcularDistancia");
const calcularZona = require("../helpers/calcularZona");

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
    // 📍 Geocodificar dirección
    const { lat, lng } = await geocodeDireccion(direccion);

    // 🏪 Coordenadas del lavadero (FIJAS)
    const LAVADERO_LAT = -34.653777;
    const LAVADERO_LNG = -58.799750;

    // 📏 Calcular distancia
    const distanciaKm = calcularDistanciaKm(
      LAVADERO_LAT,
      LAVADERO_LNG,
      lat,
      lng
    );

    // 📍 Calcular zona
    const zona = calcularZona(distanciaKm);

    console.log("👤 Cliente:", nombre);
    console.log("📏 Distancia:", distanciaKm.toFixed(2), "km");
    console.log("📍 Zona:", zona);

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

    res.status(201).json({
      ...result.rows[0],
      distancia_km: Number(distanciaKm.toFixed(2)),
      zona
    });

  } catch (error) {
    console.error("CREATE CLIENTE ERROR:", error);
    res.status(500).json({ error: "Error al crear cliente" });
  }
};

module.exports = {
  createCliente
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

module.exports = {
  getClientes,
  buscarClientes,
  createCliente
};