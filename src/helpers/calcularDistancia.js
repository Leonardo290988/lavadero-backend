// src/helpers/calcularDistancia.js

function gradosARadianes(grados) {
  return grados * (Math.PI / 180);
}

function calcularDistanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Radio de la Tierra en KM

  const dLat = gradosARadianes(lat2 - lat1);
  const dLng = gradosARadianes(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(gradosARadianes(lat1)) *
      Math.cos(gradosARadianes(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

module.exports = calcularDistanciaKm;