const { Preference } = require("mercadopago");
const mpClient = require("../config/mercadopago");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");


// =============================
// CREAR PREFERENCIA NORMAL (MP)
// =============================
const crearPreferencia = async (req, res) => {
  try {
    const { titulo, precio, tipo, retiro_id, envio_id } = req.body;

    const preference = new Preference(mpClient);

    const result = await preference.create({
      body: {
        items: [
          {
            title: titulo,
            unit_price: Number(precio),
            quantity: 1
          }
        ],
        metadata: {
          tipo,
          retiro_id: retiro_id || null,
          envio_id: envio_id || null
        },
        back_urls: {
          success: "lavaderosmoreno://pago-exitoso",
          failure: "lavaderosmoreno://pago-fallido",
          pending: "lavaderosmoreno://pago-pendiente"
        },
        auto_return: "approved",
        notification_url:
          "https://lavadero-backend-production-e1eb.up.railway.app/webhook/mercadopago"
      }
    });

    const data = result.body || result;

    res.json({
      id: data.id,
      link: data.init_point
    });

  } catch (error) {
    console.error("Error crearPreferencia:", error);
    res.status(500).json({ error: "Error MercadoPago" });
  }
};



// =======================================
// 🔥 QR INTEROPERABLE REAL T3.0
// =======================================
const generarQR = async (req, res) => {
  try {
    const { titulo, precio } = req.body;

    const idempotencyKey = uuidv4(); // obligatorio

    const response = await axios.post(
      "https://api.mercadopago.com/instore/orders/qr/seller/collectors/" +
        process.env.MP_USER_ID +
        "/pos/102435387/qrs",
      {
        external_reference: uuidv4(),
        title: titulo,
        description: titulo,
        total_amount: Number(precio),
        items: [
          {
            sku_number: "1",
            category: "service",
            title: titulo,
            description: titulo,
            unit_price: Number(precio),
            quantity: 1,
            unit_measure: "unit",
            total_amount: Number(precio)
          }
        ],
        notification_url:
          "https://lavadero-backend-production-e1eb.up.railway.app/webhook/mercadopago"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey
        }
      }
    );

    res.json({
      ok: true,
      qr_data: response.data.qr_data
    });

  } catch (error) {
    console.error(
      "Error generando QR interoperable:",
      error.response?.data || error
    );
    res.status(500).json({ error: "Error generando QR" });
  }
};

module.exports = {
  generarQR,
  crearPreferencia
};