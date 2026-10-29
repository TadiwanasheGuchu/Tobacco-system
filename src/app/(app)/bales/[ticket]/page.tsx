import { PageTitle } from "@/components/page-title";
import { Check, Gavel, Package, PackageX, PencilLine, Printer, RotateCcw, Tag, X } from "lucide-react";
import { Empty } from "@/components/empty";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Field, Select } from "@/components/action-form";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { dec, formatNumber, formatUsd, round2 } from "@/lib/money";
import { can } from "@/lib/permissions";
import { bidAction, decisionAction, gradeAction, overrideAction, reofferAction, withdrawAction } from "../actions";

export default async function BalePage({ params }: PageProps<"/bales/[ticket]">) {
  const user = await requirePage("bale.view");
  const { ticket } = await params;
  const bale = await db.bale.findUnique({
    where: { ticketNumber: decodeURIComponent(ticket) },
    include: {
      grower: true,
      floor: true,
      contract: { include: { buyer: true } },
      currentOffer: { include: { buyer: true } },
      gradings: { include: { grade: true }, orderBy: { createdAt: "desc" } },
      offers: { include: { buyer: true }, orderBy: { createdAt: "desc" } },
      settlementLines: { include: { settlement: true } },
    },
  });
  if (!bale) notFound();

  const [grades, buyers, history] = await Promise.all([
    db.grade.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    db.buyer.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    db.auditLog.findMany({ where: { entityType: "Bale", entityId: bale.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const actorNames = new Map(
    (await db.user.findMany({ where: { id: { in: history.map((h) => h.actorId!).filter(Boolean) } } })).map((u) => [u.id, u.fullName]),
  );

  const buyerCodes = new Map(buyers.map((b) => [b.id, b.code]));
  const timbGrade = bale.gradings.find((g) => g.kind === "TIMB");
  const buyerGrade = bale.gradings.find((g) => g.kind === "BUYER");
  const gradable = ["RECEIVED", "GRADED", "PRICED"].includes(bale.status);
  const onSale = bale.status === "GRADED" || bale.status === "PRICED";
  const isAuction = bale.floor.type === "AUCTION";
  const gradeOptions = grades.map((g) => ({ value: g.code, label: `${g.code} · ${g.description}` }));
  const buyerOptions = buyers.map((b) => ({ value: b.id, label: `${b.code} · ${b.name}` }));
  const value = bale.currentOffer ? round2(dec(bale.massKg).mul(dec(bale.currentOffer.pricePerKgUsd))) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <PageTitle
          icon={<Package size={22} />}
          title={<span className="font-mono">{bale.ticketNumber}</span>}
          subtitle={`${bale.floor.name} (${bale.floor.type.toLowerCase()}) · lane ${bale.lane ?? "-"} · received ${bale.receivedAt.toLocaleString("en-ZW")}`}
        />
        <div className="ml-auto flex items-center gap-3">
          <StatusBadge status={bale.status} />
          <Link href={`/bales/${bale.ticketNumber}/ticket`} className="btn">
            <Printer size={16} aria-hidden />
            Reprint ticket
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Info label="Grower">
          <Link href={`/growers/${bale.growerId}`} className="underline">
            {bale.grower.firstName} {bale.grower.lastName}
          </Link>
          <div className="text-xs text-muted">{bale.grower.timbGrowerNumber}</div>
        </Info>
        <Info label="Mass">
          {formatNumber(bale.massKg, 2)} kg
          <div className="text-xs text-muted">{bale.weighSource === "SCALE" ? "from scale" : "typed in (manual)"}</div>
        </Info>
        <Info label="Grade">
          TIMB {timbGrade?.grade.code ?? "-"}
          <div className="text-xs text-muted">Buyer {buyerGrade?.grade.code ?? "-"}</div>
        </Info>
        <Info label="Current price">
          {bale.currentOffer ? `${formatUsd(bale.currentOffer.pricePerKgUsd)}/kg` : "-"}
          <div className="text-xs text-muted">
            {bale.currentOffer ? `${bale.currentOffer.buyer.code} · value ${formatUsd(value!)}` : ""}
          </div>
        </Info>
      </div>
      {bale.contract && (
        <p className="text-sm text-muted">
          Contract {bale.contract.contractNumber} with {bale.contract.buyer.name}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {gradable && can(user.role, "bale.gradeTimb") && (
          <section className="card">
            <h2 className="mb-2 font-semibold">{timbGrade ? "Re-grade (TIMB)" : "TIMB grade"}</h2>
            <ActionForm action={gradeAction.bind(null, bale.id, "TIMB")} submitLabel="Save grade" icon={<Tag size={16} />} className="space-y-3">
              <Select label="Grade" name="gradeCode" options={gradeOptions} defaultValue={timbGrade?.grade.code} />
            </ActionForm>
            {bale.status === "PRICED" && <p className="mt-2 text-xs text-muted">Re-grading clears the current price.</p>}
          </section>
        )}

        {gradable && can(user.role, "bale.gradeBuyer") && (
          <section className="card">
            <h2 className="mb-2 font-semibold">Buyer grade</h2>
            <ActionForm action={gradeAction.bind(null, bale.id, "BUYER")} submitLabel="Save buyer grade" icon={<Tag size={16} />} className="space-y-3">
              <Select label="Grade" name="gradeCode" options={gradeOptions} defaultValue={buyerGrade?.grade.code} />
            </ActionForm>
          </section>
        )}

        {onSale && isAuction && can(user.role, "bale.bid") && (
          <section className="card">
            <h2 className="mb-2 font-semibold">Bid</h2>
            <ActionForm action={bidAction.bind(null, bale.id)} submitLabel="Place bid" icon={<Gavel size={16} />} className="space-y-3" resetOnSuccess>
              {can(user.role, "bale.bidAnyBuyer") ? (
                <Select label="Buyer" name="buyerId" options={buyerOptions} />
              ) : (
                <p className="text-sm text-muted">Bidding for {user.buyer?.name ?? "your company"}</p>
              )}
              <Field label="Price (USD per kg)" name="price" inputMode="decimal" required />
            </ActionForm>
          </section>
        )}

        {onSale && can(user.role, "bale.priceOverride") && (
          <section className="card">
            <h2 className="mb-2 font-semibold">Set price (supervisor)</h2>
            <ActionForm action={overrideAction.bind(null, bale.id)} submitLabel="Set price" icon={<PencilLine size={16} />} className="space-y-3" resetOnSuccess>
              {!bale.contract && <Select label="Buyer" name="buyerId" options={buyerOptions} />}
              <Field label="Price (USD per kg)" name="price" inputMode="decimal" required />
              <Field label="Reason" name="reason" required hint="Recorded in the audit log." />
            </ActionForm>
          </section>
        )}

        {bale.status === "PRICED" && can(user.role, "bale.decision") && (
          <section className="card">
            <h2 className="mb-2 font-semibold">Grower&apos;s decision</h2>
            <p className="mb-3 text-sm">
              Offer: {formatUsd(bale.currentOffer!.pricePerKgUsd)}/kg from {bale.currentOffer!.buyer.name}, about{" "}
              {formatUsd(value!)} for this bale.
            </p>
            <div className="flex gap-3">
              <ActionForm action={decisionAction.bind(null, bale.id, true)} submitLabel="Grower accepts" icon={<Check size={16} />} className="">
                {null}
              </ActionForm>
              <ActionForm
                action={decisionAction.bind(null, bale.id, false)}
                submitLabel="Grower rejects" icon={<X size={16} />}
                buttonClassName="btn btn-danger"
                className=""
                confirm="Record that the grower rejected this price?"
              >
                {null}
              </ActionForm>
            </div>
          </section>
        )}

        {bale.status === "REJECTED" && can(user.role, "bale.decision") && (
          <section className="card">
            <h2 className="mb-2 font-semibold">Rejected bale</h2>
            <div className="flex gap-3">
              <ActionForm action={reofferAction.bind(null, bale.id)} submitLabel="Put back on sale" icon={<RotateCcw size={16} />} className="">
                {null}
              </ActionForm>
              <ActionForm
                action={withdrawAction.bind(null, bale.id)}
                submitLabel="Withdraw from floor" icon={<PackageX size={16} />}
                buttonClassName="btn btn-danger"
                className=""
                confirm="Withdraw this bale? It cannot be sold on this ticket afterwards."
              >
                {null}
              </ActionForm>
            </div>
          </section>
        )}
      </div>

      {bale.settlementLines.length > 0 && (
        <section className="card text-sm">
          <h2 className="mb-1 font-semibold">Settlement</h2>
          {bale.settlementLines.map((l) => (
            <p key={l.id}>
              <Link href={`/settlements/${l.settlementId}`} className="underline">
                {l.settlement.number}
              </Link>{" "}
              · {l.settlement.status.toLowerCase()}
            </p>
          ))}
        </section>
      )}

      <section className="card overflow-x-auto">
        <h2 className="mb-2 font-semibold">Offers</h2>
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Buyer</th>
              <th>Source</th>
              <th className="num">Price/kg</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {bale.offers.map((o) => (
              <tr key={o.id} className={o.id === bale.currentOfferId ? "font-semibold" : ""}>
                <td>{o.createdAt.toLocaleTimeString("en-ZW")}</td>
                <td>{o.buyer.code}</td>
                <td>{o.source.replace(/_/g, " ").toLowerCase()}</td>
                <td className="num">{formatUsd(o.pricePerKgUsd)}</td>
                <td>{o.reason ?? ""}</td>
              </tr>
            ))}
            {bale.offers.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <Empty>No offers yet.</Empty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">History</h2>
        <ol className="space-y-3 border-l-2 border-border pl-4 text-sm">
          {history.map((h) => (
            <li key={h.id} className="relative">
              <span className="absolute top-1.5 -left-[1.3rem] h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
              <span className="font-medium">{describeEvent(h.action, h.data as Record<string, string> | null, buyerCodes)}</span>
              <span className="block text-xs text-muted">
                {h.actorId ? actorNames.get(h.actorId) : "System"} · {h.createdAt.toLocaleString("en-ZW")}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-medium">{children}</div>
    </div>
  );
}

/** Turns an audit entry into a sentence for the bale's history. */
function describeEvent(action: string, data: Record<string, string> | null, buyerCodes: Map<string, string>): string {
  const price = (v?: string) => (v ? `${formatUsd(v)}/kg` : "");
  switch (action) {
    case "bale.receive":
      return `Received at ${formatNumber(data?.massKg ?? 0, 2)} kg${data?.weighSource === "MANUAL" ? " (weight typed in)" : " from the scale"}`;
    case "bale.grade":
      return `${data?.kind === "TIMB" ? "TIMB grade" : "Buyer grade"} ${data?.grade ?? ""}`;
    case "bale.bid":
      return `${buyerCodes.get(data?.buyerId ?? "") ?? "Buyer"} bid ${price(data?.pricePerKgUsd)}`;
    case "bale.priceOverride":
      return `Price set to ${price(data?.pricePerKgUsd)}: ${data?.reason ?? ""}`;
    case "bale.accept":
      return "Grower accepted the price";
    case "bale.reject":
      return "Grower rejected the price";
    case "bale.reoffer":
      return "Put back on sale";
    case "bale.withdraw":
      return "Withdrawn from the floor";
    default:
      return action.replace("bale.", "");
  }
}
