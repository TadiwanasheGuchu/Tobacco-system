import { Prisma } from "@/generated/prisma/client";
import { audit, db } from "@/lib/db";
import { dec, Decimal } from "@/lib/money";
import { enqueueTimb } from "@/lib/timb/outbox";
import { parseRange, ReportRange } from "@/lib/report-range";
import { Actor, DomainError } from "./common";

export { parseRange, type ReportRange };

/**
 * Reporting queries. A bale counts as "sold" on the day the grower accepted its
 * price (decisionAt), whether or not it has been settled yet. Bale values are
 * rounded to cents per bale, the same way settlement statements do it, so the
 * reports reconcile with statements.
 */

export interface SalesRow {
  key: string;
  label: string;
  bales: number;
  massKg: Decimal;
  valueUsd: Decimal;
  avgPriceUsd: Decimal;
}

type RawSalesRow = { key: string | null; label: string | null; bales: bigint; mass: Prisma.Decimal | null; value: Prisma.Decimal | null };

function toSalesRows(rows: RawSalesRow[]): SalesRow[] {
  return rows.map((r) => {
    const massKg = dec(r.mass ?? 0);
    const valueUsd = dec(r.value ?? 0);
    return {
      key: r.key ?? "-",
      label: r.label ?? "Ungraded",
      bales: Number(r.bales),
      massKg,
      valueUsd,
      avgPriceUsd: massKg.gt(0) ? valueUsd.div(massKg).toDecimalPlaces(4) : new Decimal(0),
    };
  });
}

function soldBalesCte(range: ReportRange) {
  const floorFilter = range.floorId ? Prisma.sql`AND b."floorId" = ${range.floorId}` : Prisma.empty;
  return Prisma.sql`
    WITH sold AS (
      SELECT b.id, b."floorId", b."massKg" AS mass, o."buyerId",
             ROUND(b."massKg" * o."pricePerKgUsd", 2) AS value,
             (SELECT g."gradeId" FROM "BaleGrading" g
               WHERE g."baleId" = b.id AND g.kind = 'TIMB'
               ORDER BY g."createdAt" DESC LIMIT 1) AS "gradeId"
      FROM "Bale" b
      JOIN "BaleOffer" o ON o.id = b."currentOfferId"
      WHERE b.status IN ('ACCEPTED', 'SETTLED')
        AND b."decisionAt" >= ${range.from} AND b."decisionAt" < ${range.to}
        ${floorFilter}
    )`;
}

export async function salesByGrade(range: ReportRange): Promise<SalesRow[]> {
  const rows = await db.$queryRaw<RawSalesRow[]>`
    ${soldBalesCte(range)}
    SELECT gr.code AS key, gr.code || ' · ' || gr.description AS label,
           COUNT(*) AS bales, SUM(s.mass) AS mass, SUM(s.value) AS value
    FROM sold s LEFT JOIN "Grade" gr ON gr.id = s."gradeId"
    GROUP BY gr.code, gr.description
    ORDER BY SUM(s.value) DESC`;
  return toSalesRows(rows);
}

export async function salesByBuyer(range: ReportRange): Promise<SalesRow[]> {
  const rows = await db.$queryRaw<RawSalesRow[]>`
    ${soldBalesCte(range)}
    SELECT bu.code AS key, bu.code || ' · ' || bu.name AS label,
           COUNT(*) AS bales, SUM(s.mass) AS mass, SUM(s.value) AS value
    FROM sold s JOIN "Buyer" bu ON bu.id = s."buyerId"
    GROUP BY bu.code, bu.name
    ORDER BY SUM(s.value) DESC`;
  return toSalesRows(rows);
}

export async function salesByFloor(range: ReportRange): Promise<SalesRow[]> {
  const rows = await db.$queryRaw<RawSalesRow[]>`
    ${soldBalesCte(range)}
    SELECT f.code AS key, f.code || ' · ' || f.name AS label,
           COUNT(*) AS bales, SUM(s.mass) AS mass, SUM(s.value) AS value
    FROM sold s JOIN "Floor" f ON f.id = s."floorId"
    GROUP BY f.code, f.name
    ORDER BY f.code`;
  return toSalesRows(rows);
}

export function totalOf(rows: SalesRow[]): SalesRow {
  const massKg = rows.reduce((s, r) => s.add(r.massKg), new Decimal(0));
  const valueUsd = rows.reduce((s, r) => s.add(r.valueUsd), new Decimal(0));
  return {
    key: "TOTAL",
    label: "Total",
    bales: rows.reduce((s, r) => s + r.bales, 0),
    massKg,
    valueUsd,
    avgPriceUsd: massKg.gt(0) ? valueUsd.div(massKg).toDecimalPlaces(4) : new Decimal(0),
  };
}

/** Bales received, and grower decisions (from the audit log, so re-offered rejections still count). */
export async function floorActivity(range: ReportRange) {
  const where = { createdAt: { gte: range.from, lt: range.to } };
  const [received, accepts, rejects] = await Promise.all([
    db.bale.aggregate({
      where: { receivedAt: { gte: range.from, lt: range.to }, ...(range.floorId ? { floorId: range.floorId } : {}) },
      _count: true,
      _sum: { massKg: true },
    }),
    countBaleAudit("bale.accept", where, range.floorId),
    countBaleAudit("bale.reject", where, range.floorId),
  ]);
  const decisions = accepts + rejects;
  return {
    receivedBales: received._count,
    receivedKg: dec(received._sum.massKg ?? 0),
    accepts,
    rejects,
    rejectionRatePercent: decisions > 0 ? new Decimal(rejects).mul(100).div(decisions).toDecimalPlaces(1) : new Decimal(0),
  };
}

async function countBaleAudit(action: string, where: { createdAt: { gte: Date; lt: Date } }, floorId: string | null) {
  if (!floorId) return db.auditLog.count({ where: { ...where, action } });
  const rows = await db.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM "AuditLog" a JOIN "Bale" b ON b.id = a."entityId"
    WHERE a.action = ${action} AND a."createdAt" >= ${where.createdAt.gte} AND a."createdAt" < ${where.createdAt.lt}
      AND b."floorId" = ${floorId}`;
  return Number(rows[0].n);
}

/** Settlements created in the range (reversed ones excluded). */
export async function payoutSummary(range: ReportRange) {
  const where: Prisma.SettlementWhereInput = {
    createdAt: { gte: range.from, lt: range.to },
    status: { not: "REVERSED" },
    ...(range.floorId ? { floorId: range.floorId } : {}),
  };
  const [byStatus, byMethod, deductions] = await Promise.all([
    db.settlement.groupBy({
      by: ["status"],
      where,
      _count: true,
      _sum: { grossUsd: true, deductionsUsd: true, netUsd: true, payUsd: true, payZig: true },
    }),
    db.settlement.groupBy({ by: ["paymentMethod"], where, _count: true, _sum: { netUsd: true, payUsd: true, payZig: true } }),
    db.settlementDeduction.groupBy({
      by: ["code", "description"],
      where: { settlement: where },
      _sum: { amountUsd: true },
      orderBy: { code: "asc" },
    }),
  ]);
  const sum = (k: "grossUsd" | "deductionsUsd" | "netUsd" | "payUsd" | "payZig") =>
    byStatus.reduce((s, r) => s.add(dec(r._sum[k] ?? 0)), new Decimal(0));
  return {
    count: byStatus.reduce((s, r) => s + r._count, 0),
    grossUsd: sum("grossUsd"),
    deductionsUsd: sum("deductionsUsd"),
    netUsd: sum("netUsd"),
    payUsd: sum("payUsd"),
    payZig: sum("payZig"),
    unpaid: byStatus.find((r) => r.status === "APPROVED"),
    paid: byStatus.find((r) => r.status === "PAID"),
    byMethod,
    deductions: deductions.map((d) => ({ code: d.code, description: d.description, amountUsd: dec(d._sum.amountUsd ?? 0) })),
  };
}

/** Input loans per contractor for the open season, and how much has been recovered. */
export async function loanRecovery() {
  const rows = await db.$queryRaw<
    { code: string; name: string; contracts: bigint; loans: Prisma.Decimal | null; recovered: Prisma.Decimal | null }[]
  >`
    SELECT bu.code, bu.name, COUNT(c.id) AS contracts, SUM(c."inputLoanUsd") AS loans,
           COALESCE(SUM(r.recovered), 0) AS recovered
    FROM "Contract" c
    JOIN "Season" se ON se.id = c."seasonId" AND se.active
    JOIN "Buyer" bu ON bu.id = c."buyerId"
    LEFT JOIN (
      SELECT d."contractId", SUM(d."amountUsd") AS recovered
      FROM "SettlementDeduction" d JOIN "Settlement" s ON s.id = d."settlementId"
      WHERE d.code = 'LOAN_RECOVERY' AND s.status <> 'REVERSED'
      GROUP BY d."contractId"
    ) r ON r."contractId" = c.id
    GROUP BY bu.code, bu.name
    ORDER BY bu.code`;
  return rows.map((r) => {
    const loansUsd = dec(r.loans ?? 0);
    const recoveredUsd = dec(r.recovered ?? 0);
    return {
      code: r.code,
      name: r.name,
      contracts: Number(r.contracts),
      loansUsd,
      recoveredUsd,
      outstandingUsd: loansUsd.sub(recoveredUsd),
      recoveredPercent: loansUsd.gt(0) ? recoveredUsd.mul(100).div(loansUsd).toDecimalPlaces(1) : new Decimal(0),
    };
  });
}

/** Settlements for a payment list export (bank / mobile money / cash). */
export async function paymentList(range: ReportRange) {
  return db.settlement.findMany({
    where: {
      createdAt: { gte: range.from, lt: range.to },
      status: { not: "REVERSED" },
      ...(range.floorId ? { floorId: range.floorId } : {}),
    },
    include: { grower: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Queues the day's per-floor sales summary for TIMB. One summary per floor and
 * day: a second request is refused while the first is pending or sent.
 */
export async function queueTimbDailySummary(actor: Actor, dateLabel: string) {
  const range = parseRange({ from: dateLabel, to: dateLabel });
  if (range.from > new Date()) throw new DomainError("That day has not happened yet.");
  const floors = await db.floor.findMany({ orderBy: { code: "asc" } });
  let queued = 0;
  for (const floor of floors) {
    const floorRange = { ...range, floorId: floor.id };
    const grades = await salesByGrade(floorRange);
    if (grades.length === 0) continue;
    const entityId = `${range.fromLabel}:${floor.code}`;
    const total = totalOf(grades);
    const queuedNow = await db.$transaction(async (tx) => {
      const existing = await tx.timbOutbox.findFirst({
        where: { messageType: "DAILY_SUMMARY", entityId, status: { in: ["PENDING", "SENT"] } },
      });
      if (existing) return false;
      await enqueueTimb(tx, "DAILY_SUMMARY", entityId, {
        date: range.fromLabel,
        floorCode: floor.code,
        floorType: floor.type,
        bales: total.bales,
        massKg: total.massKg.toFixed(2),
        valueUsd: total.valueUsd.toFixed(2),
        averagePricePerKgUsd: total.avgPriceUsd.toFixed(4),
        byGrade: grades.map((g) => ({
          grade: g.key,
          bales: g.bales,
          massKg: g.massKg.toFixed(2),
          valueUsd: g.valueUsd.toFixed(2),
        })),
      });
      await audit(tx, actor.id, "timb.dailySummary", "Floor", floor.id, { date: range.fromLabel });
      return true;
    });
    if (queuedNow) queued++;
  }
  return queued;
}
