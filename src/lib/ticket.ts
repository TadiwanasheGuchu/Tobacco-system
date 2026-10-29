/**
 * Bale ticket numbers: FLOOR-YY-SEQUENCE-CHECK, e.g. "HRE-26-0000123-4".
 * The check digit (Luhn over the digits) catches most mistyped or misread tickets
 * when a barcode won't scan and the number is keyed in by hand.
 */

export function luhnCheckDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

export function formatTicketNumber(floorCode: string, seasonYear: number, sequence: number): string {
  const yy = String(seasonYear % 100).padStart(2, "0");
  const seq = String(sequence).padStart(7, "0");
  return `${floorCode.toUpperCase()}-${yy}-${seq}-${luhnCheckDigit(yy + seq)}`;
}

/** Normalises scanned or typed input; returns null if the check digit is wrong. */
export function parseTicketNumber(input: string): string | null {
  const match = input.trim().toUpperCase().match(/^([A-Z0-9]{2,6})-?(\d{2})-?(\d{7})-?(\d)$/);
  if (!match) return null;
  const [, floor, yy, seq, check] = match;
  if (luhnCheckDigit(yy + seq) !== Number(check)) return null;
  return `${floor}-${yy}-${seq}-${check}`;
}
