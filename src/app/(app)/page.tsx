import Link from "next/link";
import { ArrowRight, Package, Scale, Send, TrendingUp, Wallet } from "lucide-react";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber, formatUsd } from "@/lib/money";
import { can } from "@/lib/permissions";
import { startOfToday } from "@/lib/services/common";

const STATUS_ORDER = ["RECEIVED", "GRADED", "PRICED", "ACCEPTED", "REJECTED", "WITHDRAWN", "SETTLED"] as const;
const STATUS_COLOR: Record<string, string> = {
  RECEIVED: "#cdb89a",
  GRADED: "#8fb3c9",
  PRICED: "#d6a03c",
  ACCEPTED: "#8fae5d",
  REJECTED: "#c8664f",
  WITHDRAWN: "#9c8b78",
  SETTLED: "#4f6b2c",
};
const STATUS_LABEL: Record<string, string> = {
  RECEIVED: "Waiting for grade",
  GRADED: "On sale",
  PRICED: "Waiting for grower",
  ACCEPTED: "Waiting for payment",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  SETTLED: "Paid out",
};

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const user = await requirePage();
  const { forbidden } = await searchParams;
  const since = startOfToday();

  const [received, byStatus, sold, settled, timbPending, timbFailed] = await Promise.all([
    db.bale.aggregate({ where: { receivedAt: { gte: since } }, _count: true, _sum: { massKg: true } }),
    db.bale.groupBy({ by: ["status"], where: { receivedAt: { gte: since } }, _count: true }),
    db.settlementLine.aggregate({
      where: { settlement: { createdAt: { gte: since }, status: { not: "REVERSED" } } },
      _sum: { massKg: true, valueUsd: true },
    }),
    db.settlement.aggregate({
      where: { createdAt: { gte: since }, status: { not: "REVERSED" } },
      _count: true,
      _sum: { netUsd: true },
    }),
    db.timbOutbox.count({ where: { status: "PENDING" } }),
    db.timbOutbox.count({ where: { status: "FAILED" } }),
  ]);

  const soldKg = Number(sold._sum.massKg ?? 0);
  const avgPrice = soldKg > 0 ? Number(sold._sum.valueUsd) / soldKg : 0;
  const counts = STATUS_ORDER.map((s) => ({ status: s, n: byStatus.find((b) => b.status === s)?._count ?? 0 }));
  const totalToday = counts.reduce((a, c) => a + c.n, 0);
  const firstName = user.fullName.split(/\s+/)[0];
  const today = new Date().toLocaleDateString("en-ZW", { weekday: "long", day: "numeric", month: "long" });

  const actions = [
    can(user.role, "bale.receive") && { href: "/reception", label: "Receive a bale", hint: "Weigh and print a ticket", icon: Scale },
    can(user.role, "bale.view") && { href: "/bales?status=RECEIVED", label: "Bales to grade", hint: `${counts[0].n} waiting today`, icon: Package },
    can(user.role, "settlement.create") && { href: "/settlements", label: "Pay growers", hint: "Prepare settlements", icon: Wallet },
    can(user.role, "reports.view") && { href: "/reports", label: "Today's report", hint: "Sales by grade and buyer", icon: TrendingUp },
  ].filter((a): a is { href: string; label: string; hint: string; icon: typeof Scale } => !!a);

  return (
    <div className="space-y-8">
      {forbidden && (
        <p className="card border-danger text-danger" role="alert">
          Your role ({user.role.toLowerCase()}) can&apos;t open that page.
        </p>
      )}

      <header>
        <p className="text-sm text-muted">{today}</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {greeting()}, {firstName}
        </h1>
        <p className="mt-1 text-muted">
          {totalToday === 0
            ? "The floor is quiet so far. The first bale of the day will show up here."
            : `${formatNumber(totalToday, 0)} bale${totalToday === 1 ? "" : "s"} through the floor today.`}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Bales received" value={formatNumber(received._count, 0)} sub={`${formatNumber(received._sum.massKg ?? 0, 0)} kg on the floor`} />
        <Stat label="Average price" value={formatUsd(avgPrice)} sub="per kg, settled today" highlight />
        <Stat label="Net to growers" value={formatUsd(settled._sum.netUsd ?? 0)} sub={`${settled._count} settlement${settled._count === 1 ? "" : "s"}`} />
        <Stat
          label="TIMB link"
          value={timbFailed > 0 ? `${timbFailed} failed` : timbPending > 0 ? `${timbPending} queued` : "All sent"}
          sub={timbFailed > 0 ? "Needs attention" : "Bale records reported"}
          tone={timbFailed > 0 ? "danger" : "ok"}
          icon={<Send size={16} aria-hidden />}
          href={user.role === "ADMIN" ? "/admin/timb" : undefined}
        />
      </div>

      {actions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Jump back in</h2>
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {actions.map((a) => (
              <Link key={a.href} href={a.href} className="card group flex items-center gap-4 transition-transform hover:-translate-y-0.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-brand">
                  <a.icon size={20} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{a.label}</span>
                  <span className="block truncate text-sm text-muted">{a.hint}</span>
                </span>
                <ArrowRight size={18} className="text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="card space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Where today&apos;s bales are</h2>
          <span className="text-sm text-muted">{formatNumber(totalToday, 0)} total</span>
        </div>
        {totalToday === 0 ? (
          <p className="rounded-xl bg-surface-2 p-6 text-center text-sm text-muted">No bales yet today.</p>
        ) : (
          <>
            <div className="flex h-4 overflow-hidden rounded-full bg-surface-2" role="img" aria-label="Bales by status">
              {counts
                .filter((c) => c.n > 0)
                .map((c) => (
                  <span key={c.status} style={{ width: `${(c.n / totalToday) * 100}%`, background: STATUS_COLOR[c.status] }} />
                ))}
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {counts.map((c) => (
                <li key={c.status} className={`flex items-center gap-2 ${c.n === 0 ? "opacity-50" : ""}`}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[c.status] }} aria-hidden />
                  <span className="text-muted">{STATUS_LABEL[c.status]}</span>
                  <span className="font-semibold tabular-nums">{c.n}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  highlight,
  tone,
  icon,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  tone?: "ok" | "danger";
  icon?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <div className={`card h-full ${highlight ? "border-accent bg-accent-soft" : ""}`}>
      <div className="flex items-center gap-2 text-sm text-muted">
        {icon}
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${tone === "danger" ? "text-danger" : tone === "ok" ? "text-leaf" : ""}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
