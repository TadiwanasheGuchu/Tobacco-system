import { createHmac, randomBytes } from "node:crypto";

// Must match src/lib/scale-reading.ts in the web app.
export function canonicalReading(r) {
  return `tf-scale-v1|${r.station}|${r.kg}|${r.at}|${r.nonce}`;
}

export function signReading(r, secret) {
  return createHmac("sha256", secret).update(canonicalReading(r)).digest("hex");
}

/** A fresh signed reading for a stable weight. Each call gets a new nonce, so each can be used once. */
export function makeSignedReading(station, kg, secret, now = Date.now()) {
  const r = { station, kg: Number(kg).toFixed(2), at: now, nonce: randomBytes(12).toString("base64url") };
  return { ...r, sig: signReading(r, secret) };
}
