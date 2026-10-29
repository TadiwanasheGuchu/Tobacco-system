import { PageTitle } from "@/components/page-title";
import { RotateCcw, Send } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { AdminNav } from "../admin-nav";
import { processOutboxAction, retryOutboxAction } from "../actions";

export default async function TimbPage() {
  await requirePage("admin");
  const [messages, counts] = await Promise.all([
    db.timbOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.timbOutbox.groupBy({ by: ["status"], _count: true }),
  ]);
  return (
    <div className="space-y-5">
      <PageTitle icon={<Send size={22} />} title="TIMB outbox" />
      <AdminNav />
      <p className="text-sm text-muted">
        Every bale received, sold or rejected is queued here in the same transaction as the floor action, then delivered to
        TIMB by the worker (<code>npm run worker</code>). Adapter mode: <strong>{process.env.TIMB_MODE ?? "mock"}</strong>.
      </p>
      <div className="card flex flex-wrap items-center gap-4 text-sm">
        {counts.map((c) => (
          <span key={c.status}>
            <StatusBadge status={c.status} /> {c._count}
          </span>
        ))}
        <ActionForm action={processOutboxAction} submitLabel="Send due messages now" icon={<Send size={16} />} className="ml-auto">
          {null}
        </ActionForm>
      </div>
      <section className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Queued</th>
              <th>Type</th>
              <th>Status</th>
              <th className="num">Attempts</th>
              <th>TIMB reference / error</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {messages.map((m) => (
              <tr key={m.id}>
                <td>{m.createdAt.toLocaleString("en-ZW")}</td>
                <td>{m.messageType}</td>
                <td>
                  <StatusBadge status={m.status} />
                </td>
                <td className="num">{m.attempts}</td>
                <td className="max-w-xs truncate">{m.timbReference ?? m.lastError ?? ""}</td>
                <td>
                  {m.status === "FAILED" && (
                    <ActionForm action={retryOutboxAction.bind(null, m.id)} submitLabel="Retry" icon={<RotateCcw size={16} />} buttonClassName="btn" className="">
                      {null}
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
