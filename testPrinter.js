const { ThermalPrinter, PrinterTypes } = require("node-thermal-printer");

const printer = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: "\\\\localhost\\POS-80C"
});

async function test() {
  const ok = await printer.isPrinterConnected();
  console.log("Conectada:", ok);

  printer.println("PRUEBA DE IMPRESION OK");
  printer.cut();
  await printer.execute();
}

test();