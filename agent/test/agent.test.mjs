import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseScaleLine, StabilityTracker } from "../src/scale-parser.mjs";
import { createAgentServer } from "../src/server.mjs";
import { makeSignedReading, signReading } from "../src/sign.mjs";

const W = /([-+]?\s*\d+(?:\.\d+)?)\s*kg/i;

test("parses common indicator lines", () => {
  assert.deepEqual(parseScaleLine("ST,GS,+  98.50kg", W, /^ST/), { kg: 98.5, flagStable: true });
  assert.deepEqual(parseScaleLine("US,GS,+ 101.20kg", W, /^ST/), { kg: 101.2, flagStable: false });
  assert.deepEqual(parseScaleLine("  97.0 kg", W, null), { kg: 97, flagStable: null });
  assert.equal(parseScaleLine("garbage", W, null), null);
});

test("weight is stable only after staying within tolerance long enough", () => {
  const t = new StabilityTracker(1000, 0.05);
  assert.equal(t.push(98.5, null, 0).stable, false);
  assert.equal(t.push(98.52, null, 600).stable, false);
  assert.equal(t.push(98.48, null, 1000).stable, true);
  assert.equal(t.push(99.0, null, 1100).stable, false); // moved: starts again
  assert.equal(t.push(99.0, false, 2500).stable, false); // indicator says unstable
});

test("signature matches the web app's test vector", () => {
  const base = { station: "HAF-R1", kg: "98.50", at: 1_800_000_000_000 - 5_000, nonce: "abcdefghijklmnop1234" };
  // Same vector as tests/scale-reading.test.ts in the web app.
  assert.equal(signReading(base, "test-secret-0123456789abcdef"), "229ea6d78cfbac9dee7d7bdc9fe769ac2747daa63f431fa338de100d13a8ffcc");
  const a = makeSignedReading("HAF-R1", 98.5, "s");
  const b = makeSignedReading("HAF-R1", 98.5, "s");
  assert.notEqual(a.nonce, b.nonce);
  assert.equal(a.kg, "98.50");
});

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`)));
}

test("local API: only the floor app's origin, signed stable readings, ZPL printing", async (t) => {
  const file = join(tmpdir(), `tf-labels-${process.pid}.zpl`);
  const cfg = { stationCode: "HAF-R1", stationSecret: "s3cret", allowedOrigins: ["https://floor.example"], minSignKg: 5, printer: `file:${file}` };
  const scale = { connected: true, error: null, latest: { kg: 98.5, stable: true, at: Date.now() } };
  const server = createAgentServer(cfg, scale);
  const base = await listen(server);
  t.after(() => {
    server.close();
    rmSync(file, { force: true });
  });
  const ok = { headers: { Origin: "https://floor.example" } };

  const evil = await fetch(`${base}/reading`, { headers: { Origin: "https://evil.example" } });
  assert.equal(evil.status, 403);

  const pre = await fetch(`${base}/print`, { method: "OPTIONS", headers: { Origin: "https://floor.example" } });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-private-network"), "true");

  const r = await (await fetch(`${base}/reading`, ok)).json();
  assert.equal(r.kg, "98.50");
  assert.equal(r.signed.station, "HAF-R1");
  assert.equal(r.signed.sig, signReading(r.signed, "s3cret"));

  scale.latest = { kg: 98.5, stable: false, at: Date.now() };
  assert.equal((await (await fetch(`${base}/reading`, ok)).json()).signed, undefined);

  scale.latest = { kg: 0.2, stable: true, at: Date.now() };
  assert.equal((await (await fetch(`${base}/reading`, ok)).json()).signed, undefined, "empty scale isn't signed");

  scale.latest = { kg: 98.5, stable: true, at: Date.now() - 10_000 };
  assert.equal((await fetch(`${base}/reading`, ok)).status, 503, "stale data");

  const bad = await fetch(`${base}/print`, { method: "POST", body: "hello", ...ok });
  assert.equal(bad.status, 400);
  const noOrigin = await fetch(`${base}/print`, { method: "POST", body: "^XA^XZ" });
  assert.equal(noOrigin.status, 403);
  const printed = await fetch(`${base}/print`, { method: "POST", body: "^XA^FDtest^FS^XZ\n", ...ok });
  assert.equal(printed.status, 200);
  assert.match(readFileSync(file, "utf8"), /\^FDtest/);
});
