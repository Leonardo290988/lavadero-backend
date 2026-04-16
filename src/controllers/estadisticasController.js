const pool = require("../db");

// ======================================
// SERVICIOS MÁS VENDIDOS
// ======================================
const getServiciosMasVendidos = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT 
        s.nombre,
        SUM(os.cantidad) AS cantidad_total,
        SUM(os.cantidad * os.precio_unitario) AS monto_total,
        COUNT(DISTINCT os.orden_id) AS en_ordenes
      FROM orden_servicios os
      JOIN servicios s ON s.id = os.servicio_id
      JOIN ordenes o ON o.id = os.orden_id
      WHERE o.estado IN ('lista', 'retirada', 'entregada')
      GROUP BY s.nombre
      ORDER BY cantidad_total DESC
    `);
    res.json(r.rows);
  } catch (error) {
    console.error("ERROR getServiciosMasVendidos:", error);
    res.status(500).json({ error: "Error" });
  }
};

// ======================================
// DÍAS MÁS MOVIDOS
// ======================================
const getDiasMasMovidos = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT 
        TO_CHAR(fecha_ingreso AT TIME ZONE 'America/Argentina/Buenos_Aires', 'Day') AS dia_nombre,
        EXTRACT(DOW FROM fecha_ingreso AT TIME ZONE 'America/Argentina/Buenos_Aires') AS dia_num,
        COUNT(*) AS total_ordenes,
        ROUND(AVG(total)::numeric, 0) AS ticket_promedio
      FROM ordenes
      WHERE estado IN ('lista', 'retirada', 'entregada')
        AND fecha_ingreso IS NOT NULL
      GROUP BY dia_nombre, dia_num
      ORDER BY dia_num
    `);
    res.json(r.rows);
  } catch (error) {
    console.error("ERROR getDiasMasMovidos:", error);
    res.status(500).json({ error: "Error" });
  }
};

// ======================================
// TICKET PROMEDIO POR MES
// ======================================
const getTicketPromedio = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', fecha_ingreso), 'MM/YYYY') AS mes,
        DATE_TRUNC('month', fecha_ingreso) AS mes_orden,
        COUNT(*) AS total_ordenes,
        ROUND(AVG(total)::numeric, 0) AS ticket_promedio,
        SUM(total) AS total_facturado
      FROM ordenes
      WHERE estado IN ('lista', 'retirada', 'entregada')
        AND total > 0
        AND fecha_ingreso >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', fecha_ingreso)
      ORDER BY mes_orden ASC
    `);
    res.json(r.rows);
  } catch (error) {
    console.error("ERROR getTicketPromedio:", error);
    res.status(500).json({ error: "Error" });
  }
};

// ======================================
// COMPARATIVA SEMANA A SEMANA (últimas 8 semanas)
// ======================================
const getComparativaSemanal = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT 
        DATE_TRUNC('week', fecha_ingreso) AS semana,
        COUNT(*) AS total_ordenes,
        SUM(total) AS total_facturado,
        ROUND(AVG(total)::numeric, 0) AS ticket_promedio
      FROM ordenes
      WHERE estado IN ('lista', 'retirada', 'entregada')
        AND total > 0
        AND fecha_ingreso >= NOW() - INTERVAL '8 weeks'
      GROUP BY DATE_TRUNC('week', fecha_ingreso)
      ORDER BY semana ASC
    `);
    res.json(r.rows);
  } catch (error) {
    console.error("ERROR getComparativaSemanal:", error);
    res.status(500).json({ error: "Error" });
  }
};

// ======================================
// CLIENTES NUEVOS VS RECURRENTES (últimos 6 meses)
// ======================================
const getClientesNuevosVsRecurrentes = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', primera_orden), 'MM/YYYY') AS mes,
        DATE_TRUNC('month', primera_orden) AS mes_orden,
        COUNT(CASE WHEN es_nuevo THEN 1 END) AS clientes_nuevos,
        COUNT(CASE WHEN NOT es_nuevo THEN 1 END) AS clientes_recurrentes
      FROM (
        SELECT 
          o.cliente_id,
          DATE_TRUNC('month', o.fecha_ingreso) AS primera_orden,
          MIN(o.fecha_ingreso) OVER (PARTITION BY o.cliente_id) = o.fecha_ingreso 
            AND DATE_TRUNC('month', o.fecha_ingreso) = DATE_TRUNC('month', MIN(o.fecha_ingreso) OVER (PARTITION BY o.cliente_id))
            AS es_nuevo
        FROM ordenes o
        WHERE o.fecha_ingreso >= NOW() - INTERVAL '6 months'
          AND o.estado IN ('lista', 'retirada', 'entregada')
      ) sub
      GROUP BY DATE_TRUNC('month', primera_orden)
      ORDER BY mes_orden ASC
    `);
    res.json(r.rows);
  } catch (error) {
    console.error("ERROR getClientesNuevosVsRecurrentes:", error);
    res.status(500).json({ error: "Error" });
  }
};

module.exports = {
  getServiciosMasVendidos,
  getDiasMasMovidos,
  getTicketPromedio,
  getComparativaSemanal,
  getClientesNuevosVsRecurrentes
};
