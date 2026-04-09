const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const carpeta = path.join(__dirname, "../pdf/provisorios");

const TEL_LAVADERO = "0237 15-555-5555"; // ✏️ Reemplazar con el número real

const generarTicketProvisorio = ({
  id,
  cliente,
  telefono,
  direccion,
  tiene_envio
}) => {
  return new Promise((resolve, reject) => {

    if (!fs.existsSync(carpeta)) {
      fs.mkdirSync(carpeta, { recursive: true });
    }

    const nombreArchivo = `retiro_${id}.pdf`;
    const rutaArchivo = path.join(carpeta, nombreArchivo);

    const doc = new PDFDocument({
      size: [226, 600],
      margin: 10
    });

    const stream = fs.createWriteStream(rutaArchivo);
    doc.pipe(stream);

    doc.fontSize(16).text("LAVADEROS MORENO", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(11).text("Ticket Provisorio", { align: "center" });
    doc.fontSize(9).text(`Tel: ${TEL_LAVADERO}`, { align: "center" });
    doc.moveDown();

    doc.fontSize(10);
    doc.text(`Retiro N°: ${id}`);
    doc.text(`Cliente: ${cliente}`);
    doc.text(`Telefono: ${telefono || "-"}`);
    doc.text(`Dirección: ${direccion}`);
    doc.text(`Fecha: ${new Date().toLocaleString("es-AR", { hour12: false })}`);

    if (tiene_envio) {
      doc.moveDown();
      doc.text("Incluye envío a domicilio");
    }

    doc.moveDown();
    doc.fontSize(8).text(`Tel lavadero: ${TEL_LAVADERO}`, { align: "center" });

    stream.on("finish", () => resolve(nombreArchivo));
    stream.on("error", reject);

    doc.end();
  });
};

module.exports = generarTicketProvisorio;
