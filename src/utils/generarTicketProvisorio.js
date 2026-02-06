import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function generarTicketProvisorio(orden) {

  const carpeta = path.join(__dirname, "../pdf/provisorios");

  if (!fs.existsSync(carpeta)) {
    fs.mkdirSync(carpeta, { recursive: true });
  }

  const archivo = path.join(carpeta, `orden_${orden.id}_provisorio.pdf`);

  const doc = new PDFDocument({ size: [226, 600], margin: 10 });
  doc.pipe(fs.createWriteStream(archivo));

  doc.fontSize(20).text("LAVADEROS MORENO", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(12).text("TICKET PROVISORIO", { align: "center" });
  doc.moveDown();

  doc.fontSize(12);
  doc.text(`Orden: ${orden.id}`);
  doc.text(`Cliente: ${orden.cliente}`);
  doc.text(`Fecha: ${fechaArgentina()}`);

  doc.moveDown();
  doc.text("------------------------");
  doc.text("Servicios pendientes");
  doc.text("------------------------");

  if (orden.tiene_envio) {
    doc.text("Incluye ENVÍO a domicilio");
  }

  doc.moveDown();
  doc.fontSize(10).text("Presentar este ticket al ingresar la ropa");

  doc.end();
  return archivo;
}