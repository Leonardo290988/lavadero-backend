const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const generarTicketPDF = async (tipo, datos) => {

  // 📁 Carpeta donde se guardan PDFs
  const carpeta = path.join(process.cwd(), "src", "pdf", tipo);

  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }

  // 🧾 Nombre del archivo
  const archivo = `resumen_${tipo}_${Date.now()}.pdf`;

  // 📍 Ruta completa solo para guardar
  const rutaArchivo = path.join(carpeta, archivo);

  return new Promise((resolve, reject) => {

    const doc = new PDFDocument({
      size: [226, 600],
      margin: 10
    });

    const stream = fs.createWriteStream(rutaArchivo);
    doc.pipe(stream);

    // =============================
    // CONTENIDO PDF
    // =============================
    doc.fontSize(16).text(`Resumen ${tipo.toUpperCase()}`, { align: "center" });
    doc.moveDown();

    if (datos.periodo) {
      doc.fontSize(11).text(`Periodo: ${datos.periodo}`);
      doc.moveDown(0.5);
    }

    doc.fontSize(12).text(`Efectivo: $${datos.efectivo}`);
    doc.text(`Digital: $${datos.digital}`);
    doc.text(`Gastos: $${datos.gastos}`);
    doc.text(`Guardado: $${datos.guardado}`);

    doc.moveDown();
    doc.fontSize(13).text(`TOTAL VENTAS: $${datos.total}`);
    doc.text(`CAJA FINAL: $${datos.caja}`);

    doc.moveDown();
    doc.fontSize(9).text("Sistema Lavadero");
    doc.text("Resumen generado automáticamente");

    doc.end();

    // ✅ DEVOLVER SOLO NOMBRE
    stream.on("finish", () => resolve(archivo));
    stream.on("error", reject);

  });
};

module.exports = generarTicketPDF;