import Link from "next/link";
import { ChevronRight, ScanLine } from "lucide-react";
import { Empty } from "@/components/empty";
import { PageTitle } from "@/components/page-title";
import { ScanBox } from "@/components/scan-box";
import { StatusBadge } from "@/components/status-badge";
import type { Prisma } from "@/generated/prisma/client";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber, formatUsd } from "@/lib/money";
import { can } from "@/lib/permissions";
import { openFloorTicketAction } from "./actions";

/** Handheld home: scan a ticket, or pick from the bales waiting for this person's job. */
export default async function FloorPage() {
  const user = await requirePage("bale.view");
  const floorFilter = user.floorId ? { floorId: user.floorId } : {};

  let title = "Bales on the floor";
  let where: Prisma.BaleWhereInput = { ...floorFilter, status: { in: ["RECEIVED", "GRADED", "PRICED"] } };
  if (can(user.role, "bale.gradeTimb") && !can(user.role, "bale.priceOverride")) {
    title = "Waiting for a TIMB grade";
    where = { ...floorFilter, status: "RECEIVED" };
  } else if (user.role === "BUYER") {
    title = "On sale now";
    where = { status: { in: ["GRADED", "PRICED"] }, floor: { type: "AUCTION" } };
  } else if (can(user.role, "bale.decision") && !can(user.role, "bale.priceOverride")) {
    title = "Waiting for the grower";
    where = { ...floorFilter, status: "PRICED" };
  }

  const bales = await db.bale.findMany({
    where,
    include: {
      grower: true,
      currentOffer: { include: { buyer: true } },
      gradings: { where: { kind: "TIMB" }, orderBy: { createdAt: "desc" }, take: 1, include: { grade: true } },
    },
    orderBy: { receivedAt: "asc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageTitle icon={<ScanLine size={22} />} title="Floor" subtitle={user.floor?.name ?? "All floors"} />
      <ScanBox action={openFloorTicketAction} />

      <section className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="font-semibold">{title}</h2>
          <span className="text-sm text-muted">{bales.length}</span>
        </div>
        {bales.length === 0 ? (
          <div className="card">
            <Empty>Nothing waiting. Nice work.</Empty>
          </div>
        ) : (
          <ul className="space-y-2">
            {bales.map((b) => {
              const leading = user.buyerId && b.currentOffer?.buyerId === user.buyerId;
              return (
                <li key={b.id}>
                  <Link href={`/floor/${b.ticketNumber}`} className="card flex items-center gap-3 !p-4 active:scale-[0.99]">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{b.ticketNumber}</span>
                        {leading && <span className="rounded-full bg-leaf-soft px-2 py-0.5 text-xs font-semibold text-leaf">You lead</span>}
                      </div>
                      <div className="mt-0.5 truncate text-sm text-muted">
                        {formatNumber(b.massKg, 1)} kg · lane {b.lane ?? "-"}
                        {b.gradings[0] ? ` · ${b.gradings[0].grade.code}` : ""}
                        {b.currentOffer ? ` · ${formatUsd(b.currentOffer.pricePerKgUsd)}/kg ${b.currentOffer.buyer.code}` : ""}
                      </div>
                    </div>
                    <StatusBadge status={b.status} />
                    <ChevronRight size={18} className="text-muted" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
