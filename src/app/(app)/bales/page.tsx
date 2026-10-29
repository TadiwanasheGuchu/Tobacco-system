import { Empty } from "@/components/empty";
import { PageTitle } from "@/components/page-title";
import { Package, Search } from "lucide-react";
import Link from "next/link";
import { ActionForm, Field } from "@/components/action-form";
import { StatusBadge } from "@/components/status-badge";
import type { BaleStatus } from "@/generated/prisma/enums";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber, formatUsd } from "@/lib/money";
import { findTicketAction } from "./actions";

const STATUSES: BaleStatus[] = ["RECEIVED", "GRADED", "PRICED", "ACCEPTED", "REJECTED", "WITHDRAWN", "SETTLED"];

export default async function BalesPage({ searchParams }: PageProps<"/bales">) {
  await requirePage("bale.view");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const floorId = typeof sp.floor === "string" ? sp.floor : undefined;
  const [floors, bales] = await Promise.all([
    db.floor.findMany({ orderBy: { code: "asc" } }),
    db.bale.findMany({
      where: { status, floorId },
      include: {
        grower: true,
        floor: true,
        currentOffer: { include: { buyer: true } },
        gradings: { where: { kind: "TIMB" }, orderBy: { createdAt: "desc" }, take: 1, include: { grade: true } },
      },
      orderBy: { receivedAt: "desc" },
      take: 100,
    }),
  ]);

  const link = (params: Record<string, string | undefined>) => {
    const merged = { status, floor: floorId, ...params };
    const qs = new URLSearchParams(Object.entries(merged).filter((e): e is [string, string] => !!e[1]));
    return `/bales${qs.size ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <PageTitle icon={<Package size={22} />} title="Bales" />
      <ActionForm action={findTicketAction} submitLabel="Open" icon={<Search size={16} />} className="card flex flex-wrap items-end gap-3">
        <Field label="Scan or type a ticket number" name="ticket" autoFocus autoComplete="off" required />
      </ActionForm>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={link({ status: undefined })} className="btn btn-chip" aria-current={!status}>
          All
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} href={link({ status: s })} className="btn btn-chip" aria-current={status === s}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </Link>
        ))}
        <span className="mx-1 self-stretch border-l border-border" />
        <Link href={link({ floor: undefined })} className="btn btn-chip" aria-current={!floorId}>
          All floors
        </Link>
        {floors.map((f) => (
          <Link key={f.id} href={link({ floor: f.id })} className="btn btn-chip" aria-current={floorId === f.id}>
            {f.code}
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Grower</th>
              <th>Floor</th>
              <th>Lane</th>
              <th className="num">Mass (kg)</th>
              <th>TIMB grade</th>
              <th>Buyer</th>
              <th className="num">Price/kg</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {bales.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link href={`/bales/${b.ticketNumber}`} className="font-medium underline">
                    {b.ticketNumber}
                  </Link>
                </td>
                <td>{b.grower.timbGrowerNumber}</td>
                <td>{b.floor.code}</td>
                <td>{b.lane ?? "-"}</td>
                <td className="num">{formatNumber(b.massKg, 2)}</td>
                <td>{b.gradings[0]?.grade.code ?? "-"}</td>
                <td>{b.currentOffer?.buyer.code ?? "-"}</td>
                <td className="num">{b.currentOffer ? formatUsd(b.currentOffer.pricePerKgUsd) : "-"}</td>
                <td>
                  <StatusBadge status={b.status} />
                </td>
              </tr>
            ))}
            {bales.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <Empty>No bales match.</Empty>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
