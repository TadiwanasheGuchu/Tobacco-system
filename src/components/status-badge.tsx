const COLORS: Record<string, string> = {
  RECEIVED: "bg-slate-200 text-slate-800",
  GRADED: "bg-sky-100 text-sky-900",
  PRICED: "bg-amber-100 text-amber-900",
  ACCEPTED: "bg-emerald-100 text-emerald-900",
  REJECTED: "bg-rose-100 text-rose-900",
  WITHDRAWN: "bg-zinc-200 text-zinc-700",
  SETTLED: "bg-green-700 text-white",
  APPROVED: "bg-amber-100 text-amber-900",
  PAID: "bg-green-700 text-white",
  REVERSED: "bg-zinc-200 text-zinc-700",
  PENDING: "bg-amber-100 text-amber-900",
  SENT: "bg-emerald-100 text-emerald-900",
  FAILED: "bg-rose-100 text-rose-900",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${COLORS[status] ?? "bg-zinc-200"}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
