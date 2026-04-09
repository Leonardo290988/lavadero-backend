const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const carpeta = path.join(__dirname, "../pdf/retiros");

const TEL_LAVADERO = "0237 15-555-5555"; // ✏️ Reemplazar con el número real

function generarTicketRetiro({ id, cliente, items, subtotal, senia, total }) {
  return new Promise((resolve, reject) => {

    if (!fs.existsSync(carpeta)) {
      fs.mkdirSync(carpeta, { recursive: true });
    }

    const archivo = path.join(carpeta, `retiro_${id}.pdf`);

    const doc = new PDFDocument({ size: [226, 600], margin: 10 });

    const stream = fs.createWriteStream(archivo);
    doc.pipe(stream);

    // ---- Encabezado ----
    doc.fontSize(14).text("LAVADEROS MORENO", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).text("Ticket de Retiro", { align: "center" });
    doc.fontSize(9).text(`Tel: ${TEL_LAVADERO}`, { align: "center" });
    doc.moveDown();

    doc.fontSize(9);
    doc.text(`Orden: ${id}`);
    doc.text(`Cliente: ${cliente}`);
    doc.text(`Fecha: ${new Date().toLocaleString("es-AR", { hour12: false })}`);

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
    doc.fontSize(8).text(`Tel: ${TEL_LAVADERO}`, { align: "center" });

    // Resolver solo cuando el archivo está completamente escrito
    stream.on("finish", () => resolve(archivo));
    stream.on("error", reject);

    doc.end();
  });
}

module.exports = generarTicketRetiro;
