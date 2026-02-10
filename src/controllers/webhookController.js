const axios = require("axios");
const pool = require("../db");
const obtenerZonaCliente = require("../helpers/zonaCliente");

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

    const { tipo, cliente_id, direccion } = pago.metadata;
    const monto = pago.transaction_details.total_paid_amount;

    console.log("✅ Pago aprobado:", tipo, cliente_id);

    // ===========================
    // BUSCAR CLIENTE (lat/lng)
    // ===========================
    const clienteRes = await pool.query(
      "SELECT lat, lng FROM clientes WHERE id = $1",
      [cliente_id]
    );

    if (clienteRes.rows.length === 0) {
      console.log("❌ Cliente no encontrado");
      return res.sendStatus(200);
    }

    const { lat, lng } = clienteRes.rows[0];
    const zonaInfo = obtenerZonaCliente(lat, lng);

    // ===========================
    // CREAR RETIRO (AHORA SÍ)
    // ===========================
    const retiroRes = await pool.query(
      `
      INSERT INTO retiros
      (cliente_id, zona, direccion, precio, estado, tipo)
      VALUES ($1,$2,$3,$4,'pendiente',$5)
      RETURNING id
      `,
      [
        cliente_id,
        zonaInfo.zona,
        direccion,
        zonaInfo.precio,
        tipo,
      ]
    );

    const retiro_id = retiroRes.rows[0].id;
    console.log("🧺 Retiro creado:", retiro_id);

    // ===========================
    // BUSCAR CAJA ABIERTA
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

      await pool.query(
        `
        INSERT INTO caja_movimientos
        (caja_id, tipo, descripcion, monto, forma_pago)
        VALUES ($1,'ingreso','Pago MercadoPago Retiro',$2,'MercadoPago')
        `,
        [caja_id, monto]
      );
    }

    // ===========================
    // REGISTRAR PAGO
    // ===========================
    await pool.query(
      `
      INSERT INTO pagos_mp
      (payment_id, tipo, referencia_id, monto)
      VALUES ($1,$2,$3,$4)
      `,
      [paymentId, tipo, retiro_id, monto]
    );

    console.log("✅ Webhook procesado completo");
    res.sendStatus(200);

  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.sendStatus(500);
  }
};

module.exports = { webhookMercadoPago };