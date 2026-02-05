import { fechaArgentina } from "../utils/fecha";
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const generarTicketOrden = async (orden) => {

  const carpeta = path.join(__dirname, "../pdf/ordenes");

  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }

  const archivo = path.join(
    carpeta,
    `orden_${orden.id}.pdf`
  );

  const doc = new PDFDocument({
    size: [226, 600],
    margin: 10
  });

  doc.pipe(fs.createWriteStream(archivo));

  // ===== ENCABEZADO =====
  doc.fontSize(22).text("LAVADEROS MORENO", { align: "center" });
  doc.moveDown(0.3);

  doc.fontSize(10).text("Servicio de Lavado", { align: "center" });
  doc.moveDown();

  // ===== DATOS ORDEN =====
  doc.fontSize(12);
  doc.text(`Orden N°: ${orden.id}`);
  doc.text(`Cliente ID: ${orden.cliente_id}`);
  doc.text(`Cliente: ${orden.cliente}`);
  doc.text(`Tel: ${orden.telefono || "-"}`);
  doc.text(`Fecha: ${fechaArgentina()}`);

  doc.moveDown();

  // ===== LINEA =====
  doc.text("--------------------------------");

  // ===== ITEMS =====
  orden.items.forEach(i => {
    doc.fontSize(12).text(`${i.descripcion}`);
    doc.text(`   $${i.precio}`);
  });

  doc.moveDown();
  doc.text("--------------------------------");

  // ===== TOTAL =====
  doc.fontSize(16).text(`TOTAL: $${orden.total}`, { align: "right" });

  doc.moveDown();

  // ===== ENVIO =====
  if (orden.tiene_envio === true) {
    doc.fontSize(11).text("Incluye ENVÍO a domicilio", { align: "center" });
    doc.moveDown();
  }

  // ===== PIE =====
  doc.fontSize(11).text("Gracias por su compra", { align: "center" });
  doc.fontSize(10).text("Conserve este comprobante", { align: "center" });

  doc.end();

  return archivo;
};

module.exports = generarTicketOrden;