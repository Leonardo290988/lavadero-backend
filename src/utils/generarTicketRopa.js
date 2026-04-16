const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const carpeta = path.join(__dirname, "../pdf/ordenes");

function generarTicketRopa({ id, cliente }) {
  return new Promise((resolve, reject) => {

    if (!fs.existsSync(carpeta)) {
      fs.mkdirSync(carpeta, { recursive: true });
    }

    const archivo = path.join(carpeta, `ropa_${id}.pdf`);

    // Ticket pequeño — mismo ancho que los otros
    const doc = new PDFDocument({ size: [226, 160], margin: 10 });

    const stream = fs.createWriteStream(archivo);
    doc.pipe(stream);

    doc.fontSize(13).text("LAVADEROS MORENO", { align: "center" });
    doc.moveDown(0.5);

    // Número de orden bien grande
    doc.fontSize(48).font("Helvetica-Bold").text(`#${id}`, { align: "center" });
    doc.font("Helvetica");

    doc.moveDown(0.3);
    doc.fontSize(14).text(cliente, { align: "center" });

    stream.on("finish", () => resolve(archivo));
    stream.on("error", reject);

    doc.end();
  });
}

module.exports = generarTicketRopa;
