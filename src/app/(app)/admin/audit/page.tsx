import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { AdminNav } from "../admin-nav";

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requirePage("admin");
  const action = String((await searchParams).action ?? "").trim();
  const logs = await db.auditLog.findMany({
    where: action ? { action: { startsWith: action } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const users = new Map(
    (await db.user.findMany({ where: { id: { in: logs.map((l) => l.actorId!).filter(Boolean) } } })).map((u) => [u.id, u.username]),
  );
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <AdminNav />
      <form className="flex gap-2">
        <input name="action" defaultValue={action} className="input max-w-xs" placeholder="Filter, e.g. bale. or settlement." />
        <button className="btn">Filter</button>
      </form>
      <section className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>User</th>
              <th>Action</th>
              <th>Record</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap">{l.createdAt.toLocaleString("en-ZW")}</td>
                <td>{l.actorId ? users.get(l.actorId) : "-"}</td>
                <td>{l.action}</td>
                <td className="font-mono text-xs">
                  {l.entityType} {l.entityId}
                </td>
                <td className="max-w-md truncate font-mono text-xs">{l.data ? JSON.stringify(l.data) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
