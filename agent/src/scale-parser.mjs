/**
 * Parses one line from the scale indicator. Most indicators send a continuous
 * stream such as "ST,GS,+  98.50kg" (ST = stable, US = unstable) or "  98.50 kg".
 * WEIGHT_PATTERN / STABLE_PATTERN in .env adapt this to a particular indicator.
 */
export function parseScaleLine(line, weightPattern, stablePattern) {
  const m = line.match(weightPattern);
  if (!m) return null;
  const kg = Number(m[1].replace(/\s+/g, ""));
  if (!Number.isFinite(kg)) return null;
  return { kg, flagStable: stablePattern ? stablePattern.test(line) : null };
}

/**
 * Decides when a weight has settled: readings must stay within a tolerance for
 * a minimum time, and the indicator's own stable flag must agree (if it sends one).
 */
export class StabilityTracker {
  constructor(stableMs, toleranceKg) {
    this.stableMs = stableMs;
    this.toleranceKg = toleranceKg;
    this.anchorKg = null;
    this.anchorAt = 0;
    this.last = null;
  }

  push(kg, flagStable, now = Date.now()) {
    if (this.anchorKg === null || Math.abs(kg - this.anchorKg) > this.toleranceKg) {
      this.anchorKg = kg;
      this.anchorAt = now;
    }
    const settled = now - this.anchorAt >= this.stableMs;
    this.last = { kg, at: now, stable: settled && flagStable !== false };
    return this.last;
  }
}
