const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const carpeta = path.join(__dirname, "../pdf/ordenes");

const TEL_LAVADERO = "1122527099"; // ✏️ Reemplazar con el número real

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
  return new Promise((resolve, reject) => {

    if (!fs.existsSync(carpeta)) {
      fs.mkdirSync(carpeta, { recursive: true });
    }

    const archivo = path.join(carpeta, `orden_${id}.pdf`);

    const doc = new PDFDocument({
      size: [226, 600],
      margin: 10
    });

    const stream = fs.createWriteStream(archivo);
    doc.pipe(stream);

    // ---- Encabezado ----
    doc.fontSize(20).text("LAVADEROS MORENO", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).text("Ticket de Ingreso", { align: "center" });
    doc.fontSize(9).text(`Tel: ${TEL_LAVADERO}`, { align: "center" });
    doc.moveDown();

    doc.fontSize(28).text(`ORDEN N° ${id}`, { align: "center" });
    doc.moveDown(0.5);

    doc.fontSize(11);
    doc.text(`Cliente: ${cliente}`);
    doc.text(`Tel cliente: ${telefono || "-"}`);
    doc.text(`Fecha: ${new Date().toLocaleString("es-AR", { hour12: false })}`);

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
    doc.fontSize(9).text(`Tel: ${TEL_LAVADERO}`, { align: "center" });

    // Resolver la Promise solo cuando el archivo está completamente escrito
    stream.on("finish", () => resolve(archivo));
    stream.on("error", reject);

    doc.end();
  });
}

module.exports = generarTicketOrden;
