const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const carpeta = path.join(__dirname, "../pdf/ordenes");

function generarTicketRopa({ id, cliente, notas }) {
  return new Promise((resolve, reject) => {

    if (!fs.existsSync(carpeta)) {
      fs.mkdirSync(carpeta, { recursive: true });
    }

    const archivo = path.join(carpeta, `ropa_${id}.pdf`);

    // Ticket pequeño — mismo ancho que los otros
    // La altura se ajusta según si hay nota o no
    const tieneNota = notas && notas.trim().length > 0;
    const alto = tieneNota ? 240 : 160;
    const doc = new PDFDocument({ size: [226, alto], margin: 10 });

    const stream = fs.createWriteStream(archivo);
    doc.pipe(stream);

    doc.fontSize(13).text("LAVADEROS MORENO", { align: "center" });
    doc.moveDown(0.5);

    // Número de orden bien grande
    doc.fontSize(48).font("Helvetica-Bold").text(`#${id}`, { align: "center" });
    doc.font("Helvetica");

    doc.moveDown(0.3);
    doc.fontSize(14).text(cliente, { align: "center" });

    // ---- Nota de la orden (si existe) ----
    if (tieneNota) {
      doc.moveDown(0.5);
      doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke();
      doc.moveDown(0.4);
      doc.fontSize(11).font("Helvetica-Bold").text("NOTA:", { align: "center" });
      doc.font("Helvetica");
      doc.fontSize(11).text(notas.trim(), { align: "center", width: 206 });
    }

    stream.on("finish", () => resolve(archivo));
    stream.on("error", reject);

    doc.end();
  });
}

module.exports = generarTicketRopa;
