"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print ticket", primary = true }: { label?: string; primary?: boolean }) {
  return (
    <button className={primary ? "btn btn-primary" : "btn"} onClick={() => window.print()}>
      <Printer size={16} aria-hidden />
      {label}
    </button>
  );
}
