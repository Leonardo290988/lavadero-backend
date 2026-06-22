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
- Servicios: lavado de ropa en general, acolchados, camperones, ropa de cama, zapatillas.
- Tiene servicio de valet (retiro y entrega a domicilio) y local.
- App propia para clientes.
- Tono de marca: cercano, barrial, cálido, informal pero prolijo. Hablale de "vos".
- Público: familias y trabajadores de la zona, gente con poco tiempo.
`;

// Lista base de búsquedas de imágenes SEGURAS (en inglés, para Pexels).
// Claude debe preferir estas, pero puede variar con términos parecidos y apropiados.
const BUSQUEDAS_BASE = [
  "folded laundry",
  "clean clothes basket",
  "cozy home winter",
  "laundry basket clothes",
  "fresh towels",
  "rainy window home",
  "warm blanket bed",
  "happy family home",
  "washing machine home",
  "neatly folded clothes",
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
async function decidirYGenerar() {
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
Si el modo es "frase", incluí en el JSON el campo "busqueda" con términos EN INGLÉS para buscar la foto de fondo.
REGLA DE ORO: la búsqueda tiene que ser un OBJETO o ESCENA CONCRETA Y FOTOGRAFIABLE, claramente relacionada con el negocio. Ejemplos buenos: "folded laundry stack", "laundry basket full of clothes", "cozy bed with blanket winter", "washing machine laundry room", "fresh clean towels", "family relaxing home sofa", "rainy day window home".
NO uses conceptos abstractos ni fechas como búsqueda (ej: NO busques "argentina flag day", "independence", "celebration"): eso devuelve fotos sin relación. 
Si el tema NO tiene una imagen concreta y relacionada que lo represente bien, igual buscá lo más representativo posible (mirá la guía de fechas de abajo).
GUÍA DE BÚSQUEDA POR FECHA ESPECIAL (usá estos términos concretos cuando aplique):
- Día de la Bandera / fechas patrias → "argentina flag waving" o "argentina flag"
- Día del Niño/a → "kids playing happy" o "children playing outdoors"
- Día del Padre → "father and child happy" o "dad with kids"
- Día de la Madre → "mother and child home" o "happy mother family"
- Día del Amigo → "friends laughing together"
- San Valentín → "couple cozy home"
- Mundial / partido de Argentina → "soccer ball field" o "people celebrating sports" (sin escudos ni marcas)
- Invierno → "cozy winter blanket bed" o "rainy window home"
Preferí estos términos base: ${BUSQUEDAS_BASE.join(", ")}.

REGLAS DE DECISIÓN:
- PREFERENCIA DE ESTILO: la mayoría de las publicaciones (alrededor de 7 de cada 10) deben ser estilo "frase" con foto real, porque enganchan más. Usá "placa" con menos frecuencia (alrededor de 3 de cada 10), reservándola para cuando hay una promo concreta para empujar (3x2 o puntos) o una fecha que pida un diseño de placa.
- Mirá las ÚLTIMAS PUBLICACIONES: si las últimas fueron placas, esta vez hacé "frase"; si venís con varias "frase", podés meter una placa de promo. Buscá que predomine "frase" pero sin abandonar las promos.
- Martes a viernes: buen momento para recordar la promo 3x2, pero podés hacerlo igual con estilo "frase" (foto + frase que mencione la promo) en vez de placa, para variar.
- Lunes / fin de semana: "frase" emocional.
- NO repitas el mismo tema ni el mismo estilo que las últimas 2-3. Buscá variar.
- Si ya publicaste algo muy parecido hace muy poco, respondé shouldPost: false.
- Estamos en invierno en Argentina (junio-agosto): aprovechá el frío, los acolchados, camperones, la lluvia.

FECHAS ESPECIALES (¡muy importante!):
- Si en el contexto aparece una FECHA RELEVANTE (fecha patria, comercial, estación o partido del Mundial) que es hoy o está muy cerca, dale PRIORIDAD y armá el contenido alusivo a esa fecha.
- Patrias: tono respetuoso y festivo. Para la imagen, usá modo "frase" con una búsqueda CONCRETA y representativa de la fecha (ej: Día de la Bandera → "argentina flag waving"; Día de la Independencia → "argentina flag sky"; fechas patrias en general → "argentina flag"). Un saludo cálido del negocio como frase.
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
  "frase": { "frase": "...", "bajada": "...", "busqueda": "folded laundry" },
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
