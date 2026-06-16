/**
 * ============================================================
 *  PUBLICADOR META - Facebook + Instagram (con imagen)
 *  Lavaderos Moreno
 * ============================================================
 *  Publica una placa (imagen) con texto en ambas redes.
 *
 *  Requiere las variables de entorno en Railway:
 *    META_PAGE_ID
 *    META_IG_USER_ID
 *    META_PAGE_ACCESS_TOKEN
 * ============================================================
 */

const API = "https://graph.facebook.com/v25.0";

const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const PAGE_ID = process.env.META_PAGE_ID;
const IG_USER_ID = process.env.META_IG_USER_ID;

/**
 * Publica una FOTO con texto en Facebook.
 * @param {string} imageUrl - URL pública de la imagen (placa)
 * @param {string} texto - Texto del post
 * @param {string[]} hashtags
 */
async function publishFacebook(imageUrl, texto, hashtags = []) {
  const caption = hashtags.length ? `${texto}\n\n${hashtags.join(" ")}` : texto;

  const res = await fetch(`${API}/${PAGE_ID}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: imageUrl,
      caption,
      access_token: PAGE_TOKEN,
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(`Facebook: ${data.error.message}`);
  }
  return data; // { id, post_id }
}

/**
 * Publica una FOTO con texto en Instagram.
 * Instagram usa un proceso de 2 pasos: crear container y publicarlo.
 * @param {string} imageUrl - URL pública de la imagen (placa)
 * @param {string} texto - Texto del post
 * @param {string[]} hashtags
 */
async function publishInstagram(imageUrl, texto, hashtags = []) {
  const caption = hashtags.length ? `${texto}\n\n${hashtags.join(" ")}` : texto;

  // Paso 1: crear el container con la imagen
  const resContainer = await fetch(`${API}/${IG_USER_ID}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      caption,
      access_token: PAGE_TOKEN,
    }),
  });

  const container = await resContainer.json();
  if (container.error) {
    throw new Error(`Instagram (container): ${container.error.message}`);
  }

  // Pausa breve: a veces IG necesita un instante para procesar la imagen
  await new Promise((r) => setTimeout(r, 3000));

  // Paso 2: publicar el container
  const resPublish = await fetch(`${API}/${IG_USER_ID}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: container.id,
      access_token: PAGE_TOKEN,
    }),
  });

  const publish = await resPublish.json();
  if (publish.error) {
    throw new Error(`Instagram (publish): ${publish.error.message}`);
  }
  return publish; // { id }
}

module.exports = { publishFacebook, publishInstagram };
