const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const carpeta = path.join(__dirname, "../pdf/provisorios");

const generarTicketProvisorio = async ({
  id,
  cliente,
  telefono,
  direccion,
  tiene_envio
}) => {

  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }

  const nombreArchivo = `retiro_${id}.pdf`;
  const rutaArchivo = path.join(carpeta, nombreArchivo);

  const doc = new PDFDocument({
    size: [226, 600],
    margin: 10
  });

  doc.pipe(fs.createWriteStream(rutaArchivo));

  doc.fontSize(16).text("LAVADEROS MORENO", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(11).text("Ticket Provisorio", { align: "center" });
  doc.moveDown();

  doc.text(`Orden: ${id}`);
  doc.text(`Cliente: ${cliente}`);
  doc.text(`Telefono: ${telefono || "-"}`)
  doc.text(`Dirección: ${direccion}`);
  doc.text(`Fecha: ${new Date().toLocaleString("es-AR", { hour12:false })}`);

  if (tiene_envio) {
    doc.moveDown();
    doc.text("Incluye envío a domicilio");
  }

  doc.end();

  return nombreArchivo; // 👈 SOLO DEVOLVEMOS EL NOMBRE
};

module.exports = generarTicketProvisorio;