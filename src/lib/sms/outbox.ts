import { db, Tx } from "@/lib/db";
import { normalizeZwMobile } from "@/lib/payee";
import { getSmsProvider, smsEnabled, SmsTransientError } from "./index";

const MAX_ATTEMPTS = 6;
const LEASE_MS = 5 * 60_000;

interface SmsGrower {
  id: string;
  phone: string | null;
  mobileMoneyNumber: string | null;
  smsOptIn: boolean;
}

/**
 * Queues a text to a grower inside the caller's transaction. Skipped quietly
 * when SMS is switched off, the grower opted out, or there is no valid mobile number.
 */
export async function enqueueSms(tx: Tx, kind: string, entityId: string, grower: SmsGrower, body: string) {
  if (!smsEnabled() || !grower.smsOptIn) return;
  const to = normalizeZwMobile(grower.phone) ?? normalizeZwMobile(grower.mobileMoneyNumber);
  if (!to) return;
  await tx.smsOutbox.create({ data: { kind, entityId, growerId: grower.id, toNumber: to, body } });
}

/** Sends due texts. Same leasing approach as the TIMB outbox, so several workers are safe. */
export async function processSmsOutbox(limit = 100): Promise<{ sent: number; failed: number }> {
  const provider = getSmsProvider();
  const due = await db.smsOutbox.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let sent = 0;
  let failed = 0;
  for (const msg of due) {
    const claimed = await db.smsOutbox.updateMany({
      where: { id: msg.id, status: "PENDING", attempts: msg.attempts },
      data: { attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + LEASE_MS) },
    });
    if (claimed.count === 0) continue;
    const attempts = msg.attempts + 1;
    try {
      const { reference } = await provider.send(msg.toNumber, msg.body);
      await db.smsOutbox.update({ where: { id: msg.id }, data: { status: "SENT", sentAt: new Date(), providerRef: reference, lastError: null } });
      sent++;
    } catch (err) {
      const giveUp = !(err instanceof SmsTransientError) || attempts >= MAX_ATTEMPTS;
      await db.smsOutbox.update({
        where: { id: msg.id },
        data: {
          status: giveUp ? "FAILED" : "PENDING",
          lastError: err instanceof Error ? err.message : String(err),
          nextAttemptAt: new Date(Date.now() + Math.min(2 ** attempts, 60) * 60_000),
        },
      });
      failed++;
    }
  }
  return { sent, failed };
}
