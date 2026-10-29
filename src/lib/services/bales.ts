import { z } from "zod";
import type { BaleStatus, GradingKind } from "@/generated/prisma/enums";
import { audit, db, nextSequence, Tx } from "@/lib/db";
import { dec, formatPricePerKg } from "@/lib/money";
import { verifyReading } from "@/lib/scale-reading";
import { formatTicketNumber } from "@/lib/ticket";
import { baleSoldSms } from "@/lib/sms/messages";
import { enqueueSms } from "@/lib/sms/outbox";
import { enqueueTimb } from "@/lib/timb/outbox";
import { activeSeason, Actor, DomainError, lockBale } from "./common";

const MIN_BALE_KG = Number(process.env.BALE_MIN_KG ?? 20);
const MAX_BALE_KG = Number(process.env.BALE_MAX_KG ?? 150);

const priceString = z
  .string()
  .trim()
  .refine((v) => /^\d+(\.\d{1,4})?$/.test(v) && Number(v) > 0, "Enter a price per kg in USD, e.g. 3.85.");

const massString = z
  .string()
  .trim()
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Enter the mass in kg, e.g. 98.5.")
  .refine(
    (v) => Number(v) >= MIN_BALE_KG && Number(v) <= MAX_BALE_KG,
    `Bale mass must be between ${MIN_BALE_KG} and ${MAX_BALE_KG} kg.`,
  );

export const receiveSchema = z.object({
  timbGrowerNumber: z.string().trim().toUpperCase().min(1, "Enter the grower number."),
  floorId: z.string().min(1, "Choose the floor."),
  contractId: z.string().optional(),
  /** Typed mass, used only when there is no signed scale reading. */
  massKg: z.string().trim().optional(),
  /** Signed reading from the reception agent (JSON), when the bale was weighed on a scale. */
  scaleReading: z.string().trim().optional(),
  lane: z.string().trim().optional(),
});

/**
 * Whether typed weights are accepted. Set ALLOW_MANUAL_WEIGHTS=false once every
 * reception desk has a working scale; supervisors can still type a weight
 * (e.g. when a scale breaks), and those bales stay marked MANUAL.
 */
export function manualWeightAllowed(role: string) {
  return process.env.ALLOW_MANUAL_WEIGHTS !== "false" || role === "SUPERVISOR" || role === "ADMIN";
}

export async function receiveBale(actor: Actor, input: z.input<typeof receiveSchema>) {
  const data = receiveSchema.parse(input);
  return db.$transaction(async (tx) => {
    const season = await activeSeason(tx);
    const floor = await tx.floor.findUnique({ where: { id: data.floorId } });
    if (!floor?.active) throw new DomainError("Floor not found or closed.");

    const grower = await tx.grower.findUnique({ where: { timbGrowerNumber: data.timbGrowerNumber } });
    if (!grower) throw new DomainError("No grower with that TIMB number. Register the grower first.");
    if (grower.status !== "ACTIVE") throw new DomainError("This grower is suspended and cannot sell.");
    if (!grower.timbVerifiedAt) throw new DomainError("This grower has not been verified with TIMB yet.");

    let contractId: string | null = null;
    if (floor.type === "CONTRACT") {
      const contract = data.contractId
        ? await tx.contract.findUnique({ where: { id: data.contractId } })
        : await tx.contract.findFirst({ where: { growerId: grower.id, seasonId: season.id } });
      if (!contract || contract.growerId !== grower.id || contract.seasonId !== season.id) {
        throw new DomainError("This grower has no contract for this season, so cannot sell on a contract floor.");
      }
      contractId = contract.id;
    }

    // Weight: a signed scale reading wins; otherwise a typed weight, if allowed.
    let massKg: string;
    let weighSource: "SCALE" | "MANUAL";
    let scale: { stationId: string; readingId: string } | null = null;
    if (data.scaleReading) {
      const parsed = JSON.parse(data.scaleReading) as { station?: string };
      const station = parsed?.station ? await tx.scaleStation.findUnique({ where: { code: parsed.station } }) : null;
      if (!station?.active) throw new DomainError("This scale station isn't registered or has been switched off.");
      if (station.floorId !== floor.id) throw new DomainError(`Scale ${station.code} belongs to a different floor.`);
      const check = verifyReading(data.scaleReading, station.secret);
      if (!check.ok) throw new DomainError(check.reason);
      if (await tx.bale.findUnique({ where: { scaleReadingId: check.reading.nonce } })) {
        throw new DomainError("That scale reading was already used for another bale. Weigh this bale again.");
      }
      massKg = massString.parse(check.reading.kg);
      weighSource = "SCALE";
      scale = { stationId: station.id, readingId: check.reading.nonce };
      await tx.scaleStation.update({ where: { id: station.id }, data: { lastUsedAt: new Date() } });
    } else {
      if (!manualWeightAllowed(actor.role)) {
        throw new DomainError("Weights must come from the scale. Ask a supervisor if the scale isn't working.");
      }
      massKg = massString.parse(data.massKg ?? "");
      weighSource = "MANUAL";
    }

    const seq = await nextSequence(tx, `ticket:${floor.code}:${season.year}`);
    const bale = await tx.bale.create({
      data: {
        ticketNumber: formatTicketNumber(floor.code, season.year, seq),
        growerId: grower.id,
        floorId: floor.id,
        seasonId: season.id,
        contractId,
        massKg: dec(massKg).toFixed(2),
        weighSource,
        scaleStationId: scale?.stationId ?? null,
        scaleReadingId: scale?.readingId ?? null,
        lane: data.lane || null,
        receivedById: actor.id,
      },
    });
    await audit(tx, actor.id, "bale.receive", "Bale", bale.id, { massKg, weighSource, scaleStationId: scale?.stationId });
    await enqueueTimb(tx, "BALE_RECEIVED", bale.id, {
      ticketNumber: bale.ticketNumber,
      timbGrowerNumber: grower.timbGrowerNumber,
      floorCode: floor.code,
      massKg,
      weighSource,
      receivedAt: bale.receivedAt.toISOString(),
    });
    return bale;
  });
}

const GRADABLE: BaleStatus[] = ["RECEIVED", "GRADED", "PRICED"];

export async function gradeBale(actor: Actor, baleId: string, gradeCode: string, kind: GradingKind) {
  return db.$transaction(async (tx) => {
    const bale = await lockBale(tx, baleId);
    if (!GRADABLE.includes(bale.status)) throw new DomainError(`A ${bale.status.toLowerCase()} bale cannot be graded.`);
    const grade = await tx.grade.findUnique({ where: { code: gradeCode.trim().toUpperCase() } });
    if (!grade?.active) throw new DomainError("Unknown grade code.");

    await tx.baleGrading.create({ data: { baleId, gradeId: grade.id, kind, gradedById: actor.id } });
    await audit(tx, actor.id, "bale.grade", "Bale", baleId, { kind, grade: grade.code });

    // On auction floors a buyer's own grade is only advisory; on contract floors it sets the price.
    if (kind === "BUYER" && bale.floor.type === "AUCTION") return { priced: false };
    const hasTimbGrade = kind === "TIMB" || (await latestGrading(tx, baleId, "TIMB")) !== null;
    if (!hasTimbGrade) return { priced: false };

    // A new grade invalidates any price already offered on the old grade.
    await tx.bale.update({ where: { id: baleId }, data: { status: "GRADED", currentOfferId: null } });

    if (bale.floor.type === "CONTRACT") return { priced: await applyContractPrice(tx, actor, baleId) };
    return { priced: false };
  });
}

async function latestGrading(tx: Tx, baleId: string, kind: GradingKind) {
  return tx.baleGrading.findFirst({
    where: { baleId, kind },
    orderBy: { createdAt: "desc" },
    include: { grade: true },
  });
}

/** Grade used for pricing: the contractor's grade when given, otherwise TIMB's. */
async function pricingGrade(tx: Tx, baleId: string) {
  return (await latestGrading(tx, baleId, "BUYER")) ?? (await latestGrading(tx, baleId, "TIMB"));
}

/** Prices a contract-floor bale from the contractor's price list. Returns false if no price is listed. */
async function applyContractPrice(tx: Tx, actor: Actor, baleId: string): Promise<boolean> {
  const bale = await tx.bale.findUniqueOrThrow({ where: { id: baleId }, include: { contract: true } });
  if (!bale.contract) return false;
  const grading = await pricingGrade(tx, baleId);
  if (!grading) return false;
  const price = await tx.gradePrice.findFirst({
    where: {
      gradeId: grading.gradeId,
      buyerId: bale.contract.buyerId,
      seasonId: bale.seasonId,
      effectiveFrom: { lte: new Date() },
    },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!price) return false;
  const offer = await tx.baleOffer.create({
    data: {
      baleId,
      buyerId: bale.contract.buyerId,
      pricePerKgUsd: price.pricePerKgUsd,
      source: "CONTRACT_PRICE",
      createdById: actor.id,
    },
  });
  await tx.bale.update({ where: { id: baleId }, data: { status: "PRICED", currentOfferId: offer.id } });
  return true;
}

export async function placeBid(actor: Actor, baleId: string, buyerId: string, pricePerKgUsd: string, anyBuyer: boolean) {
  const price = dec(priceString.parse(pricePerKgUsd));
  return db.$transaction(async (tx) => {
    const bale = await lockBale(tx, baleId);
    if (bale.floor.type !== "AUCTION") throw new DomainError("Bids are only taken on auction floors.");
    if (bale.status !== "GRADED" && bale.status !== "PRICED") {
      throw new DomainError("Only graded bales that are still on sale can take bids.");
    }
    if (!anyBuyer && buyerId !== actor.buyerId) throw new DomainError("You can only bid for your own company.");
    const buyer = await tx.buyer.findUnique({ where: { id: buyerId } });
    if (!buyer?.active) throw new DomainError("Buyer not found or not licensed.");
    if (bale.currentOffer && price.lte(dec(bale.currentOffer.pricePerKgUsd))) {
      throw new DomainError(`Bid must be higher than the current ${formatPricePerKg(bale.currentOffer.pricePerKgUsd)}/kg.`);
    }
    const offer = await tx.baleOffer.create({
      data: { baleId, buyerId, pricePerKgUsd: price.toFixed(4), source: "AUCTION_BID", createdById: actor.id },
    });
    await tx.bale.update({ where: { id: baleId }, data: { status: "PRICED", currentOfferId: offer.id } });
    await audit(tx, actor.id, "bale.bid", "Bale", baleId, { buyerId, pricePerKgUsd: price.toFixed(4) });
  });
}

export async function overridePrice(actor: Actor, baleId: string, pricePerKgUsd: string, reason: string, buyerId?: string) {
  const price = dec(priceString.parse(pricePerKgUsd));
  if (reason.trim().length < 5) throw new DomainError("Give a reason for the price override.");
  return db.$transaction(async (tx) => {
    const bale = await lockBale(tx, baleId);
    if (bale.status !== "GRADED" && bale.status !== "PRICED") {
      throw new DomainError("Only graded bales that are still on sale can be priced.");
    }
    const offerBuyerId = bale.contract?.buyerId ?? buyerId;
    if (!offerBuyerId) throw new DomainError("Choose the buyer.");
    const offer = await tx.baleOffer.create({
      data: {
        baleId,
        buyerId: offerBuyerId,
        pricePerKgUsd: price.toFixed(4),
        source: "SUPERVISOR_OVERRIDE",
        createdById: actor.id,
        reason: reason.trim(),
      },
    });
    await tx.bale.update({ where: { id: baleId }, data: { status: "PRICED", currentOfferId: offer.id } });
    await audit(tx, actor.id, "bale.priceOverride", "Bale", baleId, { pricePerKgUsd: price.toFixed(4), reason });
  });
}

/** Records the grower's answer to the offered price. */
export async function recordDecision(actor: Actor, baleId: string, accept: boolean) {
  return db.$transaction(async (tx) => {
    const bale = await lockBale(tx, baleId);
    if (bale.status !== "PRICED" || !bale.currentOffer) throw new DomainError("This bale has no price waiting for a decision.");
    const timbGrade = await latestGrading(tx, baleId, "TIMB");
    const buyer = await tx.buyer.findUniqueOrThrow({ where: { id: bale.currentOffer.buyerId } });

    await tx.bale.update({
      where: { id: baleId },
      data: { status: accept ? "ACCEPTED" : "REJECTED", decisionAt: new Date() },
    });
    await audit(tx, actor.id, accept ? "bale.accept" : "bale.reject", "Bale", baleId, {
      offerId: bale.currentOffer.id,
    });
    if (accept) {
      await enqueueSms(
        tx,
        "BALE_SOLD",
        baleId,
        bale.grower,
        baleSoldSms({
          floorCode: bale.floor.code,
          ticket: bale.ticketNumber,
          massKg: bale.massKg,
          grade: timbGrade?.grade.code ?? null,
          pricePerKg: bale.currentOffer.pricePerKgUsd,
          buyerCode: buyer.code,
        }),
      );
    }
    await enqueueTimb(tx, accept ? "BALE_SOLD" : "BALE_REJECTED", baleId, {
      ticketNumber: bale.ticketNumber,
      timbGrowerNumber: bale.grower.timbGrowerNumber,
      floorCode: bale.floor.code,
      floorType: bale.floor.type,
      massKg: bale.massKg.toString(),
      timbGrade: timbGrade?.grade.code ?? null,
      buyerLicense: buyer.timbLicenseNumber,
      pricePerKgUsd: bale.currentOffer.pricePerKgUsd.toString(),
      contractNumber: bale.contract?.contractNumber ?? null,
      decidedAt: new Date().toISOString(),
    });
  });
}

/** A rejected bale goes back on sale for new bids or a re-price. */
export async function reofferBale(actor: Actor, baleId: string) {
  return db.$transaction(async (tx) => {
    const bale = await lockBale(tx, baleId);
    if (bale.status !== "REJECTED") throw new DomainError("Only rejected bales can be re-offered.");
    await tx.bale.update({ where: { id: baleId }, data: { status: "GRADED", currentOfferId: null, decisionAt: null } });
    await audit(tx, actor.id, "bale.reoffer", "Bale", baleId);
    if (bale.floor.type === "CONTRACT") await applyContractPrice(tx, actor, baleId);
  });
}

export async function withdrawBale(actor: Actor, baleId: string) {
  return db.$transaction(async (tx) => {
    const bale = await lockBale(tx, baleId);
    if (bale.status !== "REJECTED") throw new DomainError("Only rejected bales can be withdrawn from the floor.");
    await tx.bale.update({ where: { id: baleId }, data: { status: "WITHDRAWN" } });
    await audit(tx, actor.id, "bale.withdraw", "Bale", baleId);
  });
}
