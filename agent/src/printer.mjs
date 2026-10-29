import { appendFile } from "node:fs/promises";
import net from "node:net";

/**
 * Sends ZPL to the label printer.
 *   PRINTER=tcp://192.168.1.50:9100   network Zebra printer (raw port 9100)
 *   PRINTER=file:./labels.zpl          append to a file (testing)
 *   PRINTER=none                       printing switched off
 * For a USB printer, share it on the PC or use the Zebra driver's raw TCP port.
 */
export async function sendToPrinter(printer, zpl) {
  if (!printer || printer === "none") throw new PrinterError("No label printer is set up on this PC (PRINTER=none).", 503);
  if (printer.startsWith("file:")) {
    await appendFile(printer.slice(5), zpl);
    return;
  }
  const m = printer.match(/^tcp:\/\/([^:/]+)(?::(\d+))?$/);
  if (!m) throw new PrinterError(`PRINTER setting not understood: ${printer}`, 500);
  const [, host, port = "9100"] = m;
  await new Promise((resolve, reject) => {
    const socket = net.connect({ host, port: Number(port), timeout: 5000 }, () => socket.end(zpl, resolve));
    socket.on("timeout", () => {
      socket.destroy();
      reject(new PrinterError(`Printer ${host} didn't answer.`, 504));
    });
    socket.on("error", (err) => reject(new PrinterError(`Printer ${host}: ${err.message}`, 502)));
  });
}

export class PrinterError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
