/**
 * Delivers queued messages: TIMB records and grower text messages. Run one per
 * site alongside the web app (more than one is safe):
 *
 *   npm run worker
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { processSmsOutbox } from "../src/lib/sms/outbox";
import { processOutbox } from "../src/lib/timb/outbox";

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? process.env.TIMB_WORKER_INTERVAL_MS ?? 10_000);
let stopping = false;

async function tick(name: string, run: () => Promise<{ sent: number; failed: number }>) {
  try {
    const { sent, failed } = await run();
    if (sent || failed) console.log(`[${name}] sent ${sent}, failed ${failed}`);
  } catch (err) {
    console.error(`[${name}] worker error`, err);
  }
}

async function loop() {
  while (!stopping) {
    await tick("timb", processOutbox);
    await tick("sms", processSmsOutbox);
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
  await db.$disconnect();
}

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => (stopping = true));
console.log(`[worker] started (TIMB: ${process.env.TIMB_MODE ?? "mock"}, SMS: ${process.env.SMS_ENABLED === "false" ? "off" : (process.env.SMS_MODE ?? "mock")})`);
loop();
