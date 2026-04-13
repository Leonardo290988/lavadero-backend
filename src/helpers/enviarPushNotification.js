const axios = require("axios");

/**
 * Envía una notificación push via Expo Push API.
 * @param {string} expoPushToken - Token del dispositivo destino
 * @param {string} titulo
 * @param {string} cuerpo
 * @param {object} data - Datos extra opcionales
 */
const enviarPushNotification = async (expoPushToken, titulo, cuerpo, data = {}) => {
  if (!expoPushToken) {
    console.log("⚠️ No hay push token configurado, omitiendo notificación");
    return;
  }

  try {
    const response = await axios.post(
      "https://exp.host/--/api/v2/push/send",
      {
        to: expoPushToken,
        sound: "default",
        title: titulo,
        body: cuerpo,
        data,
        priority: "high",
      },
      {
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    console.log("📲 Push enviada:", response.data);
  } catch (error) {
    console.error("❌ Error enviando push:", error?.response?.data || error.message);
  }
};

module.exports = enviarPushNotification;
