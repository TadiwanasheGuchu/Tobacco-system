"use client";

export function PrintButton({ label = "Print ticket" }: { label?: string }) {
  return (
    <button className="btn btn-primary" onClick={() => window.print()}>
      {label}
    </button>
  );
}
