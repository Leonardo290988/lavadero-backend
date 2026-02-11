const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const carpeta = path.join(__dirname, "../pdf/retiros");

function generarTicketProvisorio({ id, cliente, direccion, tiene_envio }) {

  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }

  const archivo = path.join(carpeta, `retiro_${id}.pdf`);

  const doc = new PDFDocument({
    size: [226, 400],
    margin: 10
  });

  doc.pipe(fs.createWriteStream(archivo));

  doc.fontSize(16).text("LAVADEROS MORENO", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(10).text("Ticket Provisorio de Retiro", { align: "center" });
  doc.moveDown();

  doc.fontSize(11);
  doc.text(`Orden N°: ${id}`);
  doc.text(`Cliente: ${cliente}`);
  doc.text(`Dirección: ${direccion}`);
  doc.text(`Fecha: ${new Date().toLocaleString("es-AR", { hour12: false })}`);

  if (tiene_envio) {
    doc.moveDown();
    doc.text("Incluye ENVÍO a domicilio");
  }

  doc.moveDown();
  doc.fontSize(9).text("Ticket generado automáticamente", { align: "center" });

  doc.end();

  return archivo;
}

module.exports = generarTicketProvisorio;