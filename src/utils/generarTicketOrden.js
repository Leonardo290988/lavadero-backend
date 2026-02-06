const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const carpeta = path.join(__dirname, "../pdf/ordenes");

function generarTicketOrden({ 
  id,
  cliente_id,
  cliente,
  telefono,
  items,
  subtotal,
  promoDescuento,
  senia,
  total,
  tiene_envio
}) {

  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }

  const archivo = path.join(carpeta, `orden_${id}.pdf`);

  const doc = new PDFDocument({
    size: [226, 600],
    margin: 10
  });

  doc.pipe(fs.createWriteStream(archivo));

  doc.fontSize(20).text("LAVADEROS MORENO", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(10).text("Ticket de Ingreso", { align: "center" });
  doc.moveDown();

  doc.fontSize(11);
  doc.text(`Orden N°: ${id}`);
  doc.text(`Cliente: ${cliente}`);
  doc.text(`Tel: ${telefono || "-"}`);
  doc.text(`Fecha: ${new Date().toLocaleString("es-AR", { hour12: false})}`);

  doc.moveDown();
  doc.text("--------------------------------");

  items.forEach(i => {
    doc.text(`${i.descripcion} x${i.cantidad}`);
    doc.text(`$${i.precio}`);
  });

  doc.text("--------------------------------");
  doc.moveDown();

  doc.text(`SUBTOTAL: $${subtotal}`);

  if (promoDescuento > 0) {
  doc.text(`DESCUENTO PROMO: -$${promoDescuento}`);
}

  if (senia > 0) {
    doc.text(`SEÑA: -$${senia}`);
  }

  doc.moveDown();
  doc.fontSize(14).text(`TOTAL: $${total}`, { align: "right" });

  if (tiene_envio) {
    doc.moveDown();
    doc.fontSize(10).text("Incluye ENVÍO a domicilio", { align: "center" });
  }

  doc.moveDown();
  doc.fontSize(9).text("Gracias por su compra", { align: "center" });
  doc.fontSize(9).text("Conserve este comprobante", { align: "center" });

  doc.end();

  return archivo;
}

module.exports = generarTicketOrden;