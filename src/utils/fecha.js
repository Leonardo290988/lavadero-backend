exports.fechaArgentina = () => {
  return new Date().toLocaleString("es-AR", { hour12: false });
};