import Decimal from "decimal.js";

// All money maths goes through decimal.js; floats are never used for amounts.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export type DecimalInput = Decimal.Value | { toString(): string };

export function dec(value: DecimalInput): Decimal {
  return new Decimal(typeof value === "object" && !(value instanceof Decimal) ? value.toString() : value);
}

/** Round to cents, half-up. */
export function round2(value: DecimalInput): Decimal {
  return dec(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function formatUsd(value: DecimalInput): string {
  return `US$${formatNumber(value, 2)}`;
}

export function formatZig(value: DecimalInput): string {
  return `ZiG ${formatNumber(value, 2)}`;
}

export function formatNumber(value: DecimalInput, dp: number): string {
  const [whole, frac] = dec(value).toFixed(dp).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${grouped}.${frac}` : grouped;
}
