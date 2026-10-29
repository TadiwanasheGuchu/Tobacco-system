import { PageTitle } from "@/components/page-title";
import { BarChart3, Download, Filter, Send } from "lucide-react";
import { Empty } from "@/components/empty";
import { ActionForm, Field } from "@/components/action-form";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber, formatUsd, formatZig } from "@/lib/money";
import { can } from "@/lib/permissions";
import {
  floorActivity,
  loanRecovery,
  parseRange,
  payoutSummary,
  salesByBuyer,
  salesByFloor,
  salesByGrade,
  SalesRow,
  totalOf,
} from "@/lib/services/reports";
import { queueDailySummaryAction } from "./actions";

const METHOD = { BANK_TRANSFER: "Bank transfer", MOBILE_MONEY: "Mobile money", CASH: "Cash" };

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const user = await requirePage("reports.view");
  const range = parseRange(await searchParams);
  const [floors, activity, byGrade, byBuyer, byFloor, payouts, loans] = await Promise.all([
    db.floor.findMany({ orderBy: { code: "asc" } }),
    floorActivity(range),
    salesByGrade(range),
    salesByBuyer(range),
    salesByFloor(range),
    payoutSummary(range),
    loanRecovery(),
  ]);
  const total = totalOf(byGrade);
  const qs = new URLSearchParams({ from: range.fromLabel, to: range.toLabel, ...(range.floorId ? { floor: range.floorId } : {}) });
  const csv = (type: string) => `/reports/export?type=${type}&${qs}`;
  const floorName = floors.find((f) => f.id === range.floorId)?.name ?? "All floors";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <PageTitle
          icon={<BarChart3 size={22} />}
          title="Reports"
          subtitle={`${floorName} · ${range.fromLabel === range.toLabel ? range.fromLabel : `${range.fromLabel} to ${range.toLabel}`}`}
        />
        <form className="ml-auto flex flex-wrap items-end gap-2 print:hidden">
          <label className="text-sm">
            <span className="mb-1 block font-medium">From</span>
            <input type="date" name="from" defaultValue={range.fromLabel} className="input" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">To</span>
            <input type="date" name="to" defaultValue={range.toLabel} className="input" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Floor</span>
            <select name="floor" defaultValue={range.floorId ?? ""} className="input">
              <option value="">All floors</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary">
            <Filter size={16} aria-hidden />
            Show
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Bales received" value={formatNumber(activity.receivedBales, 0)} sub={`${formatNumber(activity.receivedKg, 0)} kg`} />
        <Stat label="Bales sold" value={formatNumber(total.bales, 0)} sub={`${formatNumber(total.massKg, 0)} kg`} />
        <Stat label="Sales value" value={formatUsd(total.valueUsd)} />
        <Stat label="Average price" value={`${formatUsd(total.avgPriceUsd)}/kg`} />
        <Stat
          label="Rejection rate"
          value={`${formatNumber(activity.rejectionRatePercent, 1)}%`}
          sub={`${activity.rejects} rejected · ${activity.accepts} accepted`}
        />
      </div>

      <SalesTable title="Sales by grade" first="Grade" rows={byGrade} csvHref={csv("grade")} />
      <SalesTable title="Sales by buyer" first="Buyer" rows={byBuyer} csvHref={csv("buyer")} />
      {!range.floorId && <SalesTable title="Sales by floor" first="Floor" rows={byFloor} csvHref={csv("floor")} />}

      <section className="card space-y-3">
        <Heading title="Payouts" csvHref={csv("payments")} csvLabel="Payment list (CSV)" />
        <p className="text-xs text-muted">Settlements prepared in this period, excluding reversed ones.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt>Settlements</dt>
            <dd className="num">{payouts.count}</dd>
            <dt>Gross</dt>
            <dd className="num">{formatUsd(payouts.grossUsd)}</dd>
            {payouts.deductions.map((d) => (
              <div key={d.code} className="contents">
                <dt className="text-muted">less {d.description}</dt>
                <dd className="num">-{formatUsd(d.amountUsd)}</dd>
              </div>
            ))}
            <dt className="font-semibold">Net</dt>
            <dd className="num font-semibold">{formatUsd(payouts.netUsd)}</dd>
            <dt className="text-muted">Paid in USD</dt>
            <dd className="num">{formatUsd(payouts.payUsd)}</dd>
            <dt className="text-muted">Paid in ZiG</dt>
            <dd className="num">{formatZig(payouts.payZig)}</dd>
          </dl>
          <div className="space-y-3 text-sm">
            <table className="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th className="num">Count</th>
                  <th className="num">Net</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Paid</td>
                  <td className="num">{payouts.paid?._count ?? 0}</td>
                  <td className="num">{formatUsd(payouts.paid?._sum.netUsd ?? 0)}</td>
                </tr>
                <tr>
                  <td>Waiting for payment release</td>
                  <td className="num">{payouts.unpaid?._count ?? 0}</td>
                  <td className="num">{formatUsd(payouts.unpaid?._sum.netUsd ?? 0)}</td>
                </tr>
              </tbody>
            </table>
            <table className="table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th className="num">Count</th>
                  <th className="num">USD</th>
                  <th className="num">ZiG</th>
                </tr>
              </thead>
              <tbody>
                {payouts.byMethod.map((m) => (
                  <tr key={m.paymentMethod}>
                    <td>{METHOD[m.paymentMethod]}</td>
                    <td className="num">{m._count}</td>
                    <td className="num">{formatUsd(m._sum.payUsd ?? 0)}</td>
                    <td className="num">{formatZig(m._sum.payZig ?? 0)}</td>
                  </tr>
                ))}
                {payouts.byMethod.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                  <Empty>No settlements.</Empty>
                </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="card space-y-2 overflow-x-auto">
        <Heading title="Input loan recovery (open season, to date)" csvHref={csv("loans")} />
        <table className="table">
          <thead>
            <tr>
              <th>Contractor</th>
              <th className="num">Contracts</th>
              <th className="num">Input loans</th>
              <th className="num">Recovered</th>
              <th className="num">Outstanding</th>
              <th className="num">Recovered %</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((l) => (
              <tr key={l.code}>
                <td>
                  {l.code} · {l.name}
                </td>
                <td className="num">{l.contracts}</td>
                <td className="num">{formatUsd(l.loansUsd)}</td>
                <td className="num">{formatUsd(l.recoveredUsd)}</td>
                <td className="num">{formatUsd(l.outstandingUsd)}</td>
                <td className="num">{formatNumber(l.recoveredPercent, 1)}%</td>
              </tr>
            ))}
            {loans.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <Empty>No contracts this season.</Empty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {can(user.role, "timb.dailyReturn") && (
        <section className="card print:hidden">
          <h2 className="mb-1 font-semibold">TIMB daily summary</h2>
          <p className="mb-3 text-sm text-muted">
            Queues one summary per floor (bales, mass, value and a breakdown by TIMB grade) for the chosen day. Each floor
            and day can only be queued once. Track delivery under Admin → TIMB outbox.
          </p>
          <ActionForm action={queueDailySummaryAction} submitLabel="Queue for TIMB" icon={<Send size={16} />} className="flex flex-wrap items-end gap-3">
            <Field label="Trading day" name="date" type="date" defaultValue={range.toLabel} required />
          </ActionForm>
        </section>
      )}
    </div>
  );
}

function Heading({ title, csvHref, csvLabel = "Download CSV" }: { title: string; csvHref: string; csvLabel?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h2 className="font-semibold">{title}</h2>
      <a href={csvHref} className="btn ml-auto text-sm print:hidden">
        <Download size={16} aria-hidden />
        {csvLabel}
      </a>
    </div>
  );
}

function SalesTable({ title, first, rows, csvHref }: { title: string; first: string; rows: SalesRow[]; csvHref: string }) {
  const total = totalOf(rows);
  return (
    <section className="card space-y-2 overflow-x-auto">
      <Heading title={title} csvHref={csvHref} />
      <table className="table">
        <thead>
          <tr>
            <th>{first}</th>
            <th className="num">Bales</th>
            <th className="num">Mass (kg)</th>
            <th className="num">Value</th>
            <th className="num">Avg price/kg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td className="num">{r.bales}</td>
              <td className="num">{formatNumber(r.massKg, 2)}</td>
              <td className="num">{formatUsd(r.valueUsd)}</td>
              <td className="num">{formatUsd(r.avgPriceUsd)}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5}>
                  <Empty>No sales in this period.</Empty>
                </td>
            </tr>
          ) : (
            <tr className="font-semibold">
              <td>Total</td>
              <td className="num">{total.bales}</td>
              <td className="num">{formatNumber(total.massKg, 2)}</td>
              <td className="num">{formatUsd(total.valueUsd)}</td>
              <td className="num">{formatUsd(total.avgPriceUsd)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
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
