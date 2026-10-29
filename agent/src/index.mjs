import { loadConfig } from "./config.mjs";
import { startScale } from "./scale.mjs";
import { createAgentServer } from "./server.mjs";

const cfg = loadConfig();
const scale = await startScale(cfg);
const server = createAgentServer(cfg, scale);
server.listen(cfg.port, "127.0.0.1", () => {
  console.log(`[agent] station ${cfg.stationCode} listening on http://127.0.0.1:${cfg.port}`);
  console.log(`[agent] accepting the floor app from ${cfg.allowedOrigins.join(", ")}`);
  console.log(`[agent] printer: ${cfg.printer}`);
});
