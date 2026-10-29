import { MessageSquareText, RotateCcw, Send } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Empty } from "@/components/empty";
import { PageTitle } from "@/components/page-title";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { smsEnabled } from "@/lib/sms";
import { AdminNav } from "../admin-nav";
import { processSmsAction, retrySmsAction } from "../actions";

const KIND_LABEL: Record<string, string> = { BALE_SOLD: "Bale sold", STATEMENT_READY: "Statement", PAYMENT_SENT: "Payment sent" };

export default async function SmsPage() {
  await requirePage("admin");
  const [messages, counts] = await Promise.all([
    db.smsOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.smsOutbox.groupBy({ by: ["status"], _count: true }),
  ]);
  const growers = new Map(
    (await db.grower.findMany({ where: { id: { in: [...new Set(messages.map((m) => m.growerId))] } } })).map((g) => [g.id, g]),
  );
  return (
    <div className="space-y-5">
      <PageTitle icon={<MessageSquareText size={22} />} title="Text messages" subtitle="Texts to growers when a bale sells, a statement is ready and money is sent." />
      <AdminNav />
      <p className="text-sm text-muted">
        Status: <strong>{smsEnabled() ? `on (gateway: ${process.env.SMS_MODE ?? "mock"})` : "switched off (SMS_ENABLED=false)"}</strong>. Texts go to
        the grower&apos;s phone, or their mobile money number if no phone is saved. Growers who opt out on their page get none.
        In mock mode nothing is really sent; choose an SMS gateway to go live.
      </p>
      <div className="card flex flex-wrap items-center gap-4 text-sm">
        {counts.map((c) => (
          <span key={c.status}>
            <StatusBadge status={c.status} /> {c._count}
          </span>
        ))}
        <ActionForm action={processSmsAction} submitLabel="Send due texts now" icon={<Send size={16} />} className="ml-auto">
          {null}
        </ActionForm>
      </div>
      <section className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Queued</th>
              <th>Grower</th>
              <th>Type</th>
              <th>Message</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {messages.map((m) => {
              const g = growers.get(m.growerId);
              return (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{m.createdAt.toLocaleString("en-ZW")}</td>
                  <td className="whitespace-nowrap">
                    {g ? `${g.firstName} ${g.lastName}` : "-"}
                    <div className="font-mono text-xs text-muted">+{m.toNumber}</div>
                  </td>
                  <td>{KIND_LABEL[m.kind] ?? m.kind}</td>
                  <td className="max-w-md text-sm">
                    {m.body}
                    {m.lastError && <div className="text-xs text-danger">{m.lastError}</div>}
                  </td>
                  <td>
                    <StatusBadge status={m.status} />
                  </td>
                  <td>
                    {m.status === "FAILED" && (
                      <ActionForm action={retrySmsAction.bind(null, m.id)} submitLabel="Retry" icon={<RotateCcw size={16} />} buttonClassName="btn" className="">
                        {null}
                      </ActionForm>
                    )}
                  </td>
                </tr>
              );
            })}
            {messages.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <Empty>No text messages yet.</Empty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
