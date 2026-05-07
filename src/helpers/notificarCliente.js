const pool = require("../db");
const enviarPushNotification = require("./enviarPushNotification");

/**
 * Busca el push_token del cliente en la DB y le envía una notificación.
 * Si el cliente no tiene token guardado, simplemente no hace nada
 * (es seguro llamarlo aunque el cliente no tenga la app instalada).
 *
 * @param {number} clienteId
 * @param {string} titulo - Ej: "✅ Retiro aceptado"
 * @param {string} cuerpo - Ej: "Pasaremos hoy entre las 16 y 18 hs"
 * @param {object} data   - Datos extra opcionales (orden_id, retiro_id, etc.)
 */
const notificarCliente = async (clienteId, titulo, cuerpo, data = {}) => {
  if (!clienteId) return;

  try {
    const r = await pool.query(
      "SELECT push_token FROM clientes WHERE id = $1",
      [clienteId]
    );

    const token = r.rows[0]?.push_token;

    if (!token) {
      console.log(`📵 Cliente ${clienteId} sin push token — omitiendo`);
      return;
    }

    await enviarPushNotification(token, titulo, cuerpo, data);
  } catch (error) {
    console.error("❌ Error notificando cliente:", error.message);
  }
};

module.exports = notificarCliente;
