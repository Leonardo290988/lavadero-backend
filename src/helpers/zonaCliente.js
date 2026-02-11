// src/helpers/zonaCliente.js

// 📍 Coordenadas del lavadero
const LAVADERO_LAT = -34.653777;
const LAVADERO_LNG = -58.799750;

// 💰 Precios por zona
const PRECIOS = {
  1: 1,
  2: 2500,
  3: 3500
};

// 📐 Calcular distancia entre 2 puntos (Haversine)
function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 🧠 Determinar zona según distancia
function determinarZona(distanciaKm) {
  if (distanciaKm <= 1) return 1;
  if (distanciaKm <= 3) return 2;
  return 3;
}

// 🚀 Función principal
function obtenerZonaCliente(latCliente, lngCliente) {
  const distancia = calcularDistanciaKm(
    LAVADERO_LAT,
    LAVADERO_LNG,
    latCliente,
    lngCliente
  );

  const distanciaRedondeada = Number(distancia.toFixed(2));
  const zona = determinarZona(distanciaRedondeada);
  const precio = PRECIOS[zona];

  return {
    distanciaKm: distanciaRedondeada,
    zona,
    precio
  };
}

module.exports =  obtenerZonaCliente;