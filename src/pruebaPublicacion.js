/**
 * ============================================================
 *  PRUEBA DE PUBLICACIÓN - Lavaderos Moreno
 * ============================================================
 *  Genera una placa de prueba y la publica en Facebook e
 *  Instagram. Sirve para confirmar que todo el circuito anda
 *  ANTES de automatizar con Claude + scheduler.
 *
 *  CÓMO USARLO:
 *   1. Subí estos archivos a tu backend y deploy en Railway
 *      (así la imagen queda accesible en tu URL pública).
 *   2. Desde Railway → servicio backend → pestaña de la consola,
 *      o agregá temporalmente una ruta para dispararlo.
 *
 *  ⚠️ IMPORTANTE: este script NO se puede correr desde tu PC
 *     porque la imagen necesita estar en la URL PÚBLICA del
 *     backend para que Meta la pueda descargar. Tiene que
 *     correr dentro de Railway. Más abajo te explico cómo.
 * ============================================================
 */

const { generarPlaca } = require("./services/imageGenerator");
const { publishFacebook, publishInstagram } = require("./services/metaPublisher");

async function pruebaPublicacion() {
  console.log("🧪 Iniciando prueba de publicación...\n");

  // 1. Generar la placa de prueba
  console.log("⏳ Generando placa...");
  const placa = await generarPlaca({
    etiqueta: "PROMO",
    titular: "3x2 en acolchados",
    bajada: "Llevás 3 y pagás 2 · De martes a viernes",
  });
  console.log("✅ Placa generada:", placa.publicUrl, "\n");

  const texto =
    "¡Aprovechá nuestra promo 3x2 en acolchados! 🛏️\n" +
    "Traé 3 y pagás solo 2, de martes a viernes.\n" +
    "Te esperamos en Lavaderos Moreno.";

  const hashtags = ["#LavaderosMoreno", "#Moreno", "#Lavandería"];

  // 2. Publicar en Facebook
  try {
    console.log("⏳ Publicando en Facebook...");
    const fb = await publishFacebook(placa.publicUrl, texto, hashtags);
    console.log("✅ Facebook OK:", JSON.stringify(fb), "\n");
  } catch (e) {
    console.error("❌ Error Facebook:", e.message, "\n");
  }

  // 3. Publicar en Instagram
  try {
    console.log("⏳ Publicando en Instagram...");
    const ig = await publishInstagram(placa.publicUrl, texto, hashtags);
    console.log("✅ Instagram OK:", JSON.stringify(ig), "\n");
  } catch (e) {
    console.error("❌ Error Instagram:", e.message, "\n");
  }

  console.log("🏁 Prueba finalizada.");
}

pruebaPublicacion();
