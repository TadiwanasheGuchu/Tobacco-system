"use client";

import { CheckCircle2, Keyboard, Loader2, PlugZap, Scale } from "lucide-react";
import { useEffect, useState } from "react";
import { agentFetch } from "@/lib/agent-client";

interface AgentReading {
  kg: string;
  stable: boolean;
  station: string;
  signed?: { station: string; kg: string; at: number; nonce: string; sig: string };
}

type State = { kind: "connecting" } | { kind: "offline" } | { kind: "live"; reading: AgentReading };

/**
 * Live weight from the reception agent. While the scale is connected the bale
 * is saved with the latest stable, signed reading (hidden "scaleReading"
 * field). Without a scale, or if the clerk switches to typing, a "massKg" field
 * appears and the bale is saved as a manual weight.
 */
export function ScaleReader({ manualAllowed, hint }: { manualAllowed: boolean; hint?: string }) {
  const [state, setState] = useState<State>({ kind: "connecting" });
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await agentFetch("/reading");
        if (!res.ok) throw new Error();
        const reading = (await res.json()) as AgentReading;
        if (!stop) setState({ kind: "live", reading });
      } catch {
        if (!stop) setState({ kind: "offline" });
      }
      if (!stop) timer = setTimeout(poll, 700);
    };
    poll();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, []);

  const showManual = manualAllowed && (typing || state.kind === "offline");

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium">Mass</span>
      {state.kind === "live" && !typing && (
        <div className={`flex items-center gap-4 rounded-xl border p-4 ${state.reading.stable ? "border-leaf bg-leaf-soft" : "border-border bg-surface-2"}`}>
          <Scale size={28} className={state.reading.stable ? "text-leaf" : "text-muted"} aria-hidden />
          <div className="flex-1">
            <div className="text-3xl font-semibold tabular-nums">{state.reading.kg} kg</div>
            <div className="flex items-center gap-1.5 text-sm">
              {state.reading.stable ? (
                <>
                  <CheckCircle2 size={14} className="text-leaf" aria-hidden /> Stable · scale {state.reading.station}
                </>
              ) : (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden /> Settling…
                </>
              )}
            </div>
          </div>
          <input type="hidden" name="scaleReading" value={state.reading.stable && state.reading.signed ? JSON.stringify(state.reading.signed) : ""} />
        </div>
      )}
      {state.kind === "connecting" && <p className="text-sm text-muted">Looking for the scale…</p>}
      {state.kind === "offline" && (
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <PlugZap size={14} aria-hidden /> Scale not connected on this PC.
          {!manualAllowed && " Ask a supervisor to weigh this bale."}
        </p>
      )}
      {showManual && (
        <label className="block text-sm">
          <input name="massKg" className="input" inputMode="decimal" placeholder="Typed weight in kg" required autoFocus={typing} />
          {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
        </label>
      )}
      {manualAllowed && state.kind === "live" && (
        <button type="button" className="btn btn-chip" onClick={() => setTyping((t) => !t)}>
          <Keyboard size={14} aria-hidden />
          {typing ? "Use the scale" : "Type the weight instead"}
        </button>
      )}
    </div>
  );
}
