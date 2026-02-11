const { Preference } = require("mercadopago");
const mpClient = require("../config/mercadopago");

const crearPreferencia = async (req, res) => {
  try {

    const {
      titulo,
      precio,
      tipo,        // retiro | envio | combo
      retiro_id,   // opcional
      envio_id     // opcional
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

module.exports = { crearPreferencia };