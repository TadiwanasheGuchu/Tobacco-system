"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print ticket" }: { label?: string }) {
  return (
    <button className="btn btn-primary" onClick={() => window.print()}>
      <Printer size={16} aria-hidden />
      {label}
    </button>
  );
}
