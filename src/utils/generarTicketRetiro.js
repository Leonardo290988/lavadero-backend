const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const generarTicketRetiro = (orden) => {

  const carpeta = path.join(__dirname, "../../pdf/retiros");

  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }

  const archivo = path.join(
    carpeta,
    `retiro_${orden.id}.pdf`
  );

  const doc = new PDFDocument({
    size: [226, 600],
    margin: 10
  });

  doc.pipe(fs.createWriteStream(archivo));

  // ENCABEZADO
  doc.fontSize(20).text("LAVADEROS MORENO", { align: "center" });
  doc.moveDown();

  doc.fontSize(14);
  doc.text(`RETIRO DE ORDEN`);
  doc.text(`Orden #${orden.id}`);
  doc.text(`Cliente: ${orden.cliente}`);
  doc.text(`Fecha: ${new Date().toLocaleString("es-AR")}`);
  doc.moveDown();

  // SERVICIOS
  orden.items.forEach(i => {
    doc.text(`${i.descripcion} x${i.cantidad} - $${i.precio}`);
  });

  doc.moveDown();
  doc.fontSize(16).text(`TOTAL: $${orden.total}`);

  doc.moveDown();
  doc.fontSize(12).text("Gracias por su compra");

  doc.end();

  return archivo;
};

module.exports = generarTicketRetiro;