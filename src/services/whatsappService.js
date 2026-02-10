const axios = require('axios');

// ⚠️ Ejemplo con API externa (Twilio / CallMeBot / UltraMsg)
// Acá lo dejamos genérico
const enviarWhatsApp = async ({ telefono, nombre, ordenId, total, senia }) => {
  try {
    const mensaje = `
Hola ${nombre} 👋
Tu ropa ya está lista para retirar ✅

🧾 Orden #${ordenId}
💰 Total: $${total}
💵 Seña: $${senia}
➡️ Saldo: $${total - senia}

Gracias por confiar en nosotros 😊
Lavaderos Moreno
    `.trim();

    console.log('📲 WHATSAPP A ENVIAR:');
    console.log(telefono);
    console.log(mensaje);

    // 👉 ACÁ VA LA API REAL (por ahora solo log)
    // await axios.post('https://api.whatsapp...', {...})

  } catch (error) {
    console.error('❌ ERROR WHATSAPP:', error.message);
  }
};

module.exports = { enviarWhatsApp };