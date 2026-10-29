import { getSessionUser } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { audit, db } from "@/lib/db";
import { can } from "@/lib/permissions";

/**
 * Payout file for a batch. These are generic layouts; each bank and mobile
 * money provider has its own upload template, so map these columns to it (or
 * add a provider-specific format here) once you have the provider's spec.
 */
export async function GET(_request: Request, ctx: RouteContext<"/payments/[id]/file">) {
  const user = await getSessionUser();
  if (!user) return new Response("Sign in first.", { status: 401 });
  if (!can(user.role, "settlement.pay")) return new Response("Not allowed.", { status: 403 });

  const { id } = await ctx.params;
  const batch = await db.paymentBatch.findUnique({ where: { id }, include: { lines: { include: { settlement: { include: { grower: true } } } } } });
  if (!batch) return new Response("Not found.", { status: 404 });
  if (batch.status === "CANCELLED") return new Response("This batch was cancelled.", { status: 409 });

  const csv =
    batch.method === "MOBILE_MONEY"
      ? toCsv(
          ["Mobile number", "Amount", "Currency", "Name", "Reference"],
          batch.lines.map((l) => [l.payeeAccount, l.amount.toFixed(2), batch.currency, l.payeeName, l.reference]),
        )
      : toCsv(
          ["Beneficiary name", "Bank", "Account number", "Amount", "Currency", "Reference", "National ID"],
          batch.lines.map((l) => [
            l.payeeName,
            l.payeeBank,
            l.payeeAccount,
            l.amount.toFixed(2),
            batch.currency,
            l.reference,
            l.settlement.grower.nationalId,
          ]),
        );

  // Who downloaded a payout file, and when, matters for fraud investigations.
  await audit(db, user.id, "payments.fileDownload", "PaymentBatch", batch.id, { number: batch.number });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${batch.number}-${batch.method === "MOBILE_MONEY" ? "mobile-money" : "bank"}-${batch.currency}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
