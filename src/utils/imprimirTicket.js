const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;

async function imprimirTicket(datos) {
  try {

    const printer = new ThermalPrinter({
      type: PrinterTypes.GENERIC,
      interface: "printer:POS80",
      options: {
        timeout: 5000
      }
    });

    console.log("🖨 Probando impresora...");
    const isConnected = await printer.isPrinterConnected();
    console.log("Conectada:", isConnected);

    if (!isConnected) {
      console.log("❌ Impresora no conectada");
      return false;
    }

    // =========================
    // ENCABEZADO
    // =========================
    printer.alignCenter();
    printer.setTextDoubleHeight();
    printer.println("LAVADEROS MORENO");
    printer.setTextNormal();
    printer.println("----------------------------");

    // =========================
    // DATOS CLIENTE
    // =========================
    printer.alignLeft();
    printer.println(`Orden: ${datos.id}`);
    printer.println(`Cliente: ${datos.cliente}`);
    printer.println(`Ingreso: ${datos.fecha_ingreso}`);
    printer.println(`Retiro: ${datos.fecha_retiro}`);
    printer.println("----------------------------");

    // =========================
    // SERVICIOS
    // =========================
    printer.println("Servicios:");

    datos.servicios.forEach(s => {
      printer.println(`- ${s.nombre}  $${s.precio}`);
    });

    printer.println("----------------------------");

    // =========================
    // TOTALES
    // =========================
    printer.println(`TOTAL: $${datos.total}`);
    printer.println(`SEÑA: $${datos.senia}`);
    printer.println(`SALDO: $${datos.total - datos.senia}`);

    printer.println("----------------------------");
    printer.println("Gracias por su confianza");

    // =========================
    // CORTE
    // =========================
    printer.cut();

    await printer.execute();

    console.log("✅ Ticket impreso correctamente");
    return true;

  } catch (error) {
    console.error("🔥 Error imprimiendo:", error.message);
    return false;
  }
}

module.exports = imprimirTicket;