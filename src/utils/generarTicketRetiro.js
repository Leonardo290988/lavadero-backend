const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const carpeta = path.join(__dirname, "../pdf/retiros");

function generarTicketRetiro({ id, cliente, items, subtotal, senia, total }) {

  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }

  const archivo = path.join(carpeta, `retiro_${id}.pdf`);

  const doc = new PDFDocument({ size: [200, 500], margin: 10 });
  doc.pipe(fs.createWriteStream(archivo));

  doc.fontSize(14).text("LAVADEROS MORENO", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).text("Ticket de Retiro", { align: "center" });
  doc.moveDown();

  doc.fontSize(9);
  doc.text(`Orden: ${id}`);
  doc.text(`Cliente: ${cliente}`);
  doc.text(`Fecha: ${new Date().toLocaleString("es-AR")}`);

  doc.moveDown();
  doc.text("--------------------------");

  items.forEach(i => {
    doc.text(`${i.descripcion} x${i.cantidad}`);
    doc.text(`$${i.precio}`);
  });

  doc.text("--------------------------");

  doc.moveDown();

  doc.text(`SUBTOTAL: $${subtotal}`);

  if (senia > 0) {
    doc.text(`SEÑA: -$${senia}`);
  }

  doc.moveDown();
  doc.fontSize(11).text(`TOTAL A PAGAR: $${total}`, { align: "center" });

  doc.moveDown();
  doc.fontSize(8).text("Gracias por su compra", { align: "center" });

  doc.end();
  return archivo;
}

module.exports = generarTicketRetiro;