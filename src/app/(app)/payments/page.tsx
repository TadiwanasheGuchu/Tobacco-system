import Link from "next/link";
import { Banknote, Landmark, Plus, Smartphone } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Empty } from "@/components/empty";
import { PageTitle } from "@/components/page-title";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatUsd, formatZig } from "@/lib/money";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { batchCandidatesSummary } from "@/lib/services/payments";
import { createBatchAction } from "./actions";

const money = (currency: string, v: Parameters<typeof formatUsd>[0]) => (currency === "USD" ? formatUsd(v) : formatZig(v));

export default async function PaymentsPage() {
  const user = await requirePage("settlement.view");
  const [candidates, batches, cashWaiting] = await Promise.all([
    batchCandidatesSummary(),
    db.paymentBatch.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    db.settlement.count({ where: { status: "APPROVED", paymentMethod: "CASH" } }),
  ]);
  const canPay = can(user.role, "settlement.pay");

  return (
    <div className="space-y-6">
      <PageTitle icon={<Landmark size={22} />} title="Payments" subtitle="Turn approved settlements into payout files for the bank and mobile money." />

      <section className="grid gap-4 md:grid-cols-2">
        {candidates.map((c) => (
          <div key={`${c.method}-${c.currency}`} className="card flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-brand">
              {c.method === "MOBILE_MONEY" ? <Smartphone size={20} aria-hidden /> : <Landmark size={20} aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">
                {PAYMENT_METHOD_LABEL[c.method]} · {c.currency === "USD" ? "USD" : "ZiG"}
              </div>
              <div className="text-sm text-muted">
                {c.count === 0 ? "Nothing waiting" : `${c.count} waiting · ${money(c.currency, c.total)}`}
              </div>
            </div>
            {canPay && c.count > 0 && (
              <ActionForm
                action={createBatchAction.bind(null, c.method, c.currency)}
                submitLabel="Create batch"
                icon={<Plus size={16} />}
                className=""
                confirm={`Create a ${PAYMENT_METHOD_LABEL[c.method].toLowerCase()} batch for ${c.count} settlement(s)?`}
              >
                {null}
              </ActionForm>
            )}
          </div>
        ))}
      </section>

      {cashWaiting > 0 && (
        <p className="card flex items-center gap-3 text-sm">
          <Banknote size={18} className="text-brand" aria-hidden />
          {cashWaiting} cash settlement{cashWaiting === 1 ? " is" : "s are"} waiting. Cash is paid at the cashier&apos;s window and released on each
          settlement.
          <Link href="/settlements" className="ml-auto underline">
            Settlements
          </Link>
        </p>
      )}

      <section className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Batches</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Batch</th>
              <th>Created</th>
              <th>Method</th>
              <th className="num">Payees</th>
              <th className="num">Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link href={`/payments/${b.id}`} className="font-medium underline">
                    {b.number}
                  </Link>
                </td>
                <td>{b.createdAt.toLocaleString("en-ZW")}</td>
                <td>
                  {PAYMENT_METHOD_LABEL[b.method]} · {b.currency === "USD" ? "USD" : "ZiG"}
                </td>
                <td className="num">{b.lineCount}</td>
                <td className="num">{money(b.currency, b.totalAmount)}</td>
                <td>
                  <StatusBadge status={b.status === "OPEN" ? "BATCH_OPEN" : b.status} />
                </td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <Empty>No payment batches yet.</Empty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
