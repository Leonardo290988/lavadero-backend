import { fechaArgentina } from "../utils/fecha";
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const generarTicketProvisorio = (orden) => {

  const carpeta = path.join(__dirname, "../pdf/provisorios");

  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }

  const archivo = path.join(
    carpeta,
    `orden_${orden.id}_provisorio.pdf`
  );

  const doc = new PDFDocument({
    size: [226, 600],
    margin: 10
  });

  doc.pipe(fs.createWriteStream(archivo));

  doc.fontSize(20).text("LAVADEROS MORENO", { align: "center" });
  doc.moveDown(0.5);

  doc.fontSize(12).text("TICKET PROVISORIO", { align: "center" });
  doc.moveDown();

  doc.fontSize(12);
  doc.text(`Orden: ${orden.id}`);
  doc.text(`Cliente ID: ${orden.cliente_id}`);
  doc.text(`Cliente: ${orden.cliente}`);
  doc.text(`Dirección: ${orden.direccion || "Pendiente"}`);
  doc.text(`Fecha: ${fechaArgentina()}`);

  doc.moveDown();
  doc.text("------------------------");

  doc.text("Servicios:");
  doc.text("Pendientes de carga");

  doc.moveDown();
  doc.text("------------------------");

  if (orden.tiene_envio) {
    doc.text("Incluye ENVÍO a domicilio");
  }

  doc.moveDown();
  doc.fontSize(10).text("Presentar este ticket al ingresar la ropa");

  doc.end();

  return archivo;
};

module.exports = generarTicketProvisorio;