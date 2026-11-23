// ════════════════════════════════════════════════════════════════
//  CRON DE CIERRE AUTOMÁTICO DE CAJA
// ════════════════════════════════════════════════════════════════
// Corre todos los días a las 00:05 (hora Argentina).
//
// Si alguien se olvidó de cerrar la caja, al pasar al nuevo día este
// cron cierra cualquier turno que haya quedado 'abierta' de días
// ANTERIORES (nunca toca una caja abierta hoy), usando exactamente la
// misma lógica que el botón "cerrar caja": genera el resumen del turno
// (y el diario si es turno tarde) y marca el turno como cerrado.
//
// Se cierran en orden (más viejo primero, y 'mañana' antes que 'tarde')
// para que el resumen diario se arme bien.

const cron = require("node-cron");
const pool = require("../db");
const { cerrarCajaCore } = require("../controllers/cajaController");

const CRON_SCHEDULE = "5 0 * * *"; // todos los días a las 00:05 AM

async function cerrarCajasOlvidadas() {
  // Turnos abiertos cuya fecha es anterior a HOY (hora Argentina).
  // Nunca cierra una caja abierta el día en curso.
  const r = await pool.query(`
    SELECT id, turno, TO_CHAR(fecha, 'DD/MM/YYYY') AS fecha
    FROM turnos_caja
    WHERE estado = 'abierta'
      AND fecha < (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
    ORDER BY fecha ASC, turno ASC
  `);

  if (r.rows.length === 0) {
    console.log("✅ CRON CIERRE CAJA: no hay cajas olvidadas para cerrar");
    return 0;
  }

  let cerradas = 0;
  for (const caja of r.rows) {
    try {
      const { efectivoFinal } = await cerrarCajaCore(caja.id);
      cerradas++;
      console.log(
        `🔒 Caja #${caja.id} (turno ${caja.turno} del ${caja.fecha}) ` +
        `cerrada automáticamente → efectivo final $${efectivoFinal}`
      );
    } catch (e) {
      console.error(`❌ Error cerrando automáticamente la caja #${caja.id}:`, e.message);
    }
  }

  console.log(`✅ CRON CIERRE CAJA finalizado: ${cerradas}/${r.rows.length} caja(s) cerrada(s)`);
  return cerradas;
}

function iniciarCronCierreCaja() {
  cron.schedule(CRON_SCHEDULE, cerrarCajasOlvidadas, {
    timezone: "America/Argentina/Buenos_Aires"
  });
  console.log(`📅 CRON CIERRE CAJA registrado (${CRON_SCHEDULE} - hora Argentina)`);
}

module.exports = {
  iniciarCronCierreCaja,
  cerrarCajasOlvidadas, // exportado por si querés dispararlo manual desde un endpoint
};
