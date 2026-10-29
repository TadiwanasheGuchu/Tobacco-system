import { describe, expect, it } from "vitest";
import { baleSoldSms, fitsOneSms, paymentSentSms, statementReadySms } from "@/lib/sms/messages";

describe("grower SMS texts", () => {
  it("each fits in one standard SMS, even with long values", () => {
    const texts = [
      baleSoldSms({ floorCode: "HAF", ticket: "HAF-26-0001234-5", massKg: "149.95", grade: "L2O", pricePerKg: "4.8750", buyerCode: "LTM" }),
      statementReadySms({ number: "STL-26-000123", bales: 12, netUsd: "12345.67", payUsd: "8641.97", payZig: "99123.45", method: "mobile money" }),
      statementReadySms({ number: "STL-26-000124", bales: 3, netUsd: "0", payUsd: "0", payZig: "0", method: "bank" }),
      paymentSentSms({ number: "STL-26-000123", amount: "99123.45", currency: "ZIG", method: "bank transfer", reference: "PAY-26-00012 CBZ778812" }),
    ];
    for (const t of texts) expect(fitsOneSms(t), t).toBe(true);
  });

  it("says what was sold and for how much", () => {
    expect(baleSoldSms({ floorCode: "HAF", ticket: "HAF-26-0000001-8", massKg: "102.40", grade: "L2O", pricePerKg: "3.95", buyerCode: "NKM" })).toBe(
      "HAF: Bale HAF-26-0000001-8 SOLD. 102.40kg grade L2O at US$3.95/kg to NKM, about US$404.48. Payment follows.",
    );
  });
});
