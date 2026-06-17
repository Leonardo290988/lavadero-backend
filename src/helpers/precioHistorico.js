// ════════════════════════════════════════════════════════════════
//  PRECIO HISTÓRICO DE SERVICIOS
// ════════════════════════════════════════════════════════════════
// Resuelve cuál era el precio de un servicio en una fecha dada,
// usando la tabla historial_precios (precio_anterior / precio_nuevo / fecha).
//
// Lógica:
//   1) El precio_nuevo del cambio más reciente cuya fecha sea <= a la
//      fecha de ingreso de la orden  → precio vigente en ese momento.
//   2) Si la orden es anterior a TODOS los cambios registrados →
//      precio_anterior del cambio más viejo (lo que valía antes de cambiar).
//   3) Si el servicio nunca tuvo cambios → precio actual de servicios.
//
// Nota TZ: historial_precios.fecha es TIMESTAMP (sin zona) y se guarda en
// UTC (Railway corre en UTC). Lo tratamos con AT TIME ZONE 'UTC' para
// compararlo correctamente contra fecha_ingreso (timestamptz) y no arrastrar
// el offset de 3 horas de Argentina.
// ════════════════════════════════════════════════════════════════

const pool = require('../db');

/**
 * Devuelve el precio de un servicio vigente a una fecha de referencia.
 * @param {number} servicioId
 * @param {string|Date|null} fechaRef - fecha_ingreso de la orden
 * @returns {Promise<number|null>}
 */
async function obtenerPrecioEnFecha(servicioId, fechaRef) {
  // Sin fecha de referencia: usamos el precio actual del servicio.
  if (!fechaRef) {
    const actual = await pool.query(
      'SELECT precio FROM servicios WHERE id = $1',
      [servicioId]
    );
    return actual.rows.length ? Number(actual.rows[0].precio) : null;
  }

  const { rows } = await pool.query(
    `
    SELECT COALESCE(
      (SELECT precio_nuevo
         FROM historial_precios
        WHERE servicio_id = $1
          AND (fecha AT TIME ZONE 'UTC') <= $2
        ORDER BY fecha DESC
        LIMIT 1),
      (SELECT precio_anterior
         FROM historial_precios
        WHERE servicio_id = $1
        ORDER BY fecha ASC
        LIMIT 1),
      (SELECT precio FROM servicios WHERE id = $1)
    ) AS precio
    `,
    [servicioId, fechaRef]
  );

  const precio = rows[0]?.precio;
  return precio == null ? null : Number(precio);
}

module.exports = { obtenerPrecioEnFecha };
