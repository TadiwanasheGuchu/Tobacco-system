import { describe, expect, it } from "vitest";
import { normalizeBankAccount, normalizeZwMobile } from "@/lib/payee";

describe("normalizeZwMobile", () => {
  it("accepts local and international forms", () => {
    expect(normalizeZwMobile("0771234567")).toBe("263771234567");
    expect(normalizeZwMobile("077 123 4567")).toBe("263771234567");
    expect(normalizeZwMobile("+263 77 123-4567")).toBe("263771234567");
    expect(normalizeZwMobile("771234567")).toBe("263771234567");
  });
  it("rejects landlines and junk", () => {
    expect(normalizeZwMobile("0242123456")).toBeNull();
    expect(normalizeZwMobile("12345")).toBeNull();
    expect(normalizeZwMobile("07712abc67")).toBeNull();
    expect(normalizeZwMobile("")).toBeNull();
  });
});

describe("normalizeBankAccount", () => {
  it("keeps digits only and checks length", () => {
    expect(normalizeBankAccount("1002-003 001")).toBe("1002003001");
    expect(normalizeBankAccount("12345")).toBeNull();
    expect(normalizeBankAccount("ABC123456")).toBeNull();
  });
});
