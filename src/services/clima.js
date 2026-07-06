/**
 * ============================================================
 *  CLIMA - Moreno, GBA Oeste
 * ============================================================
 *  Usa Open-Meteo (gratis, sin API key).
 *  Devuelve si el clima del día es "llamativo" (lluvia, frío
 *  o calor intensos) para que el agente decida mencionarlo.
 * ============================================================
 */

const axios = require("axios");

// Coordenadas de Moreno, Buenos Aires
const LAT = -34.6534;
const LON = -58.7916;

// Códigos WMO que indican lluvia / tormenta / llovizna
const CODIGOS_LLUVIA = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];
const CODIGOS_NIEVE = [71, 73, 75, 77, 85, 86];

/**
 * Devuelve el clima del día.
 * @returns {Promise<{llamativo:boolean, tipo:string, temp:number|null, descripcion:string}>}
 */
async function obtenerClima() {
  try {
    const res = await axios.get("https://api.open-meteo.com/v1/forecast", {
      params: {
        latitude: LAT,
        longitude: LON,
        current: "temperature_2m,precipitation,weather_code",
        timezone: "America/Argentina/Buenos_Aires",
      },
      timeout: 10000,
    });

    const c = res.data?.current || {};
    const temp = typeof c.temperature_2m === "number" ? Math.round(c.temperature_2m) : null;
    const precip = c.precipitation || 0;
    const code = c.weather_code;

    // Determinar si es llamativo
    if (CODIGOS_LLUVIA.includes(code) || precip > 0.2) {
      return { llamativo: true, tipo: "lluvia", temp, descripcion: `Está lloviendo en Moreno (${temp}°C).` };
    }
    if (CODIGOS_NIEVE.includes(code)) {
      return { llamativo: true, tipo: "nieve", temp, descripcion: `Está nevando/helando en Moreno (${temp}°C).` };
    }
    if (temp !== null && temp <= 7) {
      return { llamativo: true, tipo: "frio", temp, descripcion: `Hace mucho frío en Moreno (${temp}°C).` };
    }
    if (temp !== null && temp >= 32) {
      return { llamativo: true, tipo: "calor", temp, descripcion: `Hace mucho calor en Moreno (${temp}°C).` };
    }

    return { llamativo: false, tipo: "normal", temp, descripcion: temp !== null ? `Clima normal en Moreno (${temp}°C).` : "Clima normal." };
  } catch (e) {
    console.warn("[clima] No se pudo obtener el clima:", e.message);
    return { llamativo: false, tipo: "desconocido", temp: null, descripcion: "Clima no disponible." };
  }
}

module.exports = { obtenerClima };
