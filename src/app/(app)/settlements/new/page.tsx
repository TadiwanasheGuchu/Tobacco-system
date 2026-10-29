import { PageTitle } from "@/components/page-title";
import { Wallet } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Select } from "@/components/action-form";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber, formatUsd, formatZig } from "@/lib/money";
import { DomainError } from "@/lib/services/common";
import { previewSettlement, settleableGroups } from "@/lib/services/settlements";
import { createSettlementAction } from "../actions";

export default async function NewSettlementPage({ searchParams }: PageProps<"/settlements/new">) {
  await requirePage("settlement.create");
  const growerId = String((await searchParams).growerId ?? "");
  const grower = growerId ? await db.grower.findUnique({ where: { id: growerId } }) : null;
  if (!grower) notFound();
  const groups = await settleableGroups(grower.id);
  const previews = await Promise.all(
    groups.map(async (g) => {
      try {
        const preview = await previewSettlement(grower.id, { floorId: g.floor.id, contractId: g.contract?.id ?? null });
        return { group: g, preview, error: null };
      } catch (err) {
        if (!(err instanceof DomainError)) throw err;
        return { group: g, preview: null, error: err.message };
      }
    }),
  );

  const methods = [
    grower.bankAccountNumber && { value: "BANK_TRANSFER", label: `Bank transfer · ${grower.bankName ?? ""} ${grower.bankAccountNumber}` },
    grower.mobileMoneyNumber && { value: "MOBILE_MONEY", label: `Mobile money · ${grower.mobileMoneyNumber}` },
    { value: "CASH", label: "Cash" },
  ].filter((m): m is { value: string; label: string } => !!m);

  return (
    <div className="space-y-5">
      <PageTitle icon={<Wallet size={22} />} title={`Settle ${grower.firstName} ${grower.lastName}`} subtitle={`TIMB ${grower.timbGrowerNumber}`} />
      {groups.length === 0 && (
        <p className="card text-sm text-muted">
          No accepted bales are waiting. <Link href={`/growers/${grower.id}`} className="underline">Back to grower</Link>
        </p>
      )}
      {previews.map(({ group: g, preview, error }) => {
        if (!preview) {
          return (
            <section key={g.floor.id + (g.contract?.id ?? "")} className="card text-sm text-danger" role="alert">
              {g.floor.name}: {error}
            </section>
          );
        }
        const { calc, rules, bales, loanOutstanding } = preview;
        return (
          <section key={g.floor.id + (g.contract?.id ?? "")} className="card space-y-4">
            <h2 className="font-semibold">
              {g.floor.name} · {g.count} bale{g.count === 1 ? "" : "s"}
              {g.contract ? ` · contract ${g.contract.contractNumber}` : ""}
            </h2>
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
                {calc.lines.map((l) => {
                  const b = bales.find((x) => x.id === l.baleId)!;
                  return (
                    <tr key={l.baleId}>
                      <td>{b.ticketNumber}</td>
                      <td>{b.gradings[0]?.grade.code ?? "-"}</td>
                      <td className="num">{formatNumber(l.massKg, 2)}</td>
                      <td className="num">{formatUsd(l.pricePerKgUsd)}</td>
                      <td className="num">{formatUsd(l.valueUsd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <dl className="ml-auto grid max-w-md grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <dt>Gross</dt>
              <dd className="num">{formatUsd(calc.grossUsd)}</dd>
              {calc.deductions.map((d) => (
                <Row key={d.code} label={`less ${d.description}`} value={`-${formatUsd(d.amountUsd)}`} />
              ))}
              <dt className="font-semibold">Net</dt>
              <dd className="num font-semibold">{formatUsd(calc.netUsd)}</dd>
              <Row label={`Paid in USD (${formatNumber(rules.usdPercent, 0)}%)`} value={formatUsd(calc.payUsd)} />
              <Row
                label={`Paid in ZiG (${formatUsd(calc.payZigUsdEquiv)} at ${formatNumber(rules.zigPerUsd, 4)})`}
                value={formatZig(calc.payZig)}
              />
            </dl>
            {g.contract && (
              <p className="text-xs text-muted">
                Loan outstanding before this settlement: {formatUsd(loanOutstanding)}; after: {formatUsd(loanOutstanding.sub(calc.loanRecoveryUsd))}.
              </p>
            )}
            <ActionForm
              action={createSettlementAction.bind(null, grower.id, g.floor.id, g.contract?.id ?? null)}
              submitLabel="Create settlement" icon={<Wallet size={16} />}
              className="flex flex-wrap items-end gap-3"
              confirm="Create this settlement? The bales will be marked as settled."
            >
              <Select label="Payment method" name="paymentMethod" options={methods} />
            </ActionForm>
          </section>
        );
      })}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="num">{value}</dd>
    </>
  );
}
