import { describe, expect, it } from "vitest";
import { ticketZpl, zplText } from "@/lib/zpl";

describe("ticket ZPL", () => {
  const label = {
    floorName: "Harare Auction Floor",
    seasonYear: 2026,
    ticketNumber: "HAF-26-0000001-8",
    growerNumber: "GR10001",
    growerName: "Tendai Moyo",
    massKg: "102.40",
    manual: false,
    lane: "A3",
    contractNumber: null,
    receivedAt: "29/10/2026 13:09",
  };

  it("is a complete label with a Code 128 barcode of the ticket", () => {
    const zpl = ticketZpl(label);
    expect(zpl.startsWith("^XA")).toBe(true);
    expect(zpl.trim().endsWith("^XZ")).toBe(true);
    expect(zpl).toContain("^BCN,140,Y,N,N^FDHAF-26-0000001-8^FS");
    expect(zpl).toContain("Mass: 102.40 kg^FS");
  });

  it("marks typed weights and strips ZPL control characters from text", () => {
    expect(ticketZpl({ ...label, manual: true })).toContain("102.40 kg (M)");
    expect(zplText("Bad^XZ~name")).toBe("Bad XZ name");
  });
});
