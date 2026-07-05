/**
 * ============================================================
 *  AGENTE SOCIAL - Cerebro (decide y redacta con Claude)
 *  Lavaderos Moreno
 * ============================================================
 *  - Lee el contexto (día, hora, últimas publicaciones)
 *  - Le pide a Claude que decida QUÉ publicar y lo redacte
 *  - Devuelve la decisión lista para generar imagen y publicar
 *
 *  Usa axios (ya instalado) para llamar a la API de Claude.
 *  Requiere la variable de entorno: ANTHROPIC_API_KEY
 * ============================================================
 */

const axios = require("axios");
const pool = require("../db");
const { getFechasRelevantes } = require("./calendarioFechas");

// ============================================================
//  PROMOS FIJAS — editá acá cuando cambien tus promociones
// ============================================================
const PROMOS_FIJAS = [
  {
    id: "3x2",
    descripcion: "3x2 en acolchados y camperones: llevás 3 y pagás 2. Válido de martes a viernes. No acumulable con otras promos.",
    dias_ideales: [2, 3, 4, 5], // martes a viernes
  },
  {
    id: "puntos",
    descripcion: "Sistema de puntos: cada $1000 gastados sumás 1 punto. Con 100 puntos tenés 10% de descuento, con 150 un 15% y con 200 un 20%. No acumulable con otras promos.",
    dias_ideales: [1, 6, 0], // lunes, sábado, domingo
  },
];

// Datos del negocio para que Claude tenga contexto
const NEGOCIO = `
Lavaderos Moreno es una lavandería en Moreno, GBA Oeste, Argentina.
- SERVICIO DE VALET: es el servicio de LAVADO Y SECADO de ropa (el servicio principal del lavadero). NO significa retiro ni entrega a domicilio. Cuando hables del "valet", referite al lavado y secado profesional de las prendas.
- Otros servicios: lavado de ropa en general, acolchados, camperones, ropa de cama, zapatillas.
- Atención en el LOCAL (el cliente lleva y retira su ropa).
- IMPORTANTE: NO ofrecas retiro ni entrega a domicilio. NUNCA digas cosas como "no te muevas de tu casa", "pedí el retiro a domicilio" ni "te lo llevamos". El cliente se acerca al local.
- App propia para clientes.
- Tono de marca: cercano, barrial, cálido, informal pero prolijo. Hablale de "vos".
- Público: familias y trabajadores de la zona, gente con poco tiempo.
`;

// Lista base de búsquedas de imágenes SEGURAS (en español, para Pexels con locale es-ES).
// Claude debe preferir estas, pero puede variar con términos parecidos y apropiados.
const BUSQUEDAS_BASE = [
  "ropa doblada",
  "canasto de ropa limpia",
  "hogar acogedor invierno",
  "ropa lavada ordenada",
  "toallas limpias",
  "ventana con lluvia hogar",
  "manta abrigada en la cama",
  "familia feliz en casa",
  "lavarropas hogar",
  "ropa de cama limpia",
];

/**
 * Trae el contexto actual desde la base.
 */
async function getContext() {
  const now = new Date();
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

  let ultimas = [];
  try {
    const r = await pool.query(`
      SELECT modo, titular, caption, publicado_en
      FROM social_posts
      ORDER BY publicado_en DESC
      LIMIT 8
    `);
    ultimas = r.rows;
  } catch (e) {
    console.warn("[socialAgent] No se pudo leer historial:", e.message);
  }

  return {
    diaSemana: now.getDay(),
    diaNombre: dias[now.getDay()],
    hora: now.getHours(),
    fecha: now.toISOString().slice(0, 10),
    ultimas,
    fechasRelevantes: getFechasRelevantes(now, 2),
  };
}

/**
 * Le pide a Claude que decida y redacte.
 * Devuelve un objeto con la decisión (ver formato abajo).
 */
async function decidirYGenerar(sugerencia = "") {
  const ctx = await getContext();

  const systemPrompt = `
Sos el community manager autónomo de Lavaderos Moreno. Tu trabajo es decidir si HOY conviene publicar algo en redes (Facebook + Instagram) y, si es así, redactar el contenido completo.

${NEGOCIO}

PROMOCIONES VIGENTES:
${PROMOS_FIJAS.map(p => `- [${p.id}] ${p.descripcion}`).join("\n")}

TENÉS DOS ESTILOS DE PUBLICACIÓN:
1. "placa"  → una placa de promoción con diseño de marca (etiqueta tipo PROMO, un titular corto y potente, y una bajada). Ideal para comunicar promociones concretas (3x2, puntos).
2. "frase"  → una imagen estilo foto + frase emocional/cercana, que conecta con la vida cotidiana (el cansancio, el tiempo libre, el frío, el valor de la ropa). Ideal para novedades, estacionalidad y enganche emocional. NO es una promo directa. Para este estilo se baja una foto real de fondo.

BÚSQUEDA DE FOTO (solo para modo "frase"):
Si el modo es "frase", incluí en el JSON el campo "busqueda" con términos EN ESPAÑOL para buscar la foto de fondo.
REGLA DE ORO: la búsqueda tiene que ser un OBJETO o ESCENA CONCRETA Y FOTOGRAFIABLE, claramente relacionada con el negocio. Ejemplos buenos: "ropa doblada", "canasto lleno de ropa", "cama con manta en invierno", "lavarropas", "toallas limpias", "familia relajada en el sofá", "ventana con lluvia".
NO uses conceptos abstractos como búsqueda (ej: NO busques "independencia", "celebración"): eso devuelve fotos sin relación.
Si el tema NO tiene una imagen concreta y relacionada que lo represente bien, igual buscá lo más representativo posible (mirá la guía de fechas de abajo).
GUÍA DE BÚSQUEDA POR FECHA ESPECIAL (usá estos términos concretos cuando aplique):
- Día de la Bandera / fechas patrias → "bandera argentina"
- Día del Niño/a → "niños jugando felices" o "chicos jugando"
- Día del Padre → "padre e hijo felices" o "papá con hijos"
- Día de la Madre → "madre e hijo en casa" o "mamá feliz familia"
- Día del Amigo → "amigos riendo juntos"
- San Valentín → "pareja en casa"
- Mundial / partido de Argentina → "pelota de fútbol cancha" o "festejo deportivo" (sin escudos ni marcas)
- Invierno → "cama abrigada invierno" o "ventana con lluvia"
Preferí estos términos base: ${BUSQUEDAS_BASE.join(", ")}.

MENÚ DE TIPOS DE CONTENIDO (¡rotá entre estos, no repitas siempre lo mismo!):
- TIP de lavado: consejos útiles (cómo quitar una mancha, lavar zapatillas, cuidar acolchados, separar colores, etc.). Muy valorado por la gente.
- HUMOR / relatable: algo con gracia sobre la vida cotidiana y la ropa (el drama de la ropa acumulada, los lunes, el cesto que nunca baja). Tono liviano y simpático.
- CLIMA / estación: algo ligado al frío, la lluvia, el invierno (ej: "día de lluvia, día de mate y ropa limpia").
- FRASE emocional: conectar con el tiempo libre, el descanso, el valor de las prendas.
- PROMO: 3x2 en acolchados/camperones o el sistema de puntos.
- NOVEDAD / servicio: recordar el servicio de lavado y secado (valet), la app, la calidad.
- FECHA ESPECIAL: si hay una fecha relevante cerca (ver abajo).

REGLAS DE DECISIÓN:
- VARIEDAD ANTE TODO: rotá entre los tipos de contenido del menú. Mirá las ÚLTIMAS PUBLICACIONES y elegí un tipo DISTINTO a los últimos 3-4. La gente se aburre si ve siempre lo mismo.
- LA PROMO 3x2 NO ES LA PRIORIDAD DIARIA: usala como MUCHO 1 o 2 veces por semana, no todos los días. Si en las últimas publicaciones ya apareció el 3x2, NO lo repitas: elegí tip, humor, clima, frase o novedad.
- Preferí bastante el estilo "frase" con foto real (engancha más). Usá "placa" sobre todo para las promos concretas (3x2, puntos) o saludos de fechas.
- Lunes a viernes: variá libremente entre tip, humor, clima, frase o novedad. NO asumas que de martes a viernes hay que hablar del 3x2.
- Fines de semana: frase emocional, humor o fecha especial.
- NO repitas el mismo tema ni el mismo estilo que las últimas 3-4 publicaciones.
- Si ya publicaste algo muy parecido hace muy poco, respondé shouldPost: false.
- Estamos en invierno en Argentina (junio-agosto): podés aprovechar el frío, los acolchados, camperones y la lluvia (pero sin repetirlo siempre).

FECHAS ESPECIALES (¡muy importante!):
- Si en el contexto aparece una FECHA RELEVANTE (fecha patria, comercial, estación o partido del Mundial) que es hoy o está muy cerca, dale PRIORIDAD y armá el contenido alusivo a esa fecha.
- Patrias: tono respetuoso y festivo. Para la imagen, usá modo "frase" con una búsqueda CONCRETA y representativa de la fecha (ej: Día de la Bandera → "bandera argentina"; Día de la Independencia → "bandera argentina"; fechas patrias en general → "bandera argentina"). Un saludo cálido del negocio como frase.
- Comerciales (Día del Padre/Madre/Niño, San Valentín, Amigo): podés ligarlas a una promo o a "regalá tiempo libre, nosotros lavamos".
- Estaciones (invierno): perfecto para empujar acolchados y camperones.
- MUNDIAL: cuando Argentina juega (hoy o en 1-2 días), hacé un posteo alentando a la Selección con identidad de marca (ej: relacionar la camiseta argentina, el aguante, con que vos te ocupás de la ropa mientras ellos alientan). Tono festivo, "¡Vamos Argentina!". Nunca uses escudos, logos de FIFA ni marcas registradas; solo aliento genérico.
- Si hay varias fechas cerca, elegí la más relevante para el negocio y no las amontones.

REDACCIÓN:
- El texto del post (caption) tiene que sonar humano y cercano, nunca robótico ni corporativo. Máximo 4 líneas. Podés usar 1-2 emojis con moderación.
- Hashtags: máximo 3, relevantes y locales (ej: #LavaderosMoreno #Moreno).
- Para "placa": el titular va en MAYÚSCULAS o normal, corto (máx 5-6 palabras), bien impactante. La bajada explica el detalle.
- Para "frase": la frase de la imagen es la parte emocional (puede ser 2 partes con "..."), la bajada cierra la idea.

RESPONDÉ ÚNICAMENTE CON JSON VÁLIDO, sin markdown, sin explicaciones, con esta forma exacta:
{
  "shouldPost": true,
  "razon": "breve por qué de la decisión",
  "modo": "placa" | "frase",
  "placa": { "etiqueta": "PROMO", "titular": "...", "bajada": "..." },
  "frase": { "frase": "...", "bajada": "...", "busqueda": "ropa doblada" },
  "caption": "texto del post para FB e IG",
  "hashtags": ["#...", "#..."]
}
Si modo es "placa", podés dejar "frase" en null. Si modo es "frase", dejá "placa" en null. Si shouldPost es false, el resto puede ir en null.
`;

  const userPrompt = `
CONTEXTO DE HOY:
- Fecha: ${ctx.fecha}
- Día: ${ctx.diaNombre} (número ${ctx.diaSemana})
- Hora: ${ctx.hora}hs

ÚLTIMAS PUBLICACIONES (de más nueva a más vieja):
${ctx.ultimas.length ? ctx.ultimas.map(u => `- [${u.modo}] ${u.titular || u.caption?.slice(0, 60) || ""} (${new Date(u.publicado_en).toISOString().slice(0, 10)})`).join("\n") : "Todavía no hay publicaciones registradas."}

FECHAS RELEVANTES HOY O PRÓXIMAS:
${ctx.fechasRelevantes.length ? ctx.fechasRelevantes.map(f => `- ${f.nombre}${f.detalle ? " (" + f.detalle + ")" : ""} → ${f.esHoy ? "ES HOY" : "en " + f.faltan + " día(s)"} [${f.tipo}]`).join("\n") : "No hay fechas especiales cerca."}
${sugerencia ? `
⭐ SUGERENCIA DEL DUEÑO (¡prioridad máxima!):
El dueño te pide específicamente esta publicación: "${sugerencia}"
Creá la publicación siguiendo esta idea lo más fielmente posible. shouldPost debe ser true (salvo que la idea sea claramente inapropiada o ajena al negocio). Elegí el estilo (placa o frase) que mejor le quede a la idea, y si es "frase", buscá una foto acorde.
` : ""}
Decidí si publicar hoy y, si sí, generá el contenido completo.
`;

  const resp = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    },
    {
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      timeout: 30000,
    }
  );

  // Extraer el texto de la respuesta
  let texto = "";
  for (const bloque of resp.data.content) {
    if (bloque.type === "text") texto += bloque.text;
  }
  texto = texto.trim().replace(/^```json/i, "").replace(/```$/, "").trim();

  let decision;
  try {
    decision = JSON.parse(texto);
  } catch (e) {
    throw new Error("Claude no devolvió JSON válido: " + texto.slice(0, 200));
  }

  return decision;
}

module.exports = { decidirYGenerar, PROMOS_FIJAS };
