/**
 * ============================================================
 *  SCHEDULER DEL AGENTE SOCIAL — con APROBACIÓN
 *  Lavaderos Moreno
 * ============================================================
 *  Flujo nuevo:
 *   1. El agente decide y genera la publicación (texto + imagen)
 *   2. NO publica: la guarda como PENDIENTE
 *   3. Vos la revisás en el panel web y decidís:
 *        - Publicar  -> sale en FB e IG
 *        - Otra imagen -> regenera con la búsqueda que le digas
 *        - Descartar -> no se publica
 *
 *  Tablas: social_posts (historial) y posts_pendientes (cola)
 * ============================================================
 */

const cron = require("node-cron");
const pool = require("../db");
const { decidirYGenerar } = require("../services/socialAgent");
const { generarPlaca, generarFotoFrase, limpiarPlacasViejas } = require("../services/imageGenerator");
const { publishFacebook, publishInstagram } = require("../services/metaPublisher");

// ---- Crear tablas (patrón de db.js) ----
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
`).catch(err => console.error("Error creando social_posts:", err.message));

pool.query(`
  CREATE TABLE IF NOT EXISTS posts_pendientes (
    id SERIAL PRIMARY KEY,
    modo VARCHAR(20),
    titular TEXT,
    caption TEXT,
    hashtags TEXT,
    busqueda TEXT,
    image_url TEXT,
    decision JSONB,
    estado VARCHAR(20) DEFAULT 'pendiente',
    creado_en TIMESTAMP DEFAULT NOW()
  )
`).catch(err => console.error("Error creando posts_pendientes:", err.message));

// Generar la imagen según la decisión
async function generarImagen(decision) {
  if (decision.modo === "frase" && decision.frase) {
    return await generarFotoFrase({
      frase: decision.frase.frase,
      bajada: decision.frase.bajada,
      busqueda: decision.frase.busqueda,
    });
  }
  return await generarPlaca({
    etiqueta: decision.placa?.etiqueta || "PROMO",
    titular: decision.placa?.titular || "",
    bajada: decision.placa?.bajada || "",
  });
}

// Ciclo: decide, genera y deja PENDIENTE (no publica)
async function ejecutarCiclo() {
  console.log("[socialAgent] Evaluando si proponer publicación...");
  limpiarPlacasViejas();

  const decision = await decidirYGenerar();
  if (!decision.shouldPost) {
    console.log("[socialAgent] Decidió NO proponer:", decision.razon);
    return { propuesto: false, razon: decision.razon };
  }

  const imagen = await generarImagen(decision);
  const titular = decision.modo === "frase"
    ? (decision.frase?.frase || "")
    : (decision.placa?.titular || "");
  const busqueda = decision.modo === "frase" ? (decision.frase?.busqueda || "") : "";

  const r = await pool.query(
    `INSERT INTO posts_pendientes (modo, titular, caption, hashtags, busqueda, image_url, decision, estado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pendiente') RETURNING id`,
    [
      decision.modo,
      titular,
      decision.caption || "",
      JSON.stringify(decision.hashtags || []),
      busqueda,
      imagen.publicUrl,
      JSON.stringify(decision),
    ]
  );

  console.log(`[socialAgent] Propuesta #${r.rows[0].id} lista para revisar (${decision.modo}).`);
  return { propuesto: true, id: r.rows[0].id, modo: decision.modo, imagen: imagen.publicUrl, razon: decision.razon };
}

// Listar / publicar / regenerar / descartar (las usa el panel)
async function listarPendientes() {
  const r = await pool.query(
    `SELECT id, modo, titular, caption, hashtags, busqueda, image_url, creado_en
     FROM posts_pendientes WHERE estado='pendiente' ORDER BY creado_en DESC`
  );
  return r.rows.map(row => ({ ...row, hashtags: safeParse(row.hashtags) }));
}

async function publicarPendiente(id) {
  const r = await pool.query(`SELECT * FROM posts_pendientes WHERE id=$1 AND estado='pendiente'`, [id]);
  if (r.rows.length === 0) throw new Error("No existe esa propuesta pendiente.");
  const p = r.rows[0];
  const hashtags = safeParse(p.hashtags) || [];
  const resultado = { id, publicado: true };

  try {
    const fb = await publishFacebook(p.image_url, p.caption, hashtags);
    await registrarPost(p.modo, p.titular, p.caption, "facebook", fb.id || fb.post_id, p.image_url);
    resultado.facebook = fb.id || fb.post_id;
  } catch (e) {
    resultado.facebook_error = e.message;
  }

  try {
    const ig = await publishInstagram(p.image_url, p.caption, hashtags);
    await registrarPost(p.modo, p.titular, p.caption, "instagram", ig.id, p.image_url);
    resultado.instagram = ig.id;
  } catch (e) {
    resultado.instagram_error = e.message;
  }

  await pool.query(`UPDATE posts_pendientes SET estado='publicado' WHERE id=$1`, [id]);
  return resultado;
}

async function regenerarImagen(id, nuevaBusqueda) {
  const r = await pool.query(`SELECT * FROM posts_pendientes WHERE id=$1 AND estado='pendiente'`, [id]);
  if (r.rows.length === 0) throw new Error("No existe esa propuesta pendiente.");
  const p = r.rows[0];

  const frase = p.titular || (p.caption ? p.caption.split("\n")[0] : "Lavaderos Moreno");
  const decision = safeParse(p.decision) || {};
  const bajada = decision && decision.frase ? (decision.frase.bajada || "") : "";

  const imagen = await generarFotoFrase({ frase, bajada, busqueda: nuevaBusqueda });

  await pool.query(
    `UPDATE posts_pendientes SET image_url=$1, busqueda=$2, modo='frase' WHERE id=$3`,
    [imagen.publicUrl, nuevaBusqueda, id]
  );
  return { id, image_url: imagen.publicUrl, busqueda: nuevaBusqueda };
}

async function descartarPendiente(id) {
  await pool.query(`UPDATE posts_pendientes SET estado='descartado' WHERE id=$1`, [id]);
  return { id, descartado: true };
}

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

function safeParse(v) {
  if (!v) return null;
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return null; }
}

// Cron: genera propuestas a las 10:00 y 18:00 (Argentina)
function initSocialScheduler() {
  cron.schedule("0 10,18 * * *", async () => {
    try {
      await ejecutarCiclo();
    } catch (e) {
      console.error("[socialAgent] Error en el ciclo:", e.message);
    }
  }, { timezone: "America/Argentina/Buenos_Aires" });

  console.log("[socialAgent] Scheduler iniciado - genera propuestas a las 10:00 y 18:00 ARG (requieren tu aprobacion)");
}

module.exports = {
  initSocialScheduler,
  ejecutarCiclo,
  listarPendientes,
  publicarPendiente,
  regenerarImagen,
  descartarPendiente,
};
