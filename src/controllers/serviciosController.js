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
    // Obtener precio anterior
    const anterior = await pool.query(`SELECT precio FROM servicios WHERE id = $1`, [id]);
    const precioAnterior = anterior.rows[0]?.precio;

    const result = await pool.query(
      `UPDATE servicios SET nombre = $1, precio = $2 WHERE id = $3 RETURNING *`,
      [nombre, precio, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }

    // Guardar historial si el precio cambió
    if (precioAnterior && Number(precioAnterior) !== Number(precio)) {
      await pool.query(`
        INSERT INTO historial_precios (servicio_id, precio_anterior, precio_nuevo)
        VALUES ($1, $2, $3)
      `, [id, precioAnterior, precio]);
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

// GET /servicios/historial-precios
const getHistorialPrecios = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT h.id, s.nombre, h.precio_anterior, h.precio_nuevo,
             ROUND(((h.precio_nuevo - h.precio_anterior) / h.precio_anterior * 100)::numeric, 1) AS porcentaje,
             h.fecha
      FROM historial_precios h
      JOIN servicios s ON s.id = h.servicio_id
      ORDER BY h.fecha DESC
      LIMIT 50
    `);
    res.json(r.rows);
  } catch (error) {
    console.error('ERROR historial precios:', error);
    res.status(500).json({ error: 'Error obteniendo historial' });
  }
};

// GET /servicios/analisis-precios
const getAnalisisPrecios = async (req, res) => {
  try {
    const hoy = new Date();
    const mes = hoy.getMonth() + 1;
    const anio = hoy.getFullYear();

    const gastos = await pool.query(`
      SELECT categoria, COALESCE(SUM(monto), 0) AS total
      FROM contabilidad
      WHERE tipo = 'egreso'
        AND EXTRACT(MONTH FROM fecha) = $1
        AND EXTRACT(YEAR FROM fecha) = $2
      GROUP BY categoria
    `, [mes, anio]);

    const ingresos = await pool.query(`
      SELECT COALESCE(SUM(total_ventas), 0) AS total,
             COALESCE(SUM(gastos), 0) AS gastos_caja
      FROM resumenes
      WHERE tipo = 'diario'
        AND EXTRACT(MONTH FROM fecha_desde) = $1
        AND EXTRACT(YEAR FROM fecha_desde) = $2
    `, [mes, anio]);

    const ultimoAumento = await pool.query(`
      SELECT MAX(fecha) AS fecha FROM historial_precios
    `);

    const totalGastosExt = gastos.rows.reduce((acc, g) => acc + Number(g.total), 0);
    const totalIngresos = Number(ingresos.rows[0]?.total || 0);
    const gastosCaja = Number(ingresos.rows[0]?.gastos_caja || 0);
    const totalGastos = totalGastosExt + gastosCaja;
    const margen = totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos * 100) : 0;

    const diasDesdeAumento = ultimoAumento.rows[0]?.fecha
      ? Math.floor((new Date() - new Date(ultimoAumento.rows[0].fecha)) / (1000 * 60 * 60 * 24))
      : 999;

    let sugerencia = null;
    if (margen < 20) {
      sugerencia = { porcentaje: 20, motivo: `El margen del mes es ${margen.toFixed(1)}%, por debajo del mínimo recomendado del 20%.` };
    } else if (margen < 30) {
      sugerencia = { porcentaje: 15, motivo: `El margen del mes es ${margen.toFixed(1)}%, se recomienda un ajuste preventivo.` };
    } else if (diasDesdeAumento > 60) {
      sugerencia = { porcentaje: 10, motivo: `Pasaron ${diasDesdeAumento} días desde el último aumento de precios.` };
    }

    res.json({
      mes, anio,
      total_ingresos: totalIngresos,
      total_gastos: totalGastos,
      gastos_detalle: gastos.rows,
      margen: Number(margen.toFixed(1)),
      dias_desde_aumento: diasDesdeAumento,
      sugerencia
    });
  } catch (error) {
    console.error('ERROR analisis precios:', error);
    res.status(500).json({ error: 'Error en análisis' });
  }
};

module.exports = {
  getServiciosPublicos,
  getServicios,
  createServicio,
  actualizarServicio,
  toggleServicio,
  getHistorialPrecios,
  getAnalisisPrecios
};
};

