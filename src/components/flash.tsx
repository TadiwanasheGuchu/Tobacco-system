"use client";

import { CheckCircle2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Page-level confirmation banner. Lives in the app layout so the message stays
 * visible even when the form that produced it disappears after the action
 * (e.g. the "Grower accepts" buttons once a bale is accepted).
 */
const FlashContext = createContext<((message: string) => void) | null>(null);

export function FlashProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<{ text: string; at: number } | null>(null);
  const show = useCallback((text: string) => setMessage({ text, at: Date.now() }), []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <FlashContext value={show}>
      {message && (
        <div role="status" className="fixed inset-x-0 top-3 z-50 mx-auto w-fit max-w-[90vw] rounded-md bg-brand px-4 py-2 text-sm font-medium text-[var(--brand-text)] shadow-lg print:hidden">
          <CheckCircle2 size={16} className="mr-2 inline -mt-0.5" aria-hidden />
          {message.text}
        </div>
      )}
      {children}
    </FlashContext>
  );
}

export function useFlash() {
  return useContext(FlashContext);
}
