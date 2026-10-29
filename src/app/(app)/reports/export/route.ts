import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { can } from "@/lib/permissions";
import { loanRecovery, parseRange, paymentList, salesByBuyer, salesByFloor, salesByGrade, SalesRow } from "@/lib/services/reports";

const METHOD = { BANK_TRANSFER: "Bank transfer", MOBILE_MONEY: "Mobile money", CASH: "Cash" };

function salesCsv(rows: SalesRow[], first: string) {
  return toCsv(
    [first, "Bales", "Mass (kg)", "Value (USD)", "Average price (USD/kg)"],
    rows.map((r) => [r.label, r.bales, r.massKg.toFixed(2), r.valueUsd.toFixed(2), r.avgPriceUsd.toFixed(4)]),
  );
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return new Response("Sign in first.", { status: 401 });
  if (!can(user.role, "reports.view")) return new Response("Not allowed.", { status: 403 });

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const range = parseRange(params);
  const span = range.fromLabel === range.toLabel ? range.fromLabel : `${range.fromLabel}_to_${range.toLabel}`;

  let csv: string;
  switch (params.type) {
    case "grade":
      csv = salesCsv(await salesByGrade(range), "Grade");
      break;
    case "buyer":
      csv = salesCsv(await salesByBuyer(range), "Buyer");
      break;
    case "floor":
      csv = salesCsv(await salesByFloor(range), "Floor");
      break;
    case "loans":
      csv = toCsv(
        ["Contractor", "Contracts", "Input loans (USD)", "Recovered (USD)", "Outstanding (USD)", "Recovered %"],
        (await loanRecovery()).map((r) => [
          `${r.code} · ${r.name}`,
          r.contracts,
          r.loansUsd.toFixed(2),
          r.recoveredUsd.toFixed(2),
          r.outstandingUsd.toFixed(2),
          r.recoveredPercent.toFixed(1),
        ]),
      );
      break;
    case "payments":
      csv = toCsv(
        [
          "Settlement",
          "Date",
          "Status",
          "TIMB grower number",
          "Grower",
          "National ID",
          "Method",
          "Bank",
          "Account",
          "Mobile money",
          "Net (USD)",
          "Pay USD",
          "Pay ZiG",
          "ZiG rate",
          "Payment reference",
        ],
        (await paymentList(range)).map((s) => [
          s.number,
          s.createdAt.toISOString(),
          s.status,
          s.grower.timbGrowerNumber,
          `${s.grower.firstName} ${s.grower.lastName}`,
          s.grower.nationalId,
          METHOD[s.paymentMethod],
          s.paymentMethod === "BANK_TRANSFER" ? s.grower.bankName : "",
          s.paymentMethod === "BANK_TRANSFER" ? s.grower.bankAccountNumber : "",
          s.paymentMethod === "MOBILE_MONEY" ? s.grower.mobileMoneyNumber : "",
          s.netUsd.toFixed(2),
          s.payUsd.toFixed(2),
          s.payZig.toFixed(2),
          s.zigPerUsd.toFixed(4),
          s.paymentReference ?? "",
        ]),
      );
      break;
    default:
      return new Response("Unknown report type.", { status: 400 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${params.type}-${span}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
