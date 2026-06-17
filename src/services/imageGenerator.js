/**
 * ============================================================
 *  GENERADOR DE PLACAS - Lavaderos Moreno
 * ============================================================
 *  Genera una imagen 1080x1080 (cuadrada, ideal para FB e IG)
 *  con el logo, los colores de marca y el texto de la promo.
 *
 *  Devuelve la ruta del archivo y la URL pública para pasarle
 *  a Facebook e Instagram.
 *
 *  DEPENDENCIAS (instalar en el backend):
 *    npm install @napi-rs/canvas
 *
 *  ASSETS NECESARIOS (ver instrucciones al final del chat):
 *    - assets/fonts/Montserrat-Bold.ttf
 *    - assets/fonts/Montserrat-Regular.ttf
 *    - assets/logo.png   (opcional, pero recomendado)
 * ============================================================
 */

const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

// ---- Paleta de marca (azul / rojo / oscuro) ----
const COLORS = {
  bgTop: '#0E1A2B',      // azul muy oscuro (arriba)
  bgBottom: '#16263F',   // azul oscuro (abajo)
  red: '#E23B3B',        // rojo de acento
  white: '#FFFFFF',
  soft: '#AEBDD0',       // gris azulado para subtítulos
};

// ---- Registrar fuentes (deben existir en assets/fonts) ----
const FONTS_DIR = path.join(__dirname, '..', 'assets', 'fonts');
try {
  GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Montserrat-Bold.ttf'), 'Montserrat-Bold');
  GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'Montserrat-Regular.ttf'), 'Montserrat-Reg');
} catch (e) {
  console.warn('[imageGenerator] No se pudieron cargar las fuentes. Revisá assets/fonts/.', e.message);
}

// Carpeta donde se guardan las placas generadas (pública)
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'generated');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const SIZE = 1080;

/**
 * Parte un texto en líneas que entren en maxWidth.
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Genera la placa.
 * @param {Object} opts
 * @param {string} opts.titular   - Texto principal grande (ej: "3x2 en acolchados")
 * @param {string} [opts.bajada]  - Texto secundario (ej: "Martes a Viernes")
 * @param {string} [opts.etiqueta]- Texto del pill rojo arriba (ej: "PROMO")
 * @returns {Promise<{filePath: string, publicUrl: string, fileName: string}>}
 */
async function generarPlaca({ titular, bajada = '', etiqueta = '' }) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  // ---- Fondo con degradado ----
  const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
  grad.addColorStop(0, COLORS.bgTop);
  grad.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ---- Acento rojo: barra diagonal sutil arriba a la derecha ----
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = COLORS.red;
  ctx.beginPath();
  ctx.moveTo(SIZE, 0);
  ctx.lineTo(SIZE, 320);
  ctx.lineTo(SIZE - 420, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ---- Logo (si existe) ----
  const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
  let topY = 150;
  if (fs.existsSync(logoPath)) {
    try {
      const logo = await loadImage(logoPath);
      const logoW = 200;
      const logoH = (logo.height / logo.width) * logoW;
      ctx.drawImage(logo, (SIZE - logoW) / 2, 110, logoW, logoH);
      topY = 110 + logoH + 60;
    } catch (e) {
      console.warn('[imageGenerator] No se pudo cargar el logo:', e.message);
    }
  } else {
    // Sin logo: nombre de marca en texto
    ctx.fillStyle = COLORS.white;
    ctx.font = '54px Montserrat-Bold';
    ctx.textAlign = 'center';
    ctx.fillText('LAVADEROS MORENO', SIZE / 2, 180);
    topY = 250;
  }

  // ---- Pill de etiqueta (ej: "PROMO") ----
  if (etiqueta) {
    ctx.font = '34px Montserrat-Bold';
    const txt = etiqueta.toUpperCase();
    const pad = 36;
    const w = ctx.measureText(txt).width + pad * 2;
    const h = 70;
    const x = (SIZE - w) / 2;
    const y = topY;
    ctx.fillStyle = COLORS.red;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 35);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, w, h);
    }
    ctx.fillStyle = COLORS.white;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, SIZE / 2, y + h / 2 + 2);
    ctx.textBaseline = 'alphabetic';
    topY = y + h + 70;
  }

  // ---- Titular (grande, centrado, auto-ajusta tamaño) ----
  ctx.fillStyle = COLORS.white;
  ctx.textAlign = 'center';
  const maxWidth = SIZE - 160;

  // Ajuste de tamaño: empezamos grande y bajamos si hay muchas líneas
  let fontSize = 96;
  let lines = [];
  while (fontSize >= 52) {
    ctx.font = `${fontSize}px Montserrat-Bold`;
    lines = wrapText(ctx, titular, maxWidth);
    if (lines.length <= 4) break;
    fontSize -= 6;
  }

  const lineHeight = fontSize * 1.12;
  const blockHeight = lines.length * lineHeight;
  let y = (SIZE / 2) - (blockHeight / 2) + fontSize / 2 + 40;
  for (const line of lines) {
    ctx.fillText(line, SIZE / 2, y);
    y += lineHeight;
  }

  // ---- Subrayado rojo debajo del titular ----
  ctx.fillStyle = COLORS.red;
  const underlineW = 140;
  ctx.fillRect((SIZE - underlineW) / 2, y, underlineW, 8);
  y += 60;

  // ---- Bajada (texto secundario) ----
  if (bajada) {
    ctx.fillStyle = COLORS.soft;
    ctx.font = '44px Montserrat-Reg';
    const bajadaLines = wrapText(ctx, bajada, maxWidth);
    for (const line of bajadaLines) {
      ctx.fillText(line, SIZE / 2, y);
      y += 56;
    }
  }

  // ---- Barra inferior con el @ ----
  ctx.fillStyle = COLORS.red;
  ctx.fillRect(0, SIZE - 90, SIZE, 90);
  ctx.fillStyle = COLORS.white;
  ctx.font = '40px Montserrat-Bold';
  ctx.textBaseline = 'middle';
  ctx.fillText('@lavaderos.moreno', SIZE / 2, SIZE - 45);
  ctx.textBaseline = 'alphabetic';

  // ---- Guardar archivo ----
  const fileName = `placa-${Date.now()}.png`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  const buffer = await canvas.encode('png');
  fs.writeFileSync(filePath, buffer);

  // URL pública (BASE_PUBLIC_URL debe ser la URL de tu backend en Railway)
  const base = process.env.BASE_PUBLIC_URL || '';
  const publicUrl = `${base}/generated/${fileName}`;

  return { filePath, publicUrl, fileName };
}

// Carpeta de fotos de fondo para el estilo "foto + frase" (opcional)
const BG_DIR = path.join(__dirname, '..', 'assets', 'backgrounds');

/**
 * Elige una foto de fondo al azar de assets/backgrounds/.
 * Devuelve null si no hay ninguna (entonces se usa fondo de marca).
 */
function elegirFondoAzar() {
  try {
    if (!fs.existsSync(BG_DIR)) return null;
    const fotos = fs.readdirSync(BG_DIR).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
    if (fotos.length === 0) return null;
    return path.join(BG_DIR, fotos[Math.floor(Math.random() * fotos.length)]);
  } catch {
    return null;
  }
}

/**
 * Genera una imagen estilo "foto + frase emocional".
 * Si hay fotos en assets/backgrounds/ usa una al azar; si no, usa
 * un fondo de marca con degradado (igual queda prolijo).
 *
 * @param {Object} opts
 * @param {string} opts.frase   - Frase principal (ej: "Llegás cansado... y todavía te espera la ropa")
 * @param {string} [opts.bajada]- Texto secundario (ej: "Nosotros nos encargamos por vos")
 * @returns {Promise<{filePath, publicUrl, fileName}>}
 */
async function generarFotoFrase({ frase, bajada = '' }) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  // ---- Fondo: foto al azar o degradado de marca ----
  const fondoPath = elegirFondoAzar();
  if (fondoPath) {
    try {
      const img = await loadImage(fondoPath);
      // "cover": escalar para llenar 1080x1080 y centrar
      const escala = Math.max(SIZE / img.width, SIZE / img.height);
      const w = img.width * escala;
      const h = img.height * escala;
      ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
    } catch {
      // si falla, degradado
      const g = ctx.createLinearGradient(0, 0, 0, SIZE);
      g.addColorStop(0, COLORS.bgTop); g.addColorStop(1, COLORS.bgBottom);
      ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
    }
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, SIZE);
    g.addColorStop(0, COLORS.bgTop); g.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // ---- Scrim oscuro para que el texto se lea sobre cualquier foto ----
  const scrim = ctx.createLinearGradient(0, 0, 0, SIZE);
  scrim.addColorStop(0, 'rgba(10,18,30,0.78)');
  scrim.addColorStop(0.45, 'rgba(10,18,30,0.45)');
  scrim.addColorStop(1, 'rgba(10,18,30,0.85)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ---- Frase principal (arriba) ----
  ctx.fillStyle = COLORS.white;
  ctx.textAlign = 'left';
  const maxWidth = SIZE - 140;
  let fontSize = 82;
  let lines = [];
  while (fontSize >= 48) {
    ctx.font = `${fontSize}px Montserrat-Bold`;
    lines = wrapText(ctx, frase, maxWidth);
    if (lines.length <= 5) break;
    fontSize -= 5;
  }
  const lineHeight = fontSize * 1.15;
  let y = 150;
  // sombra suave para legibilidad
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 16;
  for (const line of lines) {
    ctx.fillText(line, 70, y);
    y += lineHeight;
  }
  ctx.shadowBlur = 0;

  // Acento rojo
  ctx.fillStyle = COLORS.red;
  ctx.fillRect(70, y + 6, 120, 9);
  y += 70;

  // ---- Bajada ----
  if (bajada) {
    ctx.fillStyle = '#E8EEF6';
    ctx.font = '40px Montserrat-Reg';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 12;
    for (const line of wrapText(ctx, bajada, maxWidth)) {
      ctx.fillText(line, 70, y);
      y += 52;
    }
    ctx.shadowBlur = 0;
  }

  // ---- Logo abajo a la izquierda ----
  const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
  if (fs.existsSync(logoPath)) {
    try {
      const logo = await loadImage(logoPath);
      const logoW = 230;
      const logoH = (logo.height / logo.width) * logoW;
      ctx.drawImage(logo, 70, SIZE - logoH - 60, logoW, logoH);
    } catch { /* sin logo */ }
  }

  // ---- Guardar ----
  const fileName = `frase-${Date.now()}.png`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, await canvas.encode('png'));
  const base = process.env.BASE_PUBLIC_URL || '';
  return { filePath, publicUrl: `${base}/generated/${fileName}`, fileName };
}

/**
 * Borra placas viejas (más de 1 hora) para no acumular archivos.
 * Las imágenes solo necesitan vivir hasta que Meta las descarga.
 */
function limpiarPlacasViejas() {
  try {
    const ahora = Date.now();
    for (const f of fs.readdirSync(OUTPUT_DIR)) {
      const fp = path.join(OUTPUT_DIR, f);
      const edad = ahora - fs.statSync(fp).mtimeMs;
      if (edad > 60 * 60 * 1000) fs.unlinkSync(fp); // 1 hora
    }
  } catch (e) {
    console.warn('[imageGenerator] Error limpiando placas:', e.message);
  }
}

module.exports = { generarPlaca, generarFotoFrase, limpiarPlacasViejas };
