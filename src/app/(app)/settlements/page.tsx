import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatUsd, formatZig } from "@/lib/money";

export default async function SettlementsPage() {
  await requirePage("settlement.view");
  const [settlements, waiting] = await Promise.all([
    db.settlement.findMany({ include: { grower: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.bale.groupBy({ by: ["growerId"], where: { status: "ACCEPTED" }, _count: true }),
  ]);
  const waitingGrowers = await db.grower.findMany({ where: { id: { in: waiting.map((w) => w.growerId) } } });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Settlements</h1>

      <section className="card overflow-x-auto">
        <h2 className="mb-2 font-semibold">Growers waiting to be paid</h2>
        {waiting.length === 0 ? (
          <p className="text-sm text-muted">No accepted bales waiting.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Grower</th>
                <th className="num">Accepted bales</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {waiting.map((w) => {
                const g = waitingGrowers.find((x) => x.id === w.growerId)!;
                return (
                  <tr key={w.growerId}>
                    <td>
                      {g.timbGrowerNumber} · {g.firstName} {g.lastName}
                    </td>
                    <td className="num">{w._count}</td>
                    <td className="text-right">
                      <Link href={`/settlements/new?growerId=${g.id}`} className="btn btn-primary">
                        Prepare settlement
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-2 font-semibold">Recent settlements</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Grower</th>
              <th>Date</th>
              <th className="num">Net (USD)</th>
              <th className="num">Paid in USD</th>
              <th className="num">Paid in ZiG</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {settlements.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/settlements/${s.id}`} className="font-medium underline">
                    {s.number}
                  </Link>
                </td>
                <td>{s.grower.timbGrowerNumber}</td>
                <td>{s.createdAt.toLocaleString("en-ZW")}</td>
                <td className="num">{formatUsd(s.netUsd)}</td>
                <td className="num">{formatUsd(s.payUsd)}</td>
                <td className="num">{formatZig(s.payZig)}</td>
                <td>
                  <StatusBadge status={s.status} />
                </td>
              </tr>
            ))}
            {settlements.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted">
                  No settlements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
