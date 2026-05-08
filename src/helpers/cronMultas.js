// ════════════════════════════════════════════════════════════════
//  CRON DE MULTAS Y DESCARTE DE ÓRDENES NO RETIRADAS
// ════════════════════════════════════════════════════════════════
// Corre todos los días a las 09:00 hs (Argentina).
//
// Lógica:
//   - 30 días sin retirar → aplicar multa 10% + WhatsApp
//   - 45 días sin retirar → subir multa a 20% + WhatsApp
//   - 60 días sin retirar → WhatsApp última advertencia
//   - 90 días sin retirar → mover a ordenes_descartadas + WhatsApp final

const cron = require("node-cron");
const pool = require("../db");
const enviarWhatsApp = require("./enviarWhatsApp");

const CRON_SCHEDULE = "0 9 * * *"; // todos los días a las 9:00 AM

// ========================================
// HELPERS
// ========================================

async function notificarPorWhatsApp(telefono, mensaje) {
  if (!telefono) return;
  try {
    await enviarWhatsApp({ telefono, mensaje });
  } catch (e) {
    console.error("❌ Error enviando WhatsApp en cron de multas:", e.message);
  }
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString("es-AR");
}

// ========================================
// 1️⃣ MULTA 10% (30 días)
// ========================================
async function aplicarMulta10() {
  const r = await pool.query(`
    SELECT
      o.id, o.cliente_id, o.total, o.senia,
      c.nombre, c.telefono,
      EXTRACT(DAY FROM NOW() - o.fecha_lista)::INT AS dias
    FROM ordenes o
    JOIN clientes c ON c.id = o.cliente_id
    WHERE o.estado = 'lista'
      AND o.fecha_lista IS NOT NULL
      AND o.fecha_lista <= NOW() - INTERVAL '30 days'
      AND o.fecha_lista > NOW() - INTERVAL '45 days'
      AND o.multa_porcentaje < 10
  `);

  for (const orden of r.rows) {
    await pool.query(`
      UPDATE ordenes
      SET multa_porcentaje = 10,
          multa_aplicada_en = NOW()
      WHERE id = $1
    `, [orden.id]);

    const total = Number(orden.total) || 0;
    const senia = Number(orden.senia) || 0;
    const multa = Math.floor(total * 0.10);
    const saldoConMulta = total + multa - senia;

    console.log(`💰 Multa 10% aplicada a orden #${orden.id} (${orden.dias} días) → +$${multa}`);

    const mensaje = `🧺 *Lavaderos Moreno*

Hola ${orden.nombre} 👋

Te recordamos que tu *orden #${orden.id}* lleva *${orden.dias} días lista* sin retirar.

Por motivos de almacenamiento, a partir de hoy se aplicó una *multa del 10%* sobre el total:
• Total original: $${fmtMoney(total)}
• Multa (10%): +$${fmtMoney(multa)}
• Saldo a abonar: *$${fmtMoney(saldoConMulta)}*

⚠️ A los *45 días* la multa subirá al *20%*.
⚠️ A los *90 días* perderás el derecho a reclamar la orden.

Te esperamos para que pases a retirarla 😊
📍 Hipólito Yrigoyen 1471, Moreno
🕒 Lunes a Sábados de 9 a 18hs`.trim();

    await notificarPorWhatsApp(orden.telefono, mensaje);
  }

  return r.rows.length;
}

// ========================================
// 2️⃣ MULTA 20% (45 días)
// ========================================
async function aplicarMulta20() {
  const r = await pool.query(`
    SELECT
      o.id, o.cliente_id, o.total, o.senia,
      c.nombre, c.telefono,
      EXTRACT(DAY FROM NOW() - o.fecha_lista)::INT AS dias
    FROM ordenes o
    JOIN clientes c ON c.id = o.cliente_id
    WHERE o.estado = 'lista'
      AND o.fecha_lista IS NOT NULL
      AND o.fecha_lista <= NOW() - INTERVAL '45 days'
      AND o.fecha_lista > NOW() - INTERVAL '60 days'
      AND o.multa_porcentaje < 20
  `);

  for (const orden of r.rows) {
    await pool.query(`
      UPDATE ordenes
      SET multa_porcentaje = 20,
          multa_aplicada_en = NOW()
      WHERE id = $1
    `, [orden.id]);

    const total = Number(orden.total) || 0;
    const senia = Number(orden.senia) || 0;
    const multa = Math.floor(total * 0.20);
    const saldoConMulta = total + multa - senia;

    console.log(`💰 Multa 20% aplicada a orden #${orden.id} (${orden.dias} días) → +$${multa}`);

    const mensaje = `🧺 *Lavaderos Moreno*

Hola ${orden.nombre} 👋

Tu *orden #${orden.id}* lleva *${orden.dias} días lista* sin retirar.

La multa por almacenamiento subió al *20%*:
• Total original: $${fmtMoney(total)}
• Multa (20%): +$${fmtMoney(multa)}
• Saldo a abonar: *$${fmtMoney(saldoConMulta)}*

⚠️ *IMPORTANTE:* a los *90 días* perderás el derecho a reclamar la orden.

Por favor, pasá a retirarla cuanto antes 🙏
📍 Hipólito Yrigoyen 1471, Moreno
🕒 Lunes a Sábados de 9 a 18hs`.trim();

    await notificarPorWhatsApp(orden.telefono, mensaje);
  }

  return r.rows.length;
}

// ========================================
// 3️⃣ ÚLTIMO AVISO (60 días)
// ========================================
async function avisar60Dias() {
  const r = await pool.query(`
    SELECT
      o.id, o.cliente_id, o.total, o.senia,
      c.nombre, c.telefono,
      EXTRACT(DAY FROM NOW() - o.fecha_lista)::INT AS dias
    FROM ordenes o
    JOIN clientes c ON c.id = o.cliente_id
    WHERE o.estado = 'lista'
      AND o.fecha_lista IS NOT NULL
      AND o.fecha_lista <= NOW() - INTERVAL '60 days'
      AND o.fecha_lista > NOW() - INTERVAL '90 days'
      AND o.aviso_60_dias_enviado = false
  `);

  for (const orden of r.rows) {
    await pool.query(`
      UPDATE ordenes
      SET aviso_60_dias_enviado = true
      WHERE id = $1
    `, [orden.id]);

    const total = Number(orden.total) || 0;
    const senia = Number(orden.senia) || 0;
    const multa = Math.floor(total * 0.20);
    const saldoConMulta = total + multa - senia;

    console.log(`📢 Último aviso 60 días — orden #${orden.id} (${orden.dias} días)`);

    const mensaje = `🧺 *Lavaderos Moreno*

Hola ${orden.nombre} ⚠️

*ÚLTIMO AVISO IMPORTANTE*

Tu *orden #${orden.id}* lleva *${orden.dias} días lista* sin retirar.

🚨 *A los 90 días la orden será descartada y ya NO podrás reclamarla.*

Saldo actual a abonar (con multa del 20%): *$${fmtMoney(saldoConMulta)}*

Te quedan *${90 - orden.dias} días* para retirarla. Después de ese plazo perderás la ropa y el dinero abonado.

Por favor, pasá a retirar tu pedido lo antes posible 🙏
📍 Hipólito Yrigoyen 1471, Moreno
🕒 Lunes a Sábados de 9 a 18hs`.trim();

    await notificarPorWhatsApp(orden.telefono, mensaje);
  }

  return r.rows.length;
}

// ========================================
// 4️⃣ DESCARTAR (90 días)
// ========================================
async function descartarOrdenes() {
  const r = await pool.query(`
    SELECT
      o.id, o.cliente_id, o.total, o.senia, o.tiene_envio, o.notas,
      o.fecha_ingreso, o.fecha_lista,
      c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
      EXTRACT(DAY FROM NOW() - o.fecha_lista)::INT AS dias
    FROM ordenes o
    JOIN clientes c ON c.id = o.cliente_id
    WHERE o.estado = 'lista'
      AND o.fecha_lista IS NOT NULL
      AND o.fecha_lista <= NOW() - INTERVAL '90 days'
  `);

  for (const orden of r.rows) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Traer servicios de la orden para snapshot
      const serviciosRes = await client.query(`
        SELECT s.nombre, os.cantidad, os.precio
        FROM ordenes_servicios os
        LEFT JOIN servicios s ON s.id = os.servicio_id
        WHERE os.orden_id = $1
      `, [orden.id]);

      // Insertar en tabla de descartadas (auditoría)
      await client.query(`
        INSERT INTO ordenes_descartadas
        (orden_id_original, cliente_id, cliente_nombre, cliente_telefono,
         fecha_ingreso, fecha_lista, total, senia, tiene_envio, notas,
         servicios_json, motivo)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [
        orden.id,
        orden.cliente_id,
        orden.cliente_nombre,
        orden.cliente_telefono,
        orden.fecha_ingreso,
        orden.fecha_lista,
        orden.total,
        orden.senia,
        orden.tiene_envio,
        orden.notas,
        JSON.stringify(serviciosRes.rows),
        `No retirada en ${orden.dias} días`
      ]);

      // Marcar como descartada en lugar de DELETE para no romper FKs
      // (caja_movimientos, retiros, envios pueden referenciarla)
      await client.query(`
        UPDATE ordenes
        SET estado = 'descartada'
        WHERE id = $1
      `, [orden.id]);

      await client.query("COMMIT");

      console.log(`🗑️ Orden #${orden.id} descartada (${orden.dias} días sin retirar)`);

      const mensaje = `🧺 *Lavaderos Moreno*

Hola ${orden.cliente_nombre}

Lamentamos informarte que tu *orden #${orden.id}* fue *descartada* del local por no haber sido retirada en los *${orden.dias} días* desde que estuvo lista.

Conforme te avisamos previamente, *ya no es posible reclamar esta orden ni el dinero abonado*.

Si querés volver a contar con nuestros servicios, estamos a tu disposición.

Saludos,
Lavaderos Moreno`.trim();

      await notificarPorWhatsApp(orden.cliente_telefono, mensaje);

    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`❌ Error descartando orden #${orden.id}:`, error.message);
    } finally {
      client.release();
    }
  }

  return r.rows.length;
}

// ========================================
// EJECUTOR PRINCIPAL
// ========================================
async function ejecutarRevisionMultas() {
  console.log("⏰ CRON MULTAS: iniciando revisión de órdenes no retiradas");
  try {
    const m10 = await aplicarMulta10();
    const m20 = await aplicarMulta20();
    const a60 = await avisar60Dias();
    const desc = await descartarOrdenes();

    console.log(`✅ CRON MULTAS finalizado:`);
    console.log(`   • Multa 10% aplicada: ${m10} orden(es)`);
    console.log(`   • Multa 20% aplicada: ${m20} orden(es)`);
    console.log(`   • Último aviso (60 días): ${a60} orden(es)`);
    console.log(`   • Órdenes descartadas: ${desc} orden(es)`);
  } catch (error) {
    console.error("❌ Error general en CRON MULTAS:", error);
  }
}

// ========================================
// REGISTRAR CRON
// ========================================
function iniciarCronMultas() {
  cron.schedule(CRON_SCHEDULE, ejecutarRevisionMultas, {
    timezone: "America/Argentina/Buenos_Aires"
  });
  console.log(`📅 CRON MULTAS registrado (${CRON_SCHEDULE} - hora Argentina)`);
}

module.exports = {
  iniciarCronMultas,
  ejecutarRevisionMultas, // exportado por si querés disparar manual desde un endpoint
};
