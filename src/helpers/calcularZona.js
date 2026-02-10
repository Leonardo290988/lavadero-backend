// src/helpers/calcularZona.js

function calcularZona(distanciaKm) {
  if (distanciaKm <= 1) return 1;
  if (distanciaKm <= 3) return 2;
  return 3;
}

module.exports = calcularZona;