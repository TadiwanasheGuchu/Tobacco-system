/**
 * Normalises a Zimbabwe mobile number to international form without "+",
 * e.g. "077 123 4567" or "+263 77 123 4567" -> "263771234567".
 * Returns null if it isn't a Zimbabwe mobile number (07x, 9 digits after the 0).
 */
export function normalizeZwMobile(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/[\s\-().+]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  let national: string;
  if (digits.startsWith("263") && digits.length === 12) national = digits.slice(3);
  else if (digits.startsWith("0") && digits.length === 10) national = digits.slice(1);
  else if (digits.length === 9) national = digits;
  else return null;
  return /^7\d{8}$/.test(national) ? `263${national}` : null;
}

/** Bank account numbers: digits only, 6-20 long, after removing spaces and dashes. */
export function normalizeBankAccount(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/[\s-]/g, "");
  return /^\d{6,20}$/.test(digits) ? digits : null;
}
