const TONES: Record<string, { cls: string; label?: string }> = {
  RECEIVED: { cls: "bg-surface-2 text-muted" },
  GRADED: { cls: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200" },
  PRICED: { cls: "bg-accent-soft text-[#7a4f0c] dark:text-accent", label: "Awaiting grower" },
  ACCEPTED: { cls: "bg-leaf-soft text-leaf" },
  REJECTED: { cls: "bg-danger-soft text-danger" },
  WITHDRAWN: { cls: "bg-surface-2 text-muted" },
  SETTLED: { cls: "bg-leaf text-white dark:text-[#17110c]" },
  APPROVED: { cls: "bg-accent-soft text-[#7a4f0c] dark:text-accent", label: "Awaiting release" },
  PAID: { cls: "bg-leaf text-white dark:text-[#17110c]" },
  REVERSED: { cls: "bg-surface-2 text-muted" },
  PENDING: { cls: "bg-accent-soft text-[#7a4f0c] dark:text-accent" },
  SENT: { cls: "bg-leaf-soft text-leaf" },
  FAILED: { cls: "bg-danger-soft text-danger" },
};

export function StatusBadge({ status }: { status: string }) {
  const tone = TONES[status] ?? { cls: "bg-surface-2" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {tone.label ?? status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
