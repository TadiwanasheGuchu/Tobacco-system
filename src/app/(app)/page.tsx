import Link from "next/link";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber, formatUsd } from "@/lib/money";
import { startOfToday } from "@/lib/services/common";

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

  const soldKg = sold._sum.massKg ?? 0;
  const avgPrice = Number(soldKg) > 0 ? Number(sold._sum.valueUsd) / Number(soldKg) : 0;

  return (
    <div className="space-y-6">
      {forbidden && (
        <p className="card text-danger" role="alert">
          Your role ({user.role.toLowerCase()}) cannot open that page.
        </p>
      )}
      <h1 className="text-2xl font-semibold">Today</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Bales received" value={formatNumber(received._count, 0)} />
        <Stat label="Mass received" value={`${formatNumber(received._sum.massKg ?? 0, 0)} kg`} />
        <Stat label="Average price settled" value={`${formatUsd(avgPrice)}/kg`} />
        <Stat label="Net settled" value={formatUsd(settled._sum.netUsd ?? 0)} sub={`${settled._count} settlements`} />
      </div>

      <section className="card">
        <h2 className="mb-2 font-semibold">Bales received today by status</h2>
        {byStatus.length === 0 ? (
          <p className="text-sm text-muted">No bales yet today.</p>
        ) : (
          <ul className="flex flex-wrap gap-4 text-sm">
            {byStatus.map((s) => (
              <li key={s.status}>
                <span className="text-muted">{s.status.toLowerCase()}:</span> {s._count}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card text-sm">
        <h2 className="mb-1 font-semibold">TIMB link</h2>
        <p>
          {timbPending} message(s) waiting to send
          {timbFailed > 0 && <span className="text-danger">, {timbFailed} failed and need attention</span>}.{" "}
          {user.role === "ADMIN" && (
            <Link href="/admin/timb" className="underline">
              Open TIMB outbox
            </Link>
          )}
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}
