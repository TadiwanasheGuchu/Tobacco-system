"use client";

import { Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { agentFetch } from "@/lib/agent-client";

/**
 * Sends the bale's ZPL ticket to the label printer through the reception agent.
 * With autoPrint, prints once when the ticket page opens after receiving a bale.
 */
export function PrintLabelButton({ ticket, autoPrint }: { ticket: string; autoPrint?: boolean }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const print = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const zpl = await fetch(`/bales/${encodeURIComponent(ticket)}/zpl`, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error("Couldn't build the label.");
        return r.text();
      });
      const res = await agentFetch("/print", { method: "POST", headers: { "Content-Type": "text/plain" }, body: zpl }, 5000);
      if (!res.ok) throw new Error((await res.text()) || "The printer didn't accept the label.");
      setMessage({ ok: true, text: "Label sent to the printer." });
    } catch (err) {
      const text = err instanceof Error && err.name !== "AbortError" && err.message !== "Failed to fetch" ? err.message : "Label printer not connected on this PC. Use Print ticket instead.";
      setMessage({ ok: false, text });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!autoPrint) return;
    // Deferred so the effect itself doesn't set state; cleared if the page unmounts first.
    const timer = setTimeout(() => {
      // Don't print again if the page is reloaded.
      const key = `tf.printed.${ticket}`;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        // Storage blocked: print anyway.
      }
      void print();
    }, 0);
    return () => clearTimeout(timer);
    // print is recreated each render; running once per ticket is what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint, ticket]);

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button type="button" className="btn btn-primary" onClick={print} disabled={busy}>
        <Tag size={16} aria-hidden />
        {busy ? "Printing…" : "Print label"}
      </button>
      {message && <span className={`text-sm ${message.ok ? "text-leaf" : "text-muted"}`}>{message.text}</span>}
    </span>
  );
}
