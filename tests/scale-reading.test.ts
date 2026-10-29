import { describe, expect, it } from "vitest";
import { signReading, verifyReading } from "@/lib/scale-reading";

const SECRET = "test-secret-0123456789abcdef";
const NOW = 1_800_000_000_000;
const base = { station: "HAF-R1", kg: "98.50", at: NOW - 5_000, nonce: "abcdefghijklmnop1234" };
const signed = () => ({ ...base, sig: signReading(base, SECRET) });

describe("verifyReading", () => {
  it("accepts a fresh, correctly signed reading", () => {
    const r = verifyReading(JSON.stringify(signed()), SECRET, NOW);
    expect(r.ok).toBe(true);
  });

  it("matches the agent's signature format", () => {
    // Same vector is checked in agent/test/sign.test.mjs.
    expect(signReading(base, SECRET)).toBe("229ea6d78cfbac9dee7d7bdc9fe769ac2747daa63f431fa338de100d13a8ffcc");
  });

  it("rejects a changed weight", () => {
    const r = verifyReading({ ...signed(), kg: "120.00" }, SECRET, NOW);
    expect(r).toMatchObject({ ok: false });
  });

  it("rejects the wrong station secret", () => {
    expect(verifyReading(signed(), "other-secret", NOW).ok).toBe(false);
  });

  it("rejects old and future readings", () => {
    expect(verifyReading(signed(), SECRET, NOW + 3 * 60_000).ok).toBe(false);
    const future = { ...base, at: NOW + 60_000 };
    expect(verifyReading({ ...future, sig: signReading(future, SECRET) }, SECRET, NOW).ok).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(verifyReading("not json", SECRET, NOW).ok).toBe(false);
    expect(verifyReading({ ...signed(), kg: "98.5" }, SECRET, NOW).ok).toBe(false);
  });
});
