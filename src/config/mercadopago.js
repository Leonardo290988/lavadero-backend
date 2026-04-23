const { MercadoPagoConfig } = require("mercadopago");

if (!process.env.MP_ACCESS_TOKEN) {
  console.error("❌ Falta la variable de entorno MP_ACCESS_TOKEN");
  process.exit(1);
}

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

module.exports = client;