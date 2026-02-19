const enviarWhatsApp = async ({ telefono, nombre, ordenId, total, senia }) => {
  const saldo = Math.max(total - senia, 0);

  const mensaje = `
🧺 Lavaderos Moreno

Hola ${nombre} 👋
Tu pedido #${ordenId} ya está listo para retirar ✅

💰 Total: $${total}
💵 Seña: $${senia}
➡️ Saldo: $${saldo}

        ¡Te esperamos en Hipolito Yrigoyen 1471, Moreno!
    Nuestros horarios de Atención Lunes a Sábados de 9hs a 18hs
`;

  // 👉 POR AHORA SOLO LOGUEAMOS
  console.log('📲 WhatsApp a enviar:');
  console.log('Tel:', telefono);
  console.log(mensaje);

  return true;
};

module.exports = enviarWhatsApp;