/**
 * ============================================================
 *  SCHEDULER DEL AGENTE SOCIAL
 *  Lavaderos Moreno
 * ============================================================
 *  - Crea la tabla social_posts si no existe
 *  - Corre 2 veces por día (10:00 y 18:00 ARG)
 *  - Le pregunta al agente si publicar, genera la imagen,
 *    publica en FB + IG y registra el resultado.
 *
 *  Se activa llamando initSocialScheduler() desde server.js
 * ============================================================
 */

const cron = require("node-cron");
const pool = require("../db");
const { decidirYGenerar } = require("../services/socialAgent");
const { generarPlaca, generarFotoFrase, limpiarPlacasViejas } = require("../services/imageGenerator");
const { publishFacebook, publishInstagram } = require("../services/metaPublisher");

// Crear tabla de historial (mismo patrón que db.js)
pool.query(`
  CREATE TABLE IF NOT EXISTS social_posts (
    id SERIAL PRIMARY KEY,
    modo VARCHAR(20),
    titular TEXT,
    caption TEXT,
    plataforma VARCHAR(20),
    meta_post_id VARCHAR(100),
    image_url TEXT,
    publicado_en TIMESTAMP DEFAULT NOW()
  )
`).catch(err => console.error("❌ Error creando social_posts:", err.message));

/**
 * Registra una publicación en la base.
 */
async function registrarPost(modo, titular, caption, plataforma, metaPostId, imageUrl) {
  try {
    await pool.query(
      `INSERT INTO social_posts (modo, titular, caption, plataforma, meta_post_id, image_url)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [modo, titular || null, caption, plataforma, metaPostId || null, imageUrl || null]
    );
  } catch (e) {
    console.error("[socialScheduler] Error registrando post:", e.message);
  }
}

/**
 * Ejecuta un ciclo completo: decide, genera, publica, registra.
 * Exportada para poder dispararla manualmente desde una ruta de prueba.
 */
async function ejecutarCiclo() {
  console.log("[socialAgent] Evaluando si publicar...");
  limpiarPlacasViejas();

  const decision = await decidirYGenerar();

  if (!decision.shouldPost) {
    console.log("[socialAgent] Decidió NO publicar:", decision.razon);
    return { publicado: false, razon: decision.razon };
  }

  console.log(`[socialAgent] Publicando (${decision.modo}). Razón:`, decision.razon);

  // 1. Generar la imagen según el modo
  let imagen, titular;
  if (decision.modo === "frase" && decision.frase) {
    imagen = await generarFotoFrase({
      frase: decision.frase.frase,
      bajada: decision.frase.bajada,
      busqueda: decision.frase.busqueda,
    });
    titular = decision.frase.frase;
  } else {
    // por defecto, placa
    imagen = await generarPlaca({
      etiqueta: decision.placa?.etiqueta || "PROMO",
      titular: decision.placa?.titular || "",
      bajada: decision.placa?.bajada || "",
    });
    titular = decision.placa?.titular || "";
  }

  const caption = decision.caption || "";
  const hashtags = decision.hashtags || [];
  const resultado = { publicado: true, modo: decision.modo, imagen: imagen.publicUrl };

  // 2. Publicar en Facebook
  try {
    const fb = await publishFacebook(imagen.publicUrl, caption, hashtags);
    await registrarPost(decision.modo, titular, caption, "facebook", fb.id || fb.post_id, imagen.publicUrl);
    resultado.facebook = fb;
    console.log("[socialAgent] Facebook OK:", fb.id || fb.post_id);
  } catch (e) {
    resultado.facebook_error = e.message;
    console.error("[socialAgent] Error Facebook:", e.message);
  }

  // 3. Publicar en Instagram
  try {
    const ig = await publishInstagram(imagen.publicUrl, caption, hashtags);
    await registrarPost(decision.modo, titular, caption, "instagram", ig.id, imagen.publicUrl);
    resultado.instagram = ig;
    console.log("[socialAgent] Instagram OK:", ig.id);
  } catch (e) {
    resultado.instagram_error = e.message;
    console.error("[socialAgent] Error Instagram:", e.message);
  }

  return resultado;
}

/**
 * Inicia el cron. Corre a las 10:00 y 18:00 (Argentina).
 */
function initSocialScheduler() {
  cron.schedule("0 10,18 * * *", async () => {
    try {
      await ejecutarCiclo();
    } catch (e) {
      console.error("[socialAgent] Error en el ciclo:", e.message);
    }
  }, { timezone: "America/Argentina/Buenos_Aires" });

  console.log("📣 [socialAgent] Scheduler iniciado (10:00 y 18:00 ARG)");
}

module.exports = { initSocialScheduler, ejecutarCiclo };
