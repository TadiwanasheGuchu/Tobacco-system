import { dec, DecimalInput } from "@/lib/money";

/**
 * Grower text messages. Kept to one SMS (160 characters) and to characters in
 * the basic GSM alphabet, so they don't split or turn into Unicode messages.
 */

const usd = (v: DecimalInput) => `US$${dec(v).toFixed(2)}`;
const zig = (v: DecimalInput) => `ZiG${dec(v).toFixed(2)}`;
const kg = (v: DecimalInput) => `${dec(v).toFixed(2)}kg`;

export function baleSoldSms(m: { floorCode: string; ticket: string; massKg: DecimalInput; grade: string | null; pricePerKg: DecimalInput; buyerCode: string }) {
  const value = dec(m.massKg).mul(dec(m.pricePerKg));
  return `${m.floorCode}: Bale ${m.ticket} SOLD. ${kg(m.massKg)}${m.grade ? ` grade ${m.grade}` : ""} at ${usd(m.pricePerKg)}/kg to ${m.buyerCode}, about ${usd(value)}. Payment follows.`;
}

export function statementReadySms(m: { number: string; bales: number; netUsd: DecimalInput; payUsd: DecimalInput; payZig: DecimalInput; method: string }) {
  if (dec(m.netUsd).isZero()) {
    return `Statement ${m.number}: ${m.bales} bale(s). After levies and your input loan there is nothing to pay this time.`;
  }
  return `Statement ${m.number}: ${m.bales} bale(s), net ${usd(m.netUsd)}. You get ${usd(m.payUsd)} + ${zig(m.payZig)} by ${m.method}.`;
}

export function paymentSentSms(m: { number: string; amount: DecimalInput; currency: "USD" | "ZIG"; method: string; reference: string }) {
  const amount = m.currency === "USD" ? usd(m.amount) : zig(m.amount);
  return `Payment sent: ${amount} for statement ${m.number} by ${m.method}. Ref ${m.reference}. Contact the floor office if not received.`;
}

const GSM = /^[A-Za-z0-9 @£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà\n\r]*$/;

/** True if the text fits one standard SMS. */
export function fitsOneSms(text: string) {
  return text.length <= 160 && GSM.test(text);
}
