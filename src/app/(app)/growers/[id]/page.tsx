import { PageTitle } from "@/components/page-title";
import { Ban, FilePlus2, ShieldCheck, UserCheck, UserRound, Wallet } from "lucide-react";
import { Empty } from "@/components/empty";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Field, Select } from "@/components/action-form";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { dec, formatNumber, formatUsd } from "@/lib/money";
import { can } from "@/lib/permissions";
import { addContractAction, reverifyGrowerAction, setGrowerStatusAction } from "../actions";

export default async function GrowerPage({ params }: PageProps<"/growers/[id]">) {
  const user = await requirePage("grower.view");
  const { id } = await params;
  const grower = await db.grower.findUnique({
    where: { id },
    include: {
      contracts: {
        include: {
          buyer: true,
          season: true,
          recoveries: { where: { settlement: { status: { not: "REVERSED" } } } },
        },
        orderBy: { createdAt: "desc" },
      },
      bales: { include: { floor: true, currentOffer: true }, orderBy: { receivedAt: "desc" }, take: 100 },
      settlements: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!grower) notFound();
  const buyers = can(user.role, "contract.manage") ? await db.buyer.findMany({ where: { active: true } }) : [];
  const accepted = grower.bales.filter((b) => b.status === "ACCEPTED").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <PageTitle
          icon={<UserRound size={22} />}
          title={`${grower.firstName} ${grower.lastName}`}
          subtitle={`TIMB ${grower.timbGrowerNumber} · ID ${grower.nationalId} · ${grower.district ?? "no district"} · ${grower.status.toLowerCase()}`}
        />
        {accepted > 0 && can(user.role, "settlement.create") && (
          <Link href={`/settlements/new?growerId=${grower.id}`} className="btn btn-primary ml-auto">
            <Wallet size={16} aria-hidden />
            Settle {accepted} accepted bale{accepted === 1 ? "" : "s"}
          </Link>
        )}
      </div>

      {!grower.timbVerifiedAt && (
        <div className="card border-danger">
          <p className="mb-2 text-sm text-danger">Not verified with TIMB. This grower cannot sell until verified.</p>
          {can(user.role, "grower.register") && (
            <ActionForm action={reverifyGrowerAction.bind(null, grower.id)} submitLabel="Verify with TIMB now" icon={<ShieldCheck size={16} />} pendingLabel="Checking…">
              {null}
            </ActionForm>
          )}
        </div>
      )}

      <section className="card text-sm">
        <h2 className="mb-2 font-semibold">Payment details</h2>
        <p>
          Bank: {grower.bankName ?? "-"} {grower.bankAccountNumber ?? ""} · Mobile money: {grower.mobileMoneyNumber ?? "-"}
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Contracts</h2>
        {grower.contracts.length === 0 ? (
          <p className="text-sm text-muted">No contracts. Without one this grower can only sell on auction floors.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Contract</th>
                <th>Contractor</th>
                <th>Season</th>
                <th className="num">Input loan</th>
                <th className="num">Recovered</th>
                <th className="num">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {grower.contracts.map((c) => {
                const recovered = c.recoveries.reduce((s, r) => s.add(dec(r.amountUsd)), dec(0));
                return (
                  <tr key={c.id}>
                    <td>{c.contractNumber}</td>
                    <td>{c.buyer.name}</td>
                    <td>{c.season.year}</td>
                    <td className="num">{formatUsd(c.inputLoanUsd)}</td>
                    <td className="num">{formatUsd(recovered)}</td>
                    <td className="num">{formatUsd(dec(c.inputLoanUsd).sub(recovered))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {buyers.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-medium">Add contract for this season</summary>
            <ActionForm action={addContractAction.bind(null, grower.id)} submitLabel="Add contract" icon={<FilePlus2 size={16} />} className="mt-3 grid gap-3 sm:grid-cols-4" resetOnSuccess>
              <Field label="Contract number" name="contractNumber" required />
              <Select label="Contractor" name="buyerId" options={buyers.map((b) => ({ value: b.id, label: b.name }))} />
              <Field label="Input loan (USD)" name="inputLoanUsd" inputMode="decimal" required />
            </ActionForm>
          </details>
        )}
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-2 font-semibold">Bales</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Floor</th>
              <th>Received</th>
              <th className="num">Mass (kg)</th>
              <th className="num">Price/kg</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {grower.bales.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link href={`/bales/${b.ticketNumber}`} className="underline">
                    {b.ticketNumber}
                  </Link>
                </td>
                <td>{b.floor.code}</td>
                <td>{b.receivedAt.toLocaleString("en-ZW")}</td>
                <td className="num">{formatNumber(b.massKg, 2)}</td>
                <td className="num">{b.currentOffer ? formatUsd(b.currentOffer.pricePerKgUsd) : "-"}</td>
                <td>
                  <StatusBadge status={b.status} />
                </td>
              </tr>
            ))}
            {grower.bales.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <Empty>No bales yet.</Empty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-2 font-semibold">Settlements</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Date</th>
              <th className="num">Net</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {grower.settlements.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/settlements/${s.id}`} className="underline">
                    {s.number}
                  </Link>
                </td>
                <td>{s.createdAt.toLocaleString("en-ZW")}</td>
                <td className="num">{formatUsd(s.netUsd)}</td>
                <td>
                  <StatusBadge status={s.status} />
                </td>
              </tr>
            ))}
            {grower.settlements.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <Empty>No settlements yet.</Empty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {can(user.role, "contract.manage") && (
        <section className="card">
          <h2 className="mb-2 font-semibold">{grower.status === "ACTIVE" ? "Suspend grower" : "Reactivate grower"}</h2>
          <ActionForm
            action={setGrowerStatusAction.bind(null, grower.id)}
            submitLabel={grower.status === "ACTIVE" ? "Suspend" : "Reactivate"}
            icon={grower.status === "ACTIVE" ? <Ban size={16} /> : <UserCheck size={16} />}
            buttonClassName={grower.status === "ACTIVE" ? "btn btn-danger" : "btn"}
            className="flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="status" value={grower.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"} />
            <Field label="Reason" name="reason" required />
          </ActionForm>
        </section>
      )}
    </div>
  );
}
