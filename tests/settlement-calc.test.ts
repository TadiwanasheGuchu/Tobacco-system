import { describe, expect, it } from "vitest";
import { calculateSettlement } from "@/lib/settlement-calc";

const base = {
  bales: [
    { baleId: "a", massKg: "100.00", pricePerKgUsd: "3.5000" },
    { baleId: "b", massKg: "85.50", pricePerKgUsd: "4.1250" },
  ],
  charges: [],
  usdPercent: "70",
  zigPerUsd: "26.5",
};

describe("calculateSettlement", () => {
  it("values each bale and rounds to cents", () => {
    const r = calculateSettlement(base);
    // 85.5 * 4.125 = 352.6875 -> 352.69
    expect(r.lines.map((l) => l.valueUsd.toFixed(2))).toEqual(["350.00", "352.69"]);
    expect(r.grossUsd.toFixed(2)).toBe("702.69");
    expect(r.totalMassKg.toFixed(2)).toBe("185.50");
  });

  it("applies percentage, per-bale and per-kg charges", () => {
    const r = calculateSettlement({
      ...base,
      charges: [
        { code: "LEVY", name: "Levy", kind: "PERCENT_OF_GROSS", value: "1.5" },
        { code: "HANDLING", name: "Handling", kind: "PER_BALE", value: "2" },
        { code: "TRANSPORT", name: "Transport", kind: "PER_KG", value: "0.01" },
      ],
    });
    expect(r.deductions.map((d) => d.amountUsd.toFixed(2))).toEqual(["10.54", "4.00", "1.86"]);
    expect(r.deductionsUsd.toFixed(2)).toBe("16.40");
    expect(r.netUsd.toFixed(2)).toBe("686.29");
  });

  it("recovers the loan up to the outstanding balance", () => {
    const r = calculateSettlement({ ...base, loanOutstandingUsd: "200" });
    expect(r.loanRecoveryUsd.toFixed(2)).toBe("200.00");
    expect(r.netUsd.toFixed(2)).toBe("502.69");
  });

  it("caps loan recovery at the configured share", () => {
    const r = calculateSettlement({ ...base, loanOutstandingUsd: "5000", loanRecoveryMaxPercent: "50" });
    expect(r.loanRecoveryUsd.toFixed(2)).toBe("351.35");
    expect(r.netUsd.toFixed(2)).toBe("351.34");
  });

  it("splits the net between USD and ZiG and the parts add back up", () => {
    const r = calculateSettlement(base);
    expect(r.payUsd.toFixed(2)).toBe("491.88");
    expect(r.payZigUsdEquiv.toFixed(2)).toBe("210.81");
    expect(r.payUsd.add(r.payZigUsdEquiv).toFixed(2)).toBe(r.netUsd.toFixed(2));
    expect(r.payZig.toFixed(2)).toBe("5586.47");
  });

  it("needs no exchange rate when paying fully in USD", () => {
    const r = calculateSettlement({ ...base, usdPercent: "100", zigPerUsd: "0" });
    expect(r.payZig.toFixed(2)).toBe("0.00");
  });

  it("rejects bad input", () => {
    expect(() => calculateSettlement({ ...base, bales: [] })).toThrow();
    expect(() => calculateSettlement({ ...base, zigPerUsd: "0" })).toThrow(/exchange rate/);
    expect(() =>
      calculateSettlement({ ...base, charges: [{ code: "X", name: "X", kind: "PER_BALE", value: "1000" }] }),
    ).toThrow(/exceed/);
  });
});
