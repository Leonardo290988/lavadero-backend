const axios = require('axios');

const enviarWhatsApp = async ({ telefono, nombre, ordenId, total }) => {
  // 👉 Esto es un MOCK (simulación)
  console.log('📲 WHATSAPP ENVIADO');
  console.log(`
Hola ${nombre} 👋
Tu pedido N° ${ordenId} ya está listo ✅

Total: $${total}
Podés pasar a retirarlo de Lunes a Sábados de 9hs a 18hs

Gracias por confiar en Lavaderos Moreno 🙌
`);

  // Más adelante acá va la API real
};

module.exports = { enviarWhatsApp };