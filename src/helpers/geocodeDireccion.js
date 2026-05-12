const axios = require("axios");

const geocodeDireccion = async (direccion) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY no configurada en variables de entorno");
  }

  const url = "https://maps.googleapis.com/maps/api/geocode/json";

  // 🔥 Si la dirección no menciona Moreno, se lo agregamos
  let direccionFinal = direccion;
  const dirLower = direccion.toLowerCase();
  if (!dirLower.includes("moreno") && !dirLower.includes("buenos aires")) {
    direccionFinal = `${direccion}, Moreno, Buenos Aires, Argentina`;
  }

  const res = await axios.get(url, {
    params: {
      address: direccionFinal,
      key: apiKey,
      region: "ar",
      components: "country:AR|administrative_area:Buenos Aires"
    }
  });

  // 🆕 Si Google devuelve un status distinto a OK, loguearlo bien claro
  // para distinguir entre "dirección no encontrada" y "problema con la API key"
  if (res.data.status && res.data.status !== "OK") {
    const errMsg = res.data.error_message || res.data.status;
    console.error(`🚨 Google Geocoding API status=${res.data.status} | message="${errMsg}" | dirección="${direccionFinal}"`);

    // Errores de cuenta/billing/key → mensaje distinto al usuario
    if (
      res.data.status === "REQUEST_DENIED" ||
      res.data.status === "OVER_QUERY_LIMIT" ||
      res.data.status === "OVER_DAILY_LIMIT" ||
      res.data.status === "INVALID_REQUEST"
    ) {
      throw new Error(`Google Maps API: ${res.data.status} - ${errMsg}`);
    }
  }

  if (
    !res.data.results ||
    res.data.results.length === 0
  ) {
    throw new Error("No se pudo geolocalizar la dirección");
  }

  const result = res.data.results[0];
  const location = result.geometry.location;

  console.log(`📍 Geocode: "${direccion}" → "${result.formatted_address}" (${location.lat}, ${location.lng})`);

  const tipo = result.geometry.location_type;
  if (tipo === "APPROXIMATE") {
    throw new Error("La dirección no es lo suficientemente precisa. Por favor, ingresá calle y altura.");
  }

  return {
    lat: location.lat,
    lng: location.lng
  };
};

module.exports = geocodeDireccion;
