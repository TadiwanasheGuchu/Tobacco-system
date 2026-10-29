import type { Prisma } from "@/generated/prisma/client";
import type { Currency, PaymentMethod } from "@/generated/prisma/enums";
import { audit, db, nextSequence } from "@/lib/db";
import { dec, Decimal } from "@/lib/money";
import { normalizeBankAccount, normalizeZwMobile } from "@/lib/payee";
import { paymentSentSms } from "@/lib/sms/messages";
import { enqueueSms } from "@/lib/sms/outbox";
import { activeSeason, Actor, DomainError } from "./common";

/**
 * Payment batches turn approved settlements into payout files for a bank or a
 * mobile money provider. A settlement's USD and ZiG portions go in separate
 * batches (one file per currency). Once every portion a settlement needs has
 * been confirmed by the provider, the settlement is marked paid.
 */

export type BatchMethod = Extract<PaymentMethod, "BANK_TRANSFER" | "MOBILE_MONEY">;
export const BATCH_METHODS: BatchMethod[] = ["BANK_TRANSFER", "MOBILE_MONEY"];
export const CURRENCIES: Currency[] = ["USD", "ZIG"];

const amountField = (currency: Currency): "payUsd" | "payZig" => (currency === "USD" ? "payUsd" : "payZig");

/** Approved settlements with an amount in this currency that aren't already in a live batch for it. */
function candidateWhere(method: BatchMethod, currency: Currency): Prisma.SettlementWhereInput {
  return {
    status: "APPROVED",
    paymentMethod: method,
    [amountField(currency)]: { gt: 0 },
    batchLines: { none: { batch: { currency, status: { in: ["OPEN", "CONFIRMED"] } } } },
  };
}

export async function batchCandidatesSummary() {
  const rows = [];
  for (const method of BATCH_METHODS) {
    for (const currency of CURRENCIES) {
      const agg = await db.settlement.aggregate({
        where: candidateWhere(method, currency),
        _count: true,
        _sum: { payUsd: true, payZig: true },
      });
      rows.push({
        method,
        currency,
        count: agg._count,
        total: dec((currency === "USD" ? agg._sum.payUsd : agg._sum.payZig) ?? 0),
      });
    }
  }
  return rows;
}

function payeeFor(method: BatchMethod, grower: { bankName: string | null; bankAccountNumber: string | null; mobileMoneyNumber: string | null }) {
  if (method === "MOBILE_MONEY") {
    const phone = normalizeZwMobile(grower.mobileMoneyNumber);
    return phone ? { account: phone, bank: null } : null;
  }
  const account = normalizeBankAccount(grower.bankAccountNumber);
  return account && grower.bankName ? { account, bank: grower.bankName } : null;
}

export async function createPaymentBatch(actor: Actor, method: BatchMethod, currency: Currency) {
  return db.$transaction(async (tx) => {
    const where = candidateWhere(method, currency);
    // Lock the candidates so two supervisors can't batch the same settlement twice.
    const ids = (await tx.settlement.findMany({ where, select: { id: true } })).map((s) => s.id);
    if (ids.length === 0) throw new DomainError("Nothing is waiting to be paid this way.");
    await tx.$queryRaw`SELECT id FROM "Settlement" WHERE id = ANY(${ids}) FOR UPDATE`;
    const settlements = await tx.settlement.findMany({
      where: { ...where, id: { in: ids } },
      include: { grower: true },
      orderBy: { createdAt: "asc" },
    });

    const lines: { settlementId: string; amount: Decimal; payeeName: string; payeeAccount: string; payeeBank: string | null; reference: string }[] = [];
    const skipped: string[] = [];
    for (const s of settlements) {
      const payee = payeeFor(method, s.grower);
      if (!payee) {
        skipped.push(s.number);
        continue;
      }
      lines.push({
        settlementId: s.id,
        amount: dec(s[amountField(currency)]),
        payeeName: `${s.grower.firstName} ${s.grower.lastName}`,
        payeeAccount: payee.account,
        payeeBank: payee.bank,
        reference: `TOBACCO ${s.number}`,
      });
    }
    if (lines.length === 0) {
      throw new DomainError(`No settlement has valid ${method === "MOBILE_MONEY" ? "mobile money numbers" : "bank details"}: ${skipped.join(", ")}.`);
    }

    const season = await activeSeason(tx);
    const seq = await nextSequence(tx, `payment-batch:${season.year}`);
    const number = `PAY-${String(season.year % 100).padStart(2, "0")}-${String(seq).padStart(5, "0")}`;
    const total = lines.reduce((sum, l) => sum.add(l.amount), new Decimal(0));
    const batch = await tx.paymentBatch.create({
      data: {
        number,
        method,
        currency,
        totalAmount: total.toFixed(2),
        lineCount: lines.length,
        createdById: actor.id,
        lines: { create: lines.map((l) => ({ ...l, amount: l.amount.toFixed(2) })) },
      },
    });
    await audit(tx, actor.id, "payments.batchCreate", "PaymentBatch", batch.id, {
      number,
      method,
      currency,
      total: total.toFixed(2),
      lines: lines.length,
      skipped,
    });
    return { batch, skipped };
  });
}

export async function cancelPaymentBatch(actor: Actor, batchId: string, reason: string) {
  if (reason.trim().length < 5) throw new DomainError("Give a reason, e.g. what the bank rejected.");
  await db.$transaction(async (tx) => {
    const updated = await tx.paymentBatch.updateMany({
      where: { id: batchId, status: "OPEN" },
      data: { status: "CANCELLED", cancelledById: actor.id, cancelledAt: new Date(), cancelReason: reason.trim() },
    });
    if (updated.count === 0) throw new DomainError("Only open batches can be cancelled.");
    await audit(tx, actor.id, "payments.batchCancel", "PaymentBatch", batchId, { reason });
  });
}

/**
 * Records the provider's confirmation. Settlements whose every portion (USD,
 * ZiG) is now in a confirmed batch become PAID. The person confirming must not
 * have prepared any of the settlements in the batch (two-person rule).
 */
export async function confirmPaymentBatch(actor: Actor, batchId: string, bankReference: string) {
  if (!bankReference.trim()) throw new DomainError("Enter the bank or provider's confirmation reference.");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PaymentBatch" WHERE id = ${batchId} FOR UPDATE`;
    const batch = await tx.paymentBatch.findUnique({ where: { id: batchId }, include: { lines: { include: { settlement: { include: { grower: true } } } } } });
    if (!batch) throw new DomainError("Batch not found.");
    if (batch.status !== "OPEN") throw new DomainError(`This batch is already ${batch.status.toLowerCase()}.`);
    const own = batch.lines.filter((l) => l.settlement.createdById === actor.id);
    if (own.length > 0) {
      throw new DomainError(
        `You prepared ${own.map((l) => l.settlement.number).join(", ")}. Someone else must confirm this payment.`,
      );
    }

    const now = new Date();
    await tx.paymentBatch.update({
      where: { id: batchId },
      data: { status: "CONFIRMED", confirmedById: actor.id, confirmedAt: now, bankReference: bankReference.trim() },
    });

    let paid = 0;
    for (const line of batch.lines) {
      const s = line.settlement;
      // Tell the grower this part of their money has gone out.
      await enqueueSms(
        tx,
        "PAYMENT_SENT",
        line.id,
        s.grower,
        paymentSentSms({
          number: s.number,
          amount: line.amount,
          currency: batch.currency,
          method: batch.method === "MOBILE_MONEY" ? "mobile money" : "bank transfer",
          reference: `${batch.number} ${bankReference.trim()}`.slice(0, 30),
        }),
      );
      if (s.status !== "APPROVED") continue;
      const confirmed = await tx.paymentBatchLine.findMany({
        where: { settlementId: s.id, batch: { status: "CONFIRMED" } },
        include: { batch: true },
      });
      const has = (c: Currency) => confirmed.some((l) => l.batch.currency === c);
      const needsUsd = dec(s.payUsd).gt(0);
      const needsZig = dec(s.payZig).gt(0);
      if ((!needsUsd || has("USD")) && (!needsZig || has("ZIG"))) {
        await tx.settlement.update({
          where: { id: s.id },
          data: {
            status: "PAID",
            paidById: actor.id,
            paidAt: now,
            paymentReference: confirmed.map((l) => `${l.batch.number} ${l.batch.bankReference ?? ""}`.trim()).join("; "),
          },
        });
        await audit(tx, actor.id, "settlement.pay", "Settlement", s.id, { via: batch.number });
        paid++;
      }
    }
    await audit(tx, actor.id, "payments.batchConfirm", "PaymentBatch", batchId, { bankReference, settlementsPaid: paid });
    return { paid, lines: batch.lines.length };
  });
}

/** True if any portion of the settlement is in an open or confirmed batch. */
export async function isInLiveBatch(settlementId: string, tx: Pick<typeof db, "paymentBatchLine"> = db) {
  return (
    (await tx.paymentBatchLine.count({
      where: { settlementId, batch: { status: { in: ["OPEN", "CONFIRMED"] } } },
    })) > 0
  );
}
