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

module.exports = { generarPlaca, limpiarPlacasViejas };
