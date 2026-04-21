const axios = require("axios");

const BOT_URL = process.env.BOT_URL || "https://lavadero-bot-production.up.railway.app";

const enviarWhatsApp = async ({ telefono, mensaje }) => {
  try {
    const res = await axios.post(`${BOT_URL}/enviar`, { telefono, mensaje }, { timeout: 10000 });
    if (res.data.ok) {
      console.log(`✅ WhatsApp enviado via bot a ${telefono}`);
      return { ok: true, automatico: true };
    }
  } catch (error) {
    console.warn("⚠️ Bot no disponible, usando URL manual:", error.message);
  }

  // Fallback: devolver URL para abrir WhatsApp manualmente
  const tel = telefono.replace(/\D/g, "");
  return {
    ok: false,
    automatico: false,
    whatsapp_url: `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`
  };
};

module.exports = enviarWhatsApp;
