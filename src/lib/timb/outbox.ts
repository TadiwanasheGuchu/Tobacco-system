import { db, Tx } from "@/lib/db";
import { getTimbAdapter, TimbMessageType, TimbTransientError } from "./index";

const MAX_ATTEMPTS = 10;
const LEASE_MS = 5 * 60_000;

/** Queue a message for TIMB inside the caller's transaction. */
export async function enqueueTimb(tx: Tx, type: TimbMessageType, entityId: string, payload: object) {
  await tx.timbOutbox.create({ data: { messageType: type, entityId, payload } });
}

export function retryDelayMs(attempts: number): number {
  // 1, 2, 4, 8 ... minutes, capped at an hour.
  return Math.min(2 ** Math.max(attempts - 1, 0), 60) * 60_000;
}

/**
 * Deliver due messages. Each message is claimed with a short lease (by bumping
 * attempts and nextAttemptAt in a conditional update), so several workers can
 * run without sending the same message at the same time.
 */
export async function processOutbox(limit = 50): Promise<{ sent: number; failed: number }> {
  const adapter = getTimbAdapter();
  const due = await db.timbOutbox.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  for (const msg of due) {
    const claimed = await db.timbOutbox.updateMany({
      where: { id: msg.id, status: "PENDING", attempts: msg.attempts },
      data: { attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + LEASE_MS) },
    });
    if (claimed.count === 0) continue;

    const attempts = msg.attempts + 1;
    try {
      const result = await adapter.submit({
        id: msg.id,
        type: msg.messageType as TimbMessageType,
        payload: msg.payload,
      });
      await db.timbOutbox.update({
        where: { id: msg.id },
        data: { status: "SENT", sentAt: new Date(), timbReference: result.reference, lastError: null },
      });
      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const giveUp = !(err instanceof TimbTransientError) || attempts >= MAX_ATTEMPTS;
      await db.timbOutbox.update({
        where: { id: msg.id },
        data: {
          status: giveUp ? "FAILED" : "PENDING",
          lastError: message,
          nextAttemptAt: new Date(Date.now() + retryDelayMs(attempts)),
        },
      });
      failed++;
    }
  }
  return { sent, failed };
}
