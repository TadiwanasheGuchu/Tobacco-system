import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Download, Landmark, Smartphone, XCircle } from "lucide-react";
import { ActionForm, Field } from "@/components/action-form";
import { PageTitle } from "@/components/page-title";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatUsd, formatZig } from "@/lib/money";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { cancelBatchAction, confirmBatchAction } from "../actions";

export default async function BatchPage({ params }: PageProps<"/payments/[id]">) {
  const user = await requirePage("settlement.view");
  const { id } = await params;
  const batch = await db.paymentBatch.findUnique({
    where: { id },
    include: { lines: { include: { settlement: true }, orderBy: { payeeName: "asc" } } },
  });
  if (!batch) notFound();
  const people = new Map(
    (
      await db.user.findMany({
        where: { id: { in: [batch.createdById, batch.confirmedById, batch.cancelledById].filter((x): x is string => !!x) } },
      })
    ).map((u) => [u.id, u.fullName]),
  );
  const money = (v: Parameters<typeof formatUsd>[0]) => (batch.currency === "USD" ? formatUsd(v) : formatZig(v));
  const canPay = can(user.role, "settlement.pay");

  return (
    <div className="space-y-5">
      <PageTitle
        icon={batch.method === "MOBILE_MONEY" ? <Smartphone size={22} /> : <Landmark size={22} />}
        title={batch.number}
        subtitle={`${PAYMENT_METHOD_LABEL[batch.method]} · ${batch.currency === "USD" ? "USD" : "ZiG"} · ${batch.lineCount} payee${batch.lineCount === 1 ? "" : "s"} · ${money(batch.totalAmount)}`}
      >
        <StatusBadge status={batch.status === "OPEN" ? "BATCH_OPEN" : batch.status} />
        {batch.status !== "CANCELLED" && canPay && (
          <a href={`/payments/${batch.id}/file`} className="btn btn-primary">
            <Download size={16} aria-hidden />
            Download payout file
          </a>
        )}
      </PageTitle>

      {batch.status === "OPEN" && canPay && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="card space-y-2">
            <h2 className="font-semibold">Provider confirmed the payout</h2>
            <p className="text-sm text-muted">
              Upload the file to the bank or mobile money portal. When they confirm, record their reference here. The
              settlements are then marked paid.
            </p>
            <ActionForm
              action={confirmBatchAction.bind(null, batch.id)}
              submitLabel="Confirm paid"
              icon={<BadgeCheck size={16} />}
              confirm="Confirm the provider has paid every line in this batch?"
            >
              <Field label="Bank / provider reference" name="reference" required />
            </ActionForm>
          </section>
          <section className="card space-y-2">
            <h2 className="font-semibold">Not sent, or rejected</h2>
            <p className="text-sm text-muted">Cancel the batch to put its settlements back in the queue, e.g. after fixing account details.</p>
            <ActionForm
              action={cancelBatchAction.bind(null, batch.id)}
              submitLabel="Cancel batch"
              icon={<XCircle size={16} />}
              buttonClassName="btn btn-danger"
            >
              <Field label="Reason" name="reason" required />
            </ActionForm>
          </section>
        </div>
      )}

      <section className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Payee</th>
              <th>{batch.method === "MOBILE_MONEY" ? "Mobile number" : "Bank · account"}</th>
              <th>Settlement</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {batch.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.payeeName}</td>
                <td className="font-mono text-sm">{l.payeeBank ? `${l.payeeBank} · ${l.payeeAccount}` : l.payeeAccount}</td>
                <td>
                  <Link href={`/settlements/${l.settlementId}`} className="underline">
                    {l.settlement.number}
                  </Link>{" "}
                  <StatusBadge status={l.settlement.status} />
                </td>
                <td className="num">{money(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="text-sm text-muted">
        Created by {people.get(batch.createdById)} on {batch.createdAt.toLocaleString("en-ZW")}
        {batch.confirmedById && ` · confirmed by ${people.get(batch.confirmedById)} (ref ${batch.bankReference})`}
        {batch.cancelledById && ` · cancelled by ${people.get(batch.cancelledById)}: ${batch.cancelReason}`}
      </p>
    </div>
  );
}
