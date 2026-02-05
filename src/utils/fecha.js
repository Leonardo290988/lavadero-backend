export function fechaArgentina(fecha = new Date()) {
  return new Date(fecha).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}