const enviarWhatsApp = async ({ telefono, nombre, ordenId, total, senia }) => {
  const saldo = Math.max(total - senia, 0);

  const mensaje = `
🧺 Lavadero Moreno

Hola ${nombre} 👋
Tu pedido #${ordenId} ya está listo para retirar ✅

💰 Total: $${total}
💵 Seña: $${senia}
➡️ Saldo: $${saldo}

¡Te esperamos!
`;

  // 👉 POR AHORA SOLO LOGUEAMOS
  console.log('📲 WhatsApp a enviar:');
  console.log('Tel:', telefono);
  console.log(mensaje);

  return true;
};

module.exports = enviarWhatsApp;