/**
 * Delivers queued TIMB messages. Run one per site alongside the web app:
 *
 *   npm run worker
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { processOutbox } from "../src/lib/timb/outbox";

const INTERVAL_MS = Number(process.env.TIMB_WORKER_INTERVAL_MS ?? 10_000);
let stopping = false;

async function loop() {
  while (!stopping) {
    try {
      const { sent, failed } = await processOutbox();
      if (sent || failed) console.log(`[timb] sent ${sent}, failed ${failed}`);
    } catch (err) {
      console.error("[timb] worker error", err);
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
  await db.$disconnect();
}

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => (stopping = true));
console.log(`[timb] worker started (mode: ${process.env.TIMB_MODE ?? "mock"})`);
loop();
