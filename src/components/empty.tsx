import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

/** Friendly empty state for lists and tables. */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center justify-center gap-2 py-4 text-sm text-muted">
      <Inbox size={16} aria-hidden />
      {children}
    </span>
  );
}
