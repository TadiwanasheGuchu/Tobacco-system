/**
 * Bale ticket as ZPL for Zebra label printers: 100 x 75 mm at 203 dpi
 * (about 800 x 600 dots). Adjust the size constants for other label stock.
 */

export interface TicketLabel {
  floorName: string;
  seasonYear: number;
  ticketNumber: string;
  growerNumber: string;
  growerName: string;
  massKg: string;
  manual: boolean;
  lane: string | null;
  contractNumber: string | null;
  receivedAt: string;
}

/** ZPL treats ^ and ~ as commands; strip them (and line breaks) from printed text. */
export function zplText(value: string, max = 40): string {
  return value.replace(/[\^~\r\n]/g, " ").slice(0, max);
}

export function ticketZpl(t: TicketLabel): string {
  const lines = [
    "^XA",
    "^CI28", // UTF-8
    "^PW800",
    "^LL600",
    `^FO30,25^A0N,30,30^FD${zplText(t.floorName, 34)}^FS`,
    `^FO600,25^A0N,30,30^FDSeason ${t.seasonYear}^FS`,
    // Code 128 barcode with the ticket number printed underneath.
    `^FO40,75^BY3,3,140^BCN,140,Y,N,N^FD${zplText(t.ticketNumber, 30)}^FS`,
    `^FO30,290^A0N,34,34^FDGrower: ${zplText(t.growerNumber, 14)}  ${zplText(t.growerName, 26)}^FS`,
    `^FO30,340^A0N,52,52^FDMass: ${zplText(t.massKg, 10)} kg${t.manual ? " (M)" : ""}^FS`,
    `^FO30,410^A0N,30,30^FDLane: ${zplText(t.lane ?? "-", 10)}${t.contractNumber ? `   Contract: ${zplText(t.contractNumber, 20)}` : ""}^FS`,
    `^FO30,455^A0N,26,26^FDReceived: ${zplText(t.receivedAt, 30)}^FS`,
    "^XZ",
  ];
  return lines.join("\n") + "\n";
}
