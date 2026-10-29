import { readFileSync, existsSync } from "node:fs";

/** Loads agent settings from environment variables, with an optional .env file next to package.json. */
export function loadConfig(env = process.env, envFile = new URL("../.env", import.meta.url)) {
  const fileVars = {};
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*(#.*)?$/);
      if (m) fileVars[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
    }
  }
  const get = (k, d) => env[k] ?? fileVars[k] ?? d;
  const cfg = {
    stationCode: get("STATION_CODE"),
    stationSecret: get("STATION_SECRET"),
    allowedOrigins: String(get("ALLOWED_ORIGIN", "")).split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean),
    port: Number(get("PORT", 7171)),
    scalePort: get("SCALE_PORT", "sim"),
    scaleBaud: Number(get("SCALE_BAUD", 9600)),
    weightPattern: new RegExp(get("WEIGHT_PATTERN", "([-+]?\\s*\\d+(?:\\.\\d+)?)\\s*kg"), "i"),
    stablePattern: get("STABLE_PATTERN") ? new RegExp(get("STABLE_PATTERN"), "i") : null,
    stableMs: Number(get("STABLE_MS", 1000)),
    stableToleranceKg: Number(get("STABLE_TOLERANCE_KG", 0.05)),
    minSignKg: Number(get("MIN_SIGN_KG", 5)),
    printer: get("PRINTER", "none"),
  };
  const missing = ["stationCode", "stationSecret"].filter((k) => !cfg[k]);
  if (missing.length) throw new Error(`Missing settings: ${missing.map((k) => k.replace(/[A-Z]/g, (c) => "_" + c).toUpperCase()).join(", ")}`);
  if (cfg.allowedOrigins.length === 0) throw new Error("Set ALLOWED_ORIGIN to the floor server's address, e.g. https://floor.example.co.zw");
  return cfg;
}
