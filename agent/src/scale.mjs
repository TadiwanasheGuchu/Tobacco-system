import { parseScaleLine, StabilityTracker } from "./scale-parser.mjs";

/**
 * Connects to the scale (serial port) or the built-in simulator and keeps the
 * latest reading. onReading is called for every parsed line.
 */
export async function startScale(cfg, log = console) {
  const tracker = new StabilityTracker(cfg.stableMs, cfg.stableToleranceKg);
  const state = { latest: null, connected: false, error: null };
  const handleLine = (line) => {
    const parsed = parseScaleLine(line, cfg.weightPattern, cfg.stablePattern);
    if (parsed) state.latest = tracker.push(parsed.kg, parsed.flagStable);
  };

  if (cfg.scalePort === "sim") {
    startSimulator(handleLine);
    state.connected = true;
    log.info?.("[scale] simulator running (no real scale)");
    return state;
  }

  const { SerialPort, ReadlineParser } = await import("serialport");
  const open = () => {
    const port = new SerialPort({ path: cfg.scalePort, baudRate: cfg.scaleBaud });
    const lines = port.pipe(new ReadlineParser({ delimiter: /\r?\n|\r/ }));
    port.on("open", () => {
      state.connected = true;
      state.error = null;
      log.info?.(`[scale] connected on ${cfg.scalePort} at ${cfg.scaleBaud} baud`);
    });
    lines.on("data", handleLine);
    port.on("error", (err) => {
      state.error = err.message;
      log.error?.(`[scale] ${err.message}`);
    });
    port.on("close", () => {
      state.connected = false;
      log.error?.("[scale] disconnected, retrying in 3 s");
      setTimeout(open, 3000);
    });
  };
  open();
  return state;
}

/** Pretends bales are put on and taken off the scale, streaming ~5 lines a second. */
export function startSimulator(onLine, rand = Math.random) {
  let phase = "empty";
  let target = 0;
  let current = 0;
  let phaseUntil = Date.now() + 1500;
  const timer = setInterval(() => {
    const now = Date.now();
    if (now > phaseUntil) {
      if (phase === "empty") {
        phase = "loading";
        target = Math.round((60 + rand() * 70) * 2) / 2;
        phaseUntil = now + 1500;
      } else if (phase === "loading") {
        phase = "steady";
        phaseUntil = now + 8000;
      } else {
        phase = "empty";
        target = 0;
        phaseUntil = now + 2500;
      }
    }
    const noise = phase === "steady" ? 0 : (rand() - 0.5) * 3;
    current = phase === "loading" ? current + (target - current) * 0.5 + noise : target;
    const flag = phase === "steady" || phase === "empty" ? "ST" : "US";
    onLine(`${flag},GS,${current >= 0 ? "+" : "-"}${Math.abs(current).toFixed(2).padStart(7, " ")}kg`);
  }, 200);
  return () => clearInterval(timer);
}
