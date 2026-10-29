import { dec, Decimal, DecimalInput, round2 } from "./money";

export type ChargeKind = "PERCENT_OF_GROSS" | "PER_BALE" | "PER_KG";

export interface CalcBale {
  baleId: string;
  massKg: DecimalInput;
  pricePerKgUsd: DecimalInput;
}

export interface CalcCharge {
  code: string;
  name: string;
  kind: ChargeKind;
  /** Percent for PERCENT_OF_GROSS (1.5 = 1.5%), otherwise USD per bale / per kg. */
  value: DecimalInput;
}

export interface CalcInput {
  bales: CalcBale[];
  charges: CalcCharge[];
  /** Outstanding input loan on the grower's contract, if any. */
  loanOutstandingUsd?: DecimalInput;
  /** Max share of the post-charge amount that may go to loan recovery (0-100). */
  loanRecoveryMaxPercent?: DecimalInput;
  /** Share of the net paid in USD (0-100); the rest is paid in ZiG. */
  usdPercent: DecimalInput;
  zigPerUsd: DecimalInput;
}

export interface CalcLine {
  baleId: string;
  massKg: Decimal;
  pricePerKgUsd: Decimal;
  valueUsd: Decimal;
}

export interface CalcDeduction {
  code: string;
  description: string;
  amountUsd: Decimal;
}

export interface CalcResult {
  lines: CalcLine[];
  totalMassKg: Decimal;
  grossUsd: Decimal;
  deductions: CalcDeduction[];
  loanRecoveryUsd: Decimal;
  deductionsUsd: Decimal;
  netUsd: Decimal;
  payUsd: Decimal;
  payZigUsdEquiv: Decimal;
  payZig: Decimal;
}

export class SettlementCalcError extends Error {}

/**
 * Computes a grower's payout for a set of accepted bales.
 *
 * Order: bale values -> gross -> levies/commission/fees -> loan recovery -> net
 * -> USD/ZiG split. Each amount is rounded to cents as it is produced, so the
 * statement adds up exactly line by line.
 */
export function calculateSettlement(input: CalcInput): CalcResult {
  if (input.bales.length === 0) {
    throw new SettlementCalcError("No bales to settle.");
  }

  const lines: CalcLine[] = input.bales.map((b) => {
    const massKg = dec(b.massKg);
    const pricePerKgUsd = dec(b.pricePerKgUsd);
    if (massKg.lte(0) || pricePerKgUsd.lte(0)) {
      throw new SettlementCalcError(`Bale ${b.baleId} has no valid mass or price.`);
    }
    return { baleId: b.baleId, massKg, pricePerKgUsd, valueUsd: round2(massKg.mul(pricePerKgUsd)) };
  });

  const totalMassKg = lines.reduce((sum, l) => sum.add(l.massKg), new Decimal(0));
  const grossUsd = lines.reduce((sum, l) => sum.add(l.valueUsd), new Decimal(0));

  const deductions: CalcDeduction[] = input.charges.map((c) => {
    const value = dec(c.value);
    let amountUsd: Decimal;
    switch (c.kind) {
      case "PERCENT_OF_GROSS":
        amountUsd = round2(grossUsd.mul(value).div(100));
        break;
      case "PER_BALE":
        amountUsd = round2(value.mul(lines.length));
        break;
      case "PER_KG":
        amountUsd = round2(value.mul(totalMassKg));
        break;
    }
    return { code: c.code, description: c.name, amountUsd };
  });

  const chargesUsd = deductions.reduce((sum, d) => sum.add(d.amountUsd), new Decimal(0));
  if (chargesUsd.gt(grossUsd)) {
    throw new SettlementCalcError("Charges exceed the gross value of the bales.");
  }

  const afterCharges = grossUsd.sub(chargesUsd);
  const outstanding = dec(input.loanOutstandingUsd ?? 0);
  const maxPercent = dec(input.loanRecoveryMaxPercent ?? 100);
  const recoveryCap = round2(afterCharges.mul(maxPercent).div(100));
  const loanRecoveryUsd = outstanding.gt(0) ? Decimal.min(outstanding, recoveryCap) : new Decimal(0);
  if (loanRecoveryUsd.gt(0)) {
    deductions.push({ code: "LOAN_RECOVERY", description: "Input loan recovery", amountUsd: loanRecoveryUsd });
  }

  const deductionsUsd = chargesUsd.add(loanRecoveryUsd);
  const netUsd = grossUsd.sub(deductionsUsd);

  const usdPercent = dec(input.usdPercent);
  if (usdPercent.lt(0) || usdPercent.gt(100)) {
    throw new SettlementCalcError("USD share must be between 0 and 100 percent.");
  }
  const zigPerUsd = dec(input.zigPerUsd);
  const payUsd = round2(netUsd.mul(usdPercent).div(100));
  const payZigUsdEquiv = netUsd.sub(payUsd);
  if (payZigUsdEquiv.gt(0) && zigPerUsd.lte(0)) {
    throw new SettlementCalcError("A ZiG exchange rate is required for the ZiG portion.");
  }
  const payZig = round2(payZigUsdEquiv.mul(zigPerUsd));

  return {
    lines,
    totalMassKg,
    grossUsd,
    deductions,
    loanRecoveryUsd,
    deductionsUsd,
    netUsd,
    payUsd,
    payZigUsdEquiv,
    payZig,
  };
}
