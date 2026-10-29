import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Gavel, RotateCcw, X } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { BidPad } from "@/components/bid-pad";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { dec, formatNumber, formatUsd, round2 } from "@/lib/money";
import { can } from "@/lib/permissions";
import { bidAction, decisionAction, gradeAction, reofferAction } from "../../bales/actions";

/** One bale, laid out for a phone: big targets, one job at a time. */
export default async function FloorBalePage({ params }: PageProps<"/floor/[ticket]">) {
  const user = await requirePage("bale.view");
  const { ticket } = await params;
  const bale = await db.bale.findUnique({
    where: { ticketNumber: decodeURIComponent(ticket) },
    include: {
      grower: true,
      floor: true,
      currentOffer: { include: { buyer: true } },
      gradings: { include: { grade: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!bale) notFound();
  const grades = await db.grade.findMany({ where: { active: true }, orderBy: { code: "asc" } });

  const timbGrade = bale.gradings.find((g) => g.kind === "TIMB");
  const buyerGrade = bale.gradings.find((g) => g.kind === "BUYER");
  const gradable = ["RECEIVED", "GRADED", "PRICED"].includes(bale.status);
  const onSale = bale.status === "GRADED" || bale.status === "PRICED";
  const current = bale.currentOffer ? Number(bale.currentOffer.pricePerKgUsd) : undefined;
  const value = bale.currentOffer ? round2(dec(bale.massKg).mul(dec(bale.currentOffer.pricePerKgUsd))) : null;
  const leading = !!user.buyerId && bale.currentOffer?.buyerId === user.buyerId;

  const canGradeTimb = gradable && can(user.role, "bale.gradeTimb");
  const canGradeBuyer = gradable && !canGradeTimb && can(user.role, "bale.gradeBuyer");
  const canBid = onSale && bale.floor.type === "AUCTION" && user.role === "BUYER" && !leading;
  const canDecide = bale.status === "PRICED" && can(user.role, "bale.decision");

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/floor" className="inline-flex items-center gap-1.5 text-sm text-muted">
        <ArrowLeft size={16} aria-hidden /> Back to scanning
      </Link>

      <section className="card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-xl font-semibold">{bale.ticketNumber}</div>
            <div className="text-sm text-muted">
              {bale.floor.code} · lane {bale.lane ?? "-"} · {bale.grower.firstName} {bale.grower.lastName}
            </div>
          </div>
          <StatusBadge status={bale.status} />
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <Fact label="Mass" value={`${formatNumber(bale.massKg, 1)} kg`} />
          <Fact label="TIMB grade" value={timbGrade?.grade.code ?? "–"} />
          <Fact label="Price" value={bale.currentOffer ? formatUsd(bale.currentOffer.pricePerKgUsd) : "–"} />
        </dl>
        {bale.currentOffer && (
          <p className="text-center text-sm text-muted">
            {leading ? "You are leading" : `${bale.currentOffer.buyer.name} leads`} · about {formatUsd(value!)} for this bale
          </p>
        )}
      </section>

      {canBid && (
        <section className="card">
          <ActionForm
            action={bidAction.bind(null, bale.id)}
            submitLabel="Place bid"
            icon={<Gavel size={20} />}
            buttonClassName="btn btn-primary h-14 w-full text-base"
            className="space-y-4"
            successHref="/floor"
          >
            <BidPad start={current !== undefined ? current + 0.05 : 3} minimum={current} />
          </ActionForm>
        </section>
      )}

      {(canGradeTimb || canGradeBuyer) && (
        <GradeSection collapsible={canGradeBuyer}>
          <h2 className="font-semibold">
            {canGradeTimb ? "Tap the TIMB grade" : "Tap your grade"}
            {(canGradeTimb ? timbGrade : buyerGrade) && (
              <span className="ml-2 text-sm font-normal text-muted">now {(canGradeTimb ? timbGrade : buyerGrade)!.grade.code}</span>
            )}
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {grades.map((g) => (
              <ActionForm
                key={g.id}
                action={gradeAction.bind(null, bale.id, canGradeTimb ? "TIMB" : "BUYER")}
                submitLabel={g.code}
                pendingLabel={g.code}
                className=""
                buttonClassName={`btn h-16 w-full !rounded-2xl text-lg font-semibold tracking-wide ${
                  (canGradeTimb ? timbGrade : buyerGrade)?.gradeId === g.id ? "btn-primary" : ""
                }`}
                successHref={canGradeTimb ? "/floor" : undefined}
              >
                <input type="hidden" name="gradeCode" value={g.code} />
              </ActionForm>
            ))}
          </div>
        </GradeSection>
      )}

      {canDecide && (
        <section className="card space-y-3">
          <h2 className="font-semibold">Grower&apos;s answer</h2>
          <p className="text-sm text-muted">
            {formatUsd(bale.currentOffer!.pricePerKgUsd)}/kg from {bale.currentOffer!.buyer.name}, about {formatUsd(value!)}.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <ActionForm
              action={decisionAction.bind(null, bale.id, true)}
              submitLabel="Accept"
              icon={<Check size={22} />}
              className=""
              buttonClassName="btn btn-primary h-20 w-full !rounded-2xl text-lg"
              successHref="/floor"
            >
              {null}
            </ActionForm>
            <ActionForm
              action={decisionAction.bind(null, bale.id, false)}
              submitLabel="Reject"
              icon={<X size={22} />}
              className=""
              buttonClassName="btn btn-danger h-20 w-full !rounded-2xl text-lg"
              confirm="Record that the grower rejected this price?"
              successHref="/floor"
            >
              {null}
            </ActionForm>
          </div>
        </section>
      )}

      {bale.status === "REJECTED" && can(user.role, "bale.decision") && (
        <section className="card">
          <ActionForm
            action={reofferAction.bind(null, bale.id)}
            submitLabel="Put back on sale"
            icon={<RotateCcw size={18} />}
            buttonClassName="btn h-14 w-full"
            className=""
            successHref="/floor"
          >
            {null}
          </ActionForm>
        </section>
      )}

      {!canGradeTimb && !canGradeBuyer && !canBid && !canDecide && (
        <p className="card text-center text-sm text-muted">
          {leading ? "You're leading on this bale. Waiting for other bids or the grower." : "Nothing for you to do on this bale right now."}
        </p>
      )}

      <Link href={`/bales/${bale.ticketNumber}`} className="block text-center text-sm text-muted underline">
        Full bale details and history
      </Link>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** TIMB grading is the main job, so it is open; a buyer's own grade is optional and folds away. */
function GradeSection({ collapsible, children }: { collapsible: boolean; children: React.ReactNode }) {
  if (!collapsible) return <section className="card space-y-3">{children}</section>;
  return (
    <details className="card group">
      <summary className="cursor-pointer list-none font-semibold">
        Record your own grade <span className="text-sm font-normal text-muted">(optional)</span>
      </summary>
      <div className="mt-3 space-y-3 [&>h2]:hidden">{children}</div>
    </details>
  );
}
