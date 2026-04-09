const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const TEL_LAVADERO = "0237 15-555-5555"; // ✏️ Reemplazar con el número real

const generarTicketPDF = async (tipo, datos) => {

  // 📁 Carpeta donde se guardan los PDFs
  const carpeta = path.join(process.cwd(), "src", "pdf", tipo);

  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }

  // 🧾 Nombre del archivo
  const archivo = `resumen_${tipo}_${Date.now()}.pdf`;
  const rutaArchivo = path.join(carpeta, archivo);

  return new Promise((resolve, reject) => {

    const doc = new PDFDocument({
      size: [226, 600],
      margin: 10
    });

    const stream = fs.createWriteStream(rutaArchivo);
    doc.pipe(stream);

    // =============================
    // ENCABEZADO
    // =============================
    doc.fontSize(16).text("LAVADEROS MORENO", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(9).text(`Tel: ${TEL_LAVADERO}`, { align: "center" });
    doc.moveDown(0.5);

    const tituloTipo = {
      turno: "Cierre de Turno",
      diario: "Resumen Diario",
      semanal: "Resumen Semanal",
      mensual: "Resumen Mensual"
    }[tipo] || `Resumen ${tipo.toUpperCase()}`;

    doc.fontSize(13).text(tituloTipo, { align: "center" });
    doc.moveDown(0.5);

    if (datos.periodo) {
      doc.fontSize(10).text(`Período: ${datos.periodo}`, { align: "center" });
    }

    doc.fontSize(9).text(
      `Generado: ${new Date().toLocaleString("es-AR", { hour12: false })}`,
      { align: "center" }
    );

    doc.moveDown();
    doc.text("------------------------------");
    doc.moveDown(0.5);

    // =============================
    // DATOS
    // =============================
    doc.fontSize(11);
    doc.text(`Efectivo:        $${Number(datos.efectivo || 0).toLocaleString("es-AR")}`);
    doc.text(`Digital/MP:      $${Number(datos.digital || 0).toLocaleString("es-AR")}`);
    doc.text(`Gastos:         -$${Number(datos.gastos || 0).toLocaleString("es-AR")}`);
    doc.text(`Guardado:       -$${Number(datos.guardado || 0).toLocaleString("es-AR")}`);

    doc.moveDown(0.5);
    doc.text("------------------------------");
    doc.moveDown(0.5);

    doc.fontSize(13).text(
      `TOTAL VENTAS: $${Number(datos.total || 0).toLocaleString("es-AR")}`,
      { align: "center" }
    );
    doc.moveDown(0.3);
    doc.fontSize(13).text(
      `CAJA FINAL:   $${Number(datos.caja || 0).toLocaleString("es-AR")}`,
      { align: "center" }
    );

    doc.moveDown();
    doc.fontSize(8).text("Sistema Lavadero", { align: "center" });
    doc.fontSize(8).text(`Tel: ${TEL_LAVADERO}`, { align: "center" });

    // ✅ Resolver solo cuando el archivo está completamente escrito
    stream.on("finish", () => resolve(archivo));
    stream.on("error", reject);

    doc.end();
  });
};

module.exports = generarTicketPDF;
