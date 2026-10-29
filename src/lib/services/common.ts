import { Tx } from "@/lib/db";

/** A rule violation whose message is safe to show to the user. */
export class DomainError extends Error {}

export interface Actor {
  id: string;
  role: string;
  buyerId: string | null;
}

export async function activeSeason(tx: Tx) {
  const season = await tx.season.findFirst({ where: { active: true } });
  if (!season) throw new DomainError("No marketing season is open. An admin must open one first.");
  return season;
}

/** Locks a bale row for the rest of the transaction so concurrent actions queue up. */
export async function lockBale(tx: Tx, baleId: string) {
  await tx.$queryRaw`SELECT id FROM "Bale" WHERE id = ${baleId} FOR UPDATE`;
  const bale = await tx.bale.findUnique({
    where: { id: baleId },
    include: { floor: true, grower: true, contract: true, currentOffer: true },
  });
  if (!bale) throw new DomainError("Bale not found.");
  return bale;
}

export function startOfToday(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}
