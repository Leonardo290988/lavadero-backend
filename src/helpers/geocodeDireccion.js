const axios = require("axios");

const geocodeDireccion = async (direccion) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  const url = "https://maps.googleapis.com/maps/api/geocode/json";

  const res = await axios.get(url, {
    params: {
      address: direccion,
      key: apiKey
    }
  });

  if (
    !res.data.results ||
    res.data.results.length === 0
  ) {
    throw new Error("No se pudo geolocalizar la dirección");
  }

  const location = res.data.results[0].geometry.location;

  return {
    lat: location.lat,
    lng: location.lng
  };
};

module.exports = geocodeDireccion;