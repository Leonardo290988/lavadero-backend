const { Preference } = require("mercadopago");
const mpClient = require("../config/mercadopago");
const QRCode = require("qrcode");
const axios = require("axios");


// =============================
// CREAR PREFERENCIA NORMAL (MP)
// =============================
const crearPreferencia = async (req, res) => {
  try {

    const {
      titulo,
      precio,
      tipo,
      retiro_id,
      envio_id
    } = req.body;

    console.log("🧾 CREAR PREFERENCIA:", {
      titulo,
      precio,
      tipo,
      retiro_id,
      envio_id
    });

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
// 🔥 CREAR QR INTEROPERABLE REAL (T3.0)
// =======================================
const generarQR = async (req, res) => {
  try {
    const { titulo, precio, tipo, retiro_id, envio_id } = req.body;

    const external_reference = `${tipo}_${retiro_id || envio_id}`;
    const idempotencyKey = `${external_reference}_${Date.now()}`;

    const response = await axios.post(
      "https://api.mercadopago.com/v1/orders",
      {
        type: "qr",
        external_reference,
        items: [
          {
            title: titulo,
            unit_price: Number(precio),
            quantity: 1
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
    console.error("Error generando QR interoperable:", error.response?.data || error);
    res.status(500).json({ error: "Error generando QR" });
  }
};
module.exports = {
  generarQR,
  crearPreferencia

}