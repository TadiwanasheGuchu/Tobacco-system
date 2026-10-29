import http from "node:http";
import { sendToPrinter, PrinterError } from "./printer.mjs";
import { makeSignedReading } from "./sign.mjs";

const MAX_ZPL_BYTES = 64 * 1024;
const STALE_MS = 3000;

/**
 * Local HTTP API used by the floor web app in this PC's browser. Listens on
 * 127.0.0.1 only and answers only the configured floor server origin(s), so
 * other websites can't read the scale or print.
 */
export function createAgentServer(cfg, scale, { now = () => Date.now() } = {}) {
  return http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const allowed = origin && cfg.allowedOrigins.includes(origin.replace(/\/$/, ""));
    const send = (status, body, type = "application/json") => {
      const headers = { "Content-Type": type, "Cache-Control": "no-store", Vary: "Origin" };
      if (allowed) {
        headers["Access-Control-Allow-Origin"] = origin;
        headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
        headers["Access-Control-Allow-Headers"] = "Content-Type";
        // Chrome's Private Network Access: lets an https page call this local agent.
        headers["Access-Control-Allow-Private-Network"] = "true";
      }
      res.writeHead(status, headers);
      res.end(typeof body === "string" ? body : JSON.stringify(body));
    };

    if (origin && !allowed) return send(403, { error: "Origin not allowed" });
    if (req.method === "OPTIONS") return send(204, "");

    if (req.method === "GET" && req.url === "/health") {
      return send(200, { ok: true, station: cfg.stationCode, scaleConnected: scale.connected, scaleError: scale.error, printer: cfg.printer !== "none" });
    }

    if (req.method === "GET" && req.url === "/reading") {
      const r = scale.latest;
      if (!r || now() - r.at > STALE_MS) return send(503, { error: "No data from the scale" });
      const body = { station: cfg.stationCode, kg: r.kg.toFixed(2), stable: r.stable, at: r.at };
      if (r.stable && r.kg >= cfg.minSignKg) body.signed = makeSignedReading(cfg.stationCode, r.kg, cfg.stationSecret, now());
      return send(200, body);
    }

    if (req.method === "POST" && req.url === "/print") {
      // Only the floor web app may print: browsers always send Origin on cross-origin POSTs.
      if (!allowed) return send(403, "Origin not allowed", "text/plain");
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_ZPL_BYTES) return send(413, "Label too large", "text/plain");
        chunks.push(chunk);
      }
      const zpl = Buffer.concat(chunks).toString("utf8");
      if (!/^\s*\^XA[\s\S]*\^XZ\s*$/.test(zpl)) return send(400, "Not a ZPL label", "text/plain");
      try {
        await sendToPrinter(cfg.printer, zpl);
        return send(200, "Printed", "text/plain");
      } catch (err) {
        return send(err instanceof PrinterError ? err.status : 500, err.message, "text/plain");
      }
    }

    send(404, { error: "Not found" });
  });
}
