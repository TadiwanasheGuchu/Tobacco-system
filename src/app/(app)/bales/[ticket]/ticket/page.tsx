import { Package, Scale } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePage } from "@/lib/auth/dal";
import { code128Svg } from "@/lib/barcode";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/money";
import { PrintButton } from "@/components/print-button";
import { PrintLabelButton } from "@/components/print-label-button";

export default async function TicketPage({ params, searchParams }: PageProps<"/bales/[ticket]/ticket">) {
  await requirePage("bale.view");
  const { ticket } = await params;
  const { autoprint } = await searchParams;
  const bale = await db.bale.findUnique({
    where: { ticketNumber: decodeURIComponent(ticket) },
    include: { grower: true, floor: true, season: true, contract: true },
  });
  if (!bale) notFound();

  return (
    <div className="space-y-4">
      <div className="flex gap-3 print:hidden">
        <PrintLabelButton ticket={decodeURIComponent(ticket)} autoPrint={autoprint === "1"} />
        <PrintButton label="Print on paper" primary={false} />
        <Link href="/reception" className="btn">
          <Scale size={16} aria-hidden />
          Next bale
        </Link>
        <Link href={`/bales/${bale.ticketNumber}`} className="btn">
          <Package size={16} aria-hidden />
          Bale details
        </Link>
      </div>
      {/* Sized for a 100 x 75 mm label; adjust for the floor's label printer. */}
      <div className="card mx-auto w-[100mm] space-y-2 bg-white text-black">
        <div className="flex justify-between text-sm font-semibold">
          <span>{bale.floor.name}</span>
          <span>Season {bale.season.year}</span>
        </div>
        <div dangerouslySetInnerHTML={{ __html: code128Svg(bale.ticketNumber) }} className="[&>svg]:h-auto [&>svg]:w-full" />
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="pr-2 text-zinc-600">Grower</td>
              <td className="font-semibold">
                {bale.grower.timbGrowerNumber} · {bale.grower.firstName} {bale.grower.lastName}
              </td>
            </tr>
            <tr>
              <td className="pr-2 text-zinc-600">Mass</td>
              <td className="font-semibold">
                {formatNumber(bale.massKg, 2)} kg {bale.weighSource === "MANUAL" ? "(M)" : ""}
              </td>
            </tr>
            <tr>
              <td className="pr-2 text-zinc-600">Lane</td>
              <td>{bale.lane ?? "-"}</td>
            </tr>
            {bale.contract && (
              <tr>
                <td className="pr-2 text-zinc-600">Contract</td>
                <td>{bale.contract.contractNumber}</td>
              </tr>
            )}
            <tr>
              <td className="pr-2 text-zinc-600">Received</td>
              <td>{bale.receivedAt.toLocaleString("en-ZW")}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
