const { MercadoPagoConfig } = require("mercadopago");
console.log("🧪 MP_ACCESS_TOKEN =", process.env.MP_ACCESS_TOKEN);

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

module.exports = client;