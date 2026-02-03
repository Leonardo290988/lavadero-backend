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
      "SELECT id FROM pagos_mp WHERE payment_id=$1",
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
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`
        }
      }
    );

    const pago = response.data;

    if (pago.status !== "approved") {
      console.log("Pago no aprobado");
      return res.sendStatus(200);
    }

    const tipo = pago.metadata?.tipo;     // retiro | combo
    const retiro_id = pago.metadata?.retiro_id;
    const monto = pago.transaction_details.total_paid_amount;
    const envio_id = pago.metadata?.envio_id;

    console.log("✅ Pago aprobado:", tipo, retiro_id);

    // ===========================
    // HABILITAR RETIRO
    // ===========================
    if (tipo === "retiro" || tipo === "combo") {
      await pool.query(`
        UPDATE retiros
        SET estado='pendiente'
        WHERE id=$1
      `,[retiro_id]);

      console.log("🧺 Retiro habilitado");
    }

    // ===========================
// HABILITAR ENVIO
// ===========================
if (tipo === "combo" && envio_id) {
  await pool.query(`
    UPDATE envios
    SET estado='pendiente'
    WHERE id=$1
  `, [envio_id]);

  console.log("🚚 Envío habilitado");
}

    // ===========================
    // BUSCAR CAJA ABIERTA
    // ===========================
    const cajaRes = await pool.query(`
      SELECT id
      FROM turnos_caja
      WHERE estado='abierta'
      ORDER BY id DESC
      LIMIT 1
    `);

    if (cajaRes.rows.length === 0) {
      console.log("❌ No hay caja abierta");
      return res.sendStatus(200);
    }

    const caja_id = cajaRes.rows[0].id;

    // ===========================
    // REGISTRAR EN CAJA
    // ===========================
    await pool.query(`
      INSERT INTO caja_movimientos
      (caja_id,tipo,descripcion,monto,forma_pago)
      VALUES ($1,'ingreso',$2,$3,'Transferencia/MercadoPago')
    `, [
      caja_id,
      `Pago MercadoPago Retiro`,
      monto
    ]);

    // ===========================
    // GUARDAR PAGO
    // ===========================
    await pool.query(`
      INSERT INTO pagos_mp
      (payment_id,tipo,referencia_id,monto)
      VALUES ($1,$2,$3,$4)
    `, [
      paymentId,
      tipo,
      retiro_id,
      monto
    ]);

    console.log("✅ Pago procesado completo");

    res.sendStatus(200);

  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(500);
  }
};

module.exports = { webhookMercadoPago };