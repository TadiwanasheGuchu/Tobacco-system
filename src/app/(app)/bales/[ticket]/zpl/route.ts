import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/money";
import { can } from "@/lib/permissions";
import { ticketZpl } from "@/lib/zpl";

/** The bale's ticket as ZPL, for the reception agent to send to the label printer. */
export async function GET(_request: Request, ctx: RouteContext<"/bales/[ticket]/zpl">) {
  const user = await getSessionUser();
  if (!user) return new Response("Sign in first.", { status: 401 });
  if (!can(user.role, "bale.view")) return new Response("Not allowed.", { status: 403 });
  const { ticket } = await ctx.params;
  const bale = await db.bale.findUnique({
    where: { ticketNumber: decodeURIComponent(ticket) },
    include: { grower: true, floor: true, season: true, contract: true },
  });
  if (!bale) return new Response("Not found.", { status: 404 });
  const zpl = ticketZpl({
    floorName: bale.floor.name,
    seasonYear: bale.season.year,
    ticketNumber: bale.ticketNumber,
    growerNumber: bale.grower.timbGrowerNumber,
    growerName: `${bale.grower.firstName} ${bale.grower.lastName}`,
    massKg: formatNumber(bale.massKg, 2),
    manual: bale.weighSource === "MANUAL",
    lane: bale.lane,
    contractNumber: bale.contract?.contractNumber ?? null,
    receivedAt: bale.receivedAt.toLocaleString("en-ZW"),
  });
  return new Response(zpl, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
