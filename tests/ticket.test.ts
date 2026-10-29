import { describe, expect, it } from "vitest";
import { formatTicketNumber, luhnCheckDigit, parseTicketNumber } from "@/lib/ticket";

describe("ticket numbers", () => {
  it("uses the Luhn check digit", () => {
    expect(luhnCheckDigit("7992739871")).toBe(3);
  });

  it("formats and parses round-trip", () => {
    const t = formatTicketNumber("hre", 2026, 123);
    expect(t).toMatch(/^HRE-26-0000123-\d$/);
    expect(parseTicketNumber(t)).toBe(t);
    expect(parseTicketNumber(t.replace(/-/g, "").toLowerCase())).toBe(t);
  });

  it("rejects a mistyped ticket", () => {
    const t = formatTicketNumber("HRE", 2026, 123);
    const wrong = t.replace("0000123", "0000132");
    expect(parseTicketNumber(wrong)).toBeNull();
  });
});
