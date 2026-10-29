import type { PaymentMethod } from "@/generated/prisma/enums";
import { audit, db, nextSequence, Tx } from "@/lib/db";
import { dec, Decimal } from "@/lib/money";
import { calculateSettlement, CalcResult, SettlementCalcError } from "@/lib/settlement-calc";
import { activeSeason, Actor, DomainError, startOfToday } from "./common";

const LOAN_RECOVERY_MAX_PERCENT = process.env.LOAN_RECOVERY_MAX_PERCENT ?? "100";

export interface SettlementGroup {
  floorId: string;
  contractId: string | null;
}

/** Accepted, unsettled bales grouped by floor and contract: each group settles separately. */
export async function settleableGroups(growerId: string) {
  const bales = await db.bale.findMany({
    where: { growerId, status: "ACCEPTED" },
    include: { floor: true, contract: true },
    orderBy: { receivedAt: "asc" },
  });
  const groups = new Map<string, { floor: (typeof bales)[number]["floor"]; contract: (typeof bales)[number]["contract"]; count: number }>();
  for (const b of bales) {
    const key = `${b.floorId}|${b.contractId ?? ""}`;
    const g = groups.get(key) ?? { floor: b.floor, contract: b.contract, count: 0 };
    g.count++;
    groups.set(key, g);
  }
  return [...groups.values()];
}

async function loanOutstanding(tx: Tx, contractId: string): Promise<Decimal> {
  const contract = await tx.contract.findUniqueOrThrow({ where: { id: contractId } });
  const recovered = await tx.settlementDeduction.aggregate({
    where: { contractId, code: "LOAN_RECOVERY", settlement: { status: { not: "REVERSED" } } },
    _sum: { amountUsd: true },
  });
  return dec(contract.inputLoanUsd).sub(dec(recovered._sum.amountUsd ?? 0));
}

async function currentRules(tx: Tx, floorType: "AUCTION" | "CONTRACT") {
  const now = new Date();
  // Sequential on purpose: this runs inside an interactive transaction, which
  // uses a single connection that cannot run queries in parallel.
  const charges = await tx.chargeRule.findMany({
    where: {
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      AND: [{ OR: [{ floorType: null }, { floorType }] }],
    },
    orderBy: { code: "asc" },
  });
  const split = await tx.paymentSplitRule.findFirst({
    where: { effectiveFrom: { lte: now } },
    orderBy: { effectiveFrom: "desc" },
  });
  const rate = await tx.exchangeRate.findFirst({
    where: { effectiveFrom: { gte: startOfToday(now), lte: now } },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!split) throw new DomainError("No USD/ZiG payment split is configured.");
  const usdPercent = dec(split.usdPercent);
  if (usdPercent.lt(100) && !rate) throw new DomainError("Capture today's ZiG exchange rate before settling.");
  return { charges, usdPercent, zigPerUsd: rate ? dec(rate.zigPerUsd) : new Decimal(0) };
}

async function computeGroup(tx: Tx, growerId: string, group: SettlementGroup) {
  const floor = await tx.floor.findUniqueOrThrow({ where: { id: group.floorId } });
  const bales = await tx.bale.findMany({
    where: { growerId, floorId: group.floorId, contractId: group.contractId, status: "ACCEPTED" },
    include: {
      currentOffer: true,
      gradings: { where: { kind: "TIMB" }, orderBy: { createdAt: "desc" }, take: 1, include: { grade: true } },
    },
    orderBy: { receivedAt: "asc" },
  });
  if (bales.length === 0) throw new DomainError("No accepted bales are waiting for settlement.");

  const rules = await currentRules(tx, floor.type);
  const loan = group.contractId ? await loanOutstanding(tx, group.contractId) : new Decimal(0);

  let calc: CalcResult;
  try {
    calc = calculateSettlement({
      bales: bales.map((b) => ({
        baleId: b.id,
        massKg: b.massKg,
        pricePerKgUsd: b.currentOffer!.pricePerKgUsd,
      })),
      charges: rules.charges.map((c) => ({ code: c.code, name: c.name, kind: c.kind, value: c.value })),
      loanOutstandingUsd: loan,
      loanRecoveryMaxPercent: LOAN_RECOVERY_MAX_PERCENT,
      usdPercent: rules.usdPercent,
      zigPerUsd: rules.zigPerUsd,
    });
  } catch (err) {
    if (err instanceof SettlementCalcError) throw new DomainError(err.message);
    throw err;
  }
  return { floor, bales, calc, rules, loanOutstanding: loan };
}

export async function previewSettlement(growerId: string, group: SettlementGroup) {
  return computeGroup(db, growerId, group);
}

export async function createSettlement(actor: Actor, growerId: string, group: SettlementGroup, paymentMethod: PaymentMethod) {
  return db.$transaction(async (tx) => {
    // Lock the grower's accepted bales so two cashiers cannot settle them twice.
    await tx.$queryRaw`SELECT id FROM "Bale" WHERE "growerId" = ${growerId} AND status = 'ACCEPTED' FOR UPDATE`;
    const grower = await tx.grower.findUniqueOrThrow({ where: { id: growerId } });
    if (paymentMethod === "BANK_TRANSFER" && !grower.bankAccountNumber) {
      throw new DomainError("The grower has no bank account on file.");
    }
    if (paymentMethod === "MOBILE_MONEY" && !grower.mobileMoneyNumber) {
      throw new DomainError("The grower has no mobile money number on file.");
    }

    const { bales, calc, rules } = await computeGroup(tx, growerId, group);
    const season = await activeSeason(tx);
    const seq = await nextSequence(tx, `settlement:${season.year}`);
    const number = `STL-${String(season.year % 100).padStart(2, "0")}-${String(seq).padStart(6, "0")}`;

    const settlement = await tx.settlement.create({
      data: {
        number,
        growerId,
        floorId: group.floorId,
        grossUsd: calc.grossUsd.toFixed(2),
        deductionsUsd: calc.deductionsUsd.toFixed(2),
        netUsd: calc.netUsd.toFixed(2),
        usdPercent: rules.usdPercent.toFixed(2),
        payUsd: calc.payUsd.toFixed(2),
        payZigUsdEquiv: calc.payZigUsdEquiv.toFixed(2),
        zigPerUsd: rules.zigPerUsd.toFixed(4),
        payZig: calc.payZig.toFixed(2),
        paymentMethod,
        createdById: actor.id,
        lines: {
          create: calc.lines.map((l) => {
            const bale = bales.find((b) => b.id === l.baleId)!;
            return {
              baleId: l.baleId,
              gradeCode: bale.gradings[0]?.grade.code ?? "-",
              massKg: l.massKg.toFixed(2),
              pricePerKgUsd: l.pricePerKgUsd.toFixed(4),
              valueUsd: l.valueUsd.toFixed(2),
            };
          }),
        },
        deductions: {
          create: calc.deductions.map((d) => ({
            code: d.code,
            description: d.description,
            amountUsd: d.amountUsd.toFixed(2),
            contractId: d.code === "LOAN_RECOVERY" ? group.contractId : null,
          })),
        },
      },
    });
    await tx.bale.updateMany({ where: { id: { in: bales.map((b) => b.id) } }, data: { status: "SETTLED" } });
    await audit(tx, actor.id, "settlement.create", "Settlement", settlement.id, {
      number,
      netUsd: calc.netUsd.toFixed(2),
      bales: bales.length,
    });
    return settlement;
  });
}

export async function markSettlementPaid(actor: Actor, settlementId: string, paymentReference: string) {
  if (!paymentReference.trim()) throw new DomainError("Enter the bank, mobile money or cash voucher reference.");
  return db.$transaction(async (tx) => {
    const s = await tx.settlement.findUnique({ where: { id: settlementId } });
    if (!s) throw new DomainError("Settlement not found.");
    if (s.status !== "APPROVED") throw new DomainError(`This settlement is already ${s.status.toLowerCase()}.`);
    if (s.createdById === actor.id) {
      throw new DomainError("Payment must be released by someone other than the person who prepared the settlement.");
    }
    const updated = await tx.settlement.updateMany({
      where: { id: settlementId, status: "APPROVED" },
      data: { status: "PAID", paidById: actor.id, paidAt: new Date(), paymentReference: paymentReference.trim() },
    });
    if (updated.count === 0) throw new DomainError("This settlement was changed by someone else. Reload and try again.");
    await audit(tx, actor.id, "settlement.pay", "Settlement", settlementId, { paymentReference });
  });
}

/** Cancels an unpaid settlement; its bales return to "accepted" and can be settled again. */
export async function reverseSettlement(actor: Actor, settlementId: string, reason: string) {
  if (reason.trim().length < 5) throw new DomainError("Give a reason for the reversal.");
  return db.$transaction(async (tx) => {
    const s = await tx.settlement.findUnique({ where: { id: settlementId }, include: { lines: true } });
    if (!s) throw new DomainError("Settlement not found.");
    if (s.status !== "APPROVED") throw new DomainError("Only unpaid settlements can be reversed.");
    await tx.settlement.update({
      where: { id: settlementId },
      data: { status: "REVERSED", reversedById: actor.id, reversedAt: new Date(), reversalReason: reason.trim() },
    });
    await tx.bale.updateMany({ where: { id: { in: s.lines.map((l) => l.baleId) } }, data: { status: "ACCEPTED" } });
    await audit(tx, actor.id, "settlement.reverse", "Settlement", settlementId, { reason });
  });
}
