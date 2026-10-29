import type { ReactNode } from "react";

/** Page heading with a Lucide icon in a soft gold tile. */
export function PageTitle({ icon, title, subtitle, children }: { icon: ReactNode; title: ReactNode; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-brand" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {children && <div className="ml-auto flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}
