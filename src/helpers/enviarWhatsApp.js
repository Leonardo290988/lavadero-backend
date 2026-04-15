const enviarWhatsApp = async ({ telefono, nombre, ordenId, total, senia }) => {
  const saldo = Math.max(total - senia, 0);

  const mensaje = `🧺 *Lavaderos Moreno*

Hola ${nombre}! 👋
Tu orden *#${ordenId}* está lista y esperándote ✨

💵 Saldo a abonar al retirar: *$${saldo}*

📍 Hipólito Yrigoyen 1471, Moreno
🕐 Lunes a Sábados de 9 a 18hs

⚠️ Recordá que pasados los 30 días se cobra una multa por almacenamiento.`;

  // 👉 POR AHORA SOLO LOGUEAMOS
  console.log('📲 WhatsApp a enviar:');
  console.log('Tel:', telefono);
  console.log(mensaje);

  return true;
};

module.exports = enviarWhatsApp;
