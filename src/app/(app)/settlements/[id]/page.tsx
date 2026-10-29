import { BadgeCheck, Undo2 } from "lucide-react";
import { notFound } from "next/navigation";
import { ActionForm, Field } from "@/components/action-form";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { dec, formatNumber, formatUsd, formatZig } from "@/lib/money";
import { can } from "@/lib/permissions";
import { PrintButton } from "@/components/print-button";
import { paySettlementAction, reverseSettlementAction } from "../actions";

const METHOD_LABEL = { BANK_TRANSFER: "Bank transfer", MOBILE_MONEY: "Mobile money", CASH: "Cash" };

export default async function SettlementPage({ params }: PageProps<"/settlements/[id]">) {
  const user = await requirePage("settlement.view");
  const { id } = await params;
  const s = await db.settlement.findUnique({
    where: { id },
    include: { grower: true, lines: { include: { bale: true } }, deductions: { include: { contract: true } } },
  });
  if (!s) notFound();
  const floor = await db.floor.findUniqueOrThrow({ where: { id: s.floorId } });
  const people = new Map(
    (await db.user.findMany({ where: { id: { in: [s.createdById, s.paidById, s.reversedById].filter((x): x is string => !!x) } } })).map(
      (u) => [u.id, u.fullName],
    ),
  );
  const totalKg = s.lines.reduce((sum, l) => sum.add(dec(l.massKg)), dec(0));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <PrintButton label="Print statement" />
        <StatusBadge status={s.status} />
      </div>

      <article className="card space-y-4">
        <header className="flex flex-wrap justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">Grower sale statement {s.number}</h1>
            <p className="text-sm">
              {floor.name} · {s.createdAt.toLocaleString("en-ZW")}
            </p>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold">
              {s.grower.firstName} {s.grower.lastName}
            </div>
            <div>TIMB {s.grower.timbGrowerNumber}</div>
            <div>ID {s.grower.nationalId}</div>
          </div>
        </header>

        <table className="table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Grade</th>
              <th className="num">Mass (kg)</th>
              <th className="num">Price/kg</th>
              <th className="num">Value</th>
            </tr>
          </thead>
          <tbody>
            {s.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.bale.ticketNumber}</td>
                <td>{l.gradeCode}</td>
                <td className="num">{formatNumber(l.massKg, 2)}</td>
                <td className="num">{formatUsd(l.pricePerKgUsd)}</td>
                <td className="num">{formatUsd(l.valueUsd)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td colSpan={2}>
                {s.lines.length} bale{s.lines.length === 1 ? "" : "s"}
              </td>
              <td className="num">{formatNumber(totalKg, 2)}</td>
              <td />
              <td className="num">{formatUsd(s.grossUsd)}</td>
            </tr>
          </tbody>
        </table>

        <dl className="ml-auto grid max-w-md grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <dt>Gross</dt>
          <dd className="num">{formatUsd(s.grossUsd)}</dd>
          {s.deductions.map((d) => (
            <div key={d.id} className="contents">
              <dt className="text-muted">
                less {d.description}
                {d.contract ? ` (${d.contract.contractNumber})` : ""}
              </dt>
              <dd className="num">-{formatUsd(d.amountUsd)}</dd>
            </div>
          ))}
          <dt className="font-semibold">Net payable</dt>
          <dd className="num font-semibold">{formatUsd(s.netUsd)}</dd>
          <dt className="text-muted">Paid in USD ({formatNumber(s.usdPercent, 0)}%)</dt>
          <dd className="num">{formatUsd(s.payUsd)}</dd>
          <dt className="text-muted">
            Paid in ZiG ({formatUsd(s.payZigUsdEquiv)} at {formatNumber(s.zigPerUsd, 4)})
          </dt>
          <dd className="num">{formatZig(s.payZig)}</dd>
        </dl>

        <footer className="space-y-1 border-t border-border pt-3 text-sm">
          <p>
            Payment: {METHOD_LABEL[s.paymentMethod]}
            {s.paymentReference ? ` · ref ${s.paymentReference}` : ""}
          </p>
          <p className="text-muted">
            Prepared by {people.get(s.createdById)}
            {s.paidById && ` · released by ${people.get(s.paidById)} on ${s.paidAt?.toLocaleString("en-ZW")}`}
            {s.reversedById && ` · reversed by ${people.get(s.reversedById)}: ${s.reversalReason}`}
          </p>
          <p className="hidden pt-8 print:block">Grower signature: ______________________________</p>
        </footer>
      </article>

      {s.status === "APPROVED" && can(user.role, "settlement.pay") && (
        <section className="card print:hidden">
          <h2 className="mb-2 font-semibold">Release payment</h2>
          <ActionForm
            action={paySettlementAction.bind(null, s.id)}
            submitLabel="Mark as paid" icon={<BadgeCheck size={16} />}
            className="flex flex-wrap items-end gap-3"
            confirm="Confirm the payment has been made?"
          >
            <Field label="Payment reference" name="reference" required hint="Bank, mobile money or cash voucher reference." />
          </ActionForm>
        </section>
      )}
      {s.status === "APPROVED" && can(user.role, "settlement.reverse") && (
        <section className="card print:hidden">
          <h2 className="mb-2 font-semibold">Reverse settlement</h2>
          <ActionForm
            action={reverseSettlementAction.bind(null, s.id)}
            submitLabel="Reverse" icon={<Undo2 size={16} />}
            buttonClassName="btn btn-danger"
            className="flex flex-wrap items-end gap-3"
            confirm="Reverse this settlement? Its bales go back to accepted."
          >
            <Field label="Reason" name="reason" required />
          </ActionForm>
        </section>
      )}
    </div>
  );
}
