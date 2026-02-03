const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const generarTicketPDF = async (tipo, datos) => {

  const carpeta = path.join(__dirname, "..", "pdf", tipo);

  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }

  const archivo = `resumen_${tipo}.pdf`;
  const rutaArchivo = path.join(carpeta, archivo);

  return new Promise((resolve, reject) => {

    const doc = new PDFDocument({
      size: [226, 600],   // 80mm ticket
      margin: 10
    });

    const stream = fs.createWriteStream(rutaArchivo);
    doc.pipe(stream);

    doc.fontSize(16).text(`Resumen ${tipo}`, { align: "center" });
    doc.moveDown();

    if (datos.periodo) {
      doc.fontSize(12).text(`Periodo: ${datos.periodo}`);
    }

    doc.text(`Efectivo: $${datos.efectivo}`);
    doc.text(`Digital: $${datos.digital}`);
    doc.text(`Gastos: $${datos.gastos}`);
    doc.text(`Guardado: $${datos.guardado}`);
    doc.moveDown();

    doc.fontSize(14).text(`TOTAL VENTAS: $${datos.total}`);
    doc.text(`CAJA FINAL: $${datos.caja}`);

    doc.moveDown();
    doc.fontSize(9).text("Sistema Lavadero");
    doc.text("Resumen generado automáticamente");

    doc.end();

    stream.on("finish", () => resolve(rutaArchivo));
    stream.on("error", reject);

  });
};

module.exports = generarTicketPDF;