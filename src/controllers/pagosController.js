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

    const {
      titulo,
      precio,
      tipo,
      retiro_id,
      envio_id
    } = req.body;

    console.log("🧾 CREAR QR INTEROPERABLE:", {
      titulo,
      precio
    });

    // 👉 Crear orden QR real en Mercado Pago
    const response = await axios.post(
      "https://api.mercadopago.com/v1/orders",
      {
        type: "qr",
        external_reference: `${tipo}_${retiro_id || envio_id}`,
        total_amount: Number(precio),
        description: titulo,
        notification_url:
          "https://lavadero-backend-production-e1eb.up.railway.app/webhook/mercadopago"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    const qrData = response.data.qr_data;

    if (!qrData) {
      console.log("❌ Mercado Pago no devolvió qr_data");
      return res.status(500).json({ error: "No se pudo generar QR real" });
    }

    // 👉 Convertimos el qr_data en imagen base64
    const qr_base64 = await QRCode.toDataURL(qrData);

    res.json({
      ok: true,
      qr_base64
    });

  } catch (error) {
    console.error("❌ ERROR QR INTEROPERABLE:", error.response?.data || error.message);
    res.status(500).json({ error: "Error generando QR interoperable" });
  }
};

module.exports = {
  generarQR,
  crearPreferencia

}