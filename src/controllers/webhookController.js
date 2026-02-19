const axios = require("axios");
const pool = require("../db");

const webhookMercadoPago = async (req, res) => {
  try {

    const paymentId = req.body?.data?.id;
    console.log("🔔 Webhook MP:", paymentId);

    if (!paymentId) return res.sendStatus(200);

    // ===========================
    // EVITAR DUPLICADOS
    // ===========================
    const existe = await pool.query(
      "SELECT id FROM pagos_mp WHERE payment_id = $1",
      [paymentId]
    );

    if (existe.rows.length > 0) {
      console.log("⚠ Pago duplicado ignorado");
      return res.sendStatus(200);
    }

    // ===========================
    // CONSULTAR MP
    // ===========================
    const response = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      }
    );

    const pago = response.data;

    if (pago.status !== "approved") {
      console.log("⏳ Pago no aprobado");
      return res.sendStatus(200);
    }

    const { tipo, retiro_id, envio_id } = pago.metadata || {};
    const monto = pago.transaction_details?.total_paid_amount || 0;

    console.log("✅ Pago aprobado:", tipo, retiro_id, envio_id);

    // ===========================
    // PROCESAR RETIRO
    // ===========================
    if (tipo === "retiro" && retiro_id) {

      await pool.query(`
        UPDATE retiros
        SET estado = 'pendiente'
        WHERE id = $1
      `, [retiro_id]);

      console.log("🧺 Retiro habilitado:", retiro_id);
    }

    // ===========================
    // PROCESAR ENVÍO
    // ===========================
    if (tipo === "envio" && envio_id) {

      // 1️⃣ Pasar envío a pendiente
      await pool.query(`
        UPDATE envios
        SET estado = 'pendiente'
        WHERE id = $1
      `, [envio_id]);

      console.log("🚚 Envío habilitado:", envio_id);

      // 2️⃣ Marcar orden como tiene_envio = true
      await pool.query(`
        UPDATE ordenes
        SET tiene_envio = true
        WHERE id = (
          SELECT orden_id FROM envios WHERE id = $1
        )
      `, [envio_id]);

      console.log("📦 Orden actualizada con envío");
    }

    // ===========================
    // IMPACTAR EN CAJA
    // ===========================
    const cajaRes = await pool.query(`
      SELECT id
      FROM turnos_caja
      WHERE estado = 'abierta'
      ORDER BY id DESC
      LIMIT 1
    `);

    if (cajaRes.rows.length > 0) {

      const caja_id = cajaRes.rows[0].id;

      let descripcion = "Pago MercadoPago";

      if (tipo === "retiro") {
        descripcion = `Pago retiro #${retiro_id}`;
      }

      if (tipo === "envio") {
        descripcion = `Pago envío #${envio_id}`;
      }

      await pool.query(
        `
        INSERT INTO caja_movimientos
        (caja_id, tipo, descripcion, monto, forma_pago)
        VALUES ($1,'ingreso',$2,$3,'Transferencia/MercadoPago')
        `,
        [caja_id, descripcion, monto]
      );

      console.log("💰 Impactado en caja");
    }

    // ===========================
    // REGISTRAR PAGO
    // ===========================
    await pool.query(
      `
      INSERT INTO pagos_mp
      (payment_id, tipo, referencia_id, monto, estado)
      VALUES ($1,$2,$3,$4,$5)
      `,
      [
        paymentId,
        tipo,
        retiro_id || envio_id,
        monto,
        pago.status
      ]
    );

    console.log("✅ Webhook procesado completo");
    res.sendStatus(200);

  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.sendStatus(500);
  }
};

module.exports = { webhookMercadoPago };