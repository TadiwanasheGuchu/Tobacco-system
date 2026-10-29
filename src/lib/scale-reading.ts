import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed scale readings.
 *
 * The reception agent (agent/) reads the scale and signs each stable weight
 * with its station secret. The browser only carries the signed reading to the
 * server, so a weight marked "from the scale" can't be typed or edited in the
 * browser. The same format is implemented in agent/src/sign.mjs.
 */

export interface ScaleReading {
  station: string;
  /** Kilograms with exactly 2 decimals, as a string, e.g. "98.50". */
  kg: string;
  /** Epoch milliseconds when the agent signed it. */
  at: number;
  nonce: string;
  sig: string;
}

export function canonicalReading(r: Omit<ScaleReading, "sig">): string {
  return `tf-scale-v1|${r.station}|${r.kg}|${r.at}|${r.nonce}`;
}

export function signReading(r: Omit<ScaleReading, "sig">, secret: string): string {
  return createHmac("sha256", secret).update(canonicalReading(r)).digest("hex");
}

export type VerifyResult = { ok: true; reading: ScaleReading } | { ok: false; reason: string };

const MAX_AGE_MS = 2 * 60_000;
const MAX_CLOCK_SKEW_MS = 30_000;

/** Parses and checks a reading the browser sent. Does not check nonce reuse (the database does). */
export function verifyReading(raw: unknown, secret: string, now = Date.now()): VerifyResult {
  let r: ScaleReading;
  try {
    r = typeof raw === "string" ? JSON.parse(raw) : (raw as ScaleReading);
  } catch {
    return { ok: false, reason: "The scale reading is damaged. Read the scale again." };
  }
  if (
    !r ||
    typeof r.station !== "string" ||
    typeof r.kg !== "string" ||
    !/^\d{1,4}\.\d{2}$/.test(r.kg) ||
    typeof r.at !== "number" ||
    typeof r.nonce !== "string" ||
    !/^[A-Za-z0-9_-]{16,64}$/.test(r.nonce) ||
    typeof r.sig !== "string" ||
    !/^[0-9a-f]{64}$/.test(r.sig)
  ) {
    return { ok: false, reason: "The scale reading is incomplete. Read the scale again." };
  }
  const expected = Buffer.from(signReading(r, secret), "hex");
  const given = Buffer.from(r.sig, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: "The scale reading's signature doesn't match this station. It may have been altered." };
  }
  if (r.at > now + MAX_CLOCK_SKEW_MS) return { ok: false, reason: "The scale PC's clock is ahead. Check its date and time." };
  if (now - r.at > MAX_AGE_MS) return { ok: false, reason: "The scale reading is too old. Read the scale again." };
  return { ok: true, reading: r };
}
