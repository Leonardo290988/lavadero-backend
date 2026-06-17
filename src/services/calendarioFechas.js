/**
 * ============================================================
 *  CALENDARIO DE FECHAS ESPECIALES - Lavaderos Moreno
 * ============================================================
 *  Devuelve las fechas relevantes que caen HOY o en los
 *  próximos N días, para que el agente las mencione.
 *
 *  Incluye: fechas patrias, comerciales y los partidos de
 *  Argentina en el Mundial 2026.
 *
 *  👉 Para AGREGAR un partido de eliminación o una fecha nueva,
 *     editá los arrays de abajo.
 * ============================================================
 */

// ---- Fechas fijas (se repiten cada año en el mismo día) ----
const FIJAS = [
  // Patrias / feriados
  { mes: 1, dia: 1, nombre: "Año Nuevo", tipo: "patria" },
  { mes: 3, dia: 24, nombre: "Día de la Memoria por la Verdad y la Justicia", tipo: "patria" },
  { mes: 4, dia: 2, nombre: "Día del Veterano y de los Caídos en Malvinas", tipo: "patria" },
  { mes: 5, dia: 1, nombre: "Día del Trabajador", tipo: "patria" },
  { mes: 5, dia: 25, nombre: "Día de la Revolución de Mayo", tipo: "patria" },
  { mes: 6, dia: 20, nombre: "Día de la Bandera", tipo: "patria" },
  { mes: 7, dia: 9, nombre: "Día de la Independencia", tipo: "patria" },
  { mes: 8, dia: 17, nombre: "Paso a la Inmortalidad del Gral. San Martín", tipo: "patria" },
  { mes: 10, dia: 12, nombre: "Día del Respeto a la Diversidad Cultural", tipo: "patria" },
  { mes: 11, dia: 20, nombre: "Día de la Soberanía Nacional", tipo: "patria" },
  { mes: 12, dia: 25, nombre: "Navidad", tipo: "patria" },

  // Comerciales fijas
  { mes: 2, dia: 14, nombre: "San Valentín / Día de los Enamorados", tipo: "comercial" },
  { mes: 7, dia: 20, nombre: "Día del Amigo", tipo: "comercial" },

  // Estaciones (aprox.)
  { mes: 6, dia: 21, nombre: "Inicio del invierno", tipo: "estacion" },
  { mes: 9, dia: 21, nombre: "Inicio de la primavera", tipo: "estacion" },
  { mes: 12, dia: 21, nombre: "Inicio del verano", tipo: "estacion" },
  { mes: 3, dia: 21, nombre: "Inicio del otoño", tipo: "estacion" },
];

// ---- Fechas variables (caen en el N° domingo de un mes) ----
// Día del Padre: 3er domingo de junio
// Día del Niño: 3er domingo de agosto (Argentina)
// Día de la Madre: 3er domingo de octubre (Argentina)
const VARIABLES = [
  { nombre: "Día del Padre", tipo: "comercial", mes: 6, domingoN: 3 },
  { nombre: "Día del Niño/a", tipo: "comercial", mes: 8, domingoN: 3 },
  { nombre: "Día de la Madre", tipo: "comercial", mes: 10, domingoN: 3 },
];

// ---- Partidos de Argentina en el Mundial 2026 ----
// Formato fecha: "YYYY-MM-DD". Agregá los de eliminación cuando se confirmen.
const PARTIDOS_ARGENTINA = [
  { fecha: "2026-06-22", rival: "Austria", hora: "14:00", instancia: "Fase de grupos" },
  { fecha: "2026-06-27", rival: "Jordania", hora: "23:00", instancia: "Fase de grupos" },
  // Ejemplo para agregar eliminación:
  // { fecha: "2026-07-03", rival: "a definir", hora: "00:00", instancia: "16avos de final" },
];

/**
 * Devuelve el día (1-31) del N° domingo de un mes/año.
 */
function domingoNDelMes(anio, mes, n) {
  const primero = new Date(anio, mes - 1, 1);
  const diaSemanaPrimero = primero.getDay(); // 0 = domingo
  let primerDomingo = 1 + ((7 - diaSemanaPrimero) % 7);
  return primerDomingo + (n - 1) * 7;
}

/**
 * Diferencia en días entre dos fechas (ignora horas).
 */
function diffDias(desde, hasta) {
  const a = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const b = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Devuelve las fechas relevantes que caen hoy o en los próximos `diasAntes` días.
 * @param {Date} ahora
 * @param {number} diasAntes - cuántos días de anticipación considerar (ej: 2)
 * @returns {Array<{nombre, tipo, faltan, esHoy, detalle?}>}
 */
function getFechasRelevantes(ahora = new Date(), diasAntes = 2) {
  const relevantes = [];
  const anio = ahora.getFullYear();

  // Helper para evaluar una fecha concreta (mes/dia) en este año y el próximo
  const evaluar = (mes, dia, nombre, tipo, detalle) => {
    for (const a of [anio, anio + 1]) {
      const fecha = new Date(a, mes - 1, dia);
      const faltan = diffDias(ahora, fecha);
      if (faltan >= 0 && faltan <= diasAntes) {
        relevantes.push({ nombre, tipo, faltan, esHoy: faltan === 0, detalle: detalle || null });
      }
    }
  };

  // Fijas
  for (const f of FIJAS) evaluar(f.mes, f.dia, f.nombre, f.tipo);

  // Variables (domingo N)
  for (const v of VARIABLES) {
    for (const a of [anio, anio + 1]) {
      const dia = domingoNDelMes(a, v.mes, v.domingoN);
      const fecha = new Date(a, v.mes - 1, dia);
      const faltan = diffDias(ahora, fecha);
      if (faltan >= 0 && faltan <= diasAntes) {
        relevantes.push({ nombre: v.nombre, tipo: v.tipo, faltan, esHoy: faltan === 0, detalle: null });
      }
    }
  }

  // Partidos del Mundial
  for (const p of PARTIDOS_ARGENTINA) {
    const fecha = new Date(p.fecha + "T00:00:00");
    const faltan = diffDias(ahora, fecha);
    if (faltan >= 0 && faltan <= diasAntes) {
      relevantes.push({
        nombre: `Partido de Argentina vs ${p.rival}`,
        tipo: "mundial",
        faltan,
        esHoy: faltan === 0,
        detalle: `${p.instancia} · ${p.hora} hs (Argentina)`,
      });
    }
  }

  // Ordenar: lo que es hoy primero, después por cercanía
  relevantes.sort((a, b) => a.faltan - b.faltan);
  return relevantes;
}

module.exports = { getFechasRelevantes, PARTIDOS_ARGENTINA };
