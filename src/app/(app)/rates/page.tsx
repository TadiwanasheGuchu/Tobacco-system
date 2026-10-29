import { ActionForm, Field } from "@/components/action-form";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/money";
import { captureRateAction } from "./actions";

export default async function RatesPage() {
  await requirePage("rates.capture");
  const [rates, split] = await Promise.all([
    db.exchangeRate.findMany({ orderBy: { effectiveFrom: "desc" }, take: 20 }),
    db.paymentSplitRule.findFirst({ where: { effectiveFrom: { lte: new Date() } }, orderBy: { effectiveFrom: "desc" } }),
  ]);
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">ZiG exchange rate</h1>
      <p className="text-sm text-muted">
        Settlements pay {split ? `${formatNumber(split.usdPercent, 0)}% in USD and the rest` : "part"} in ZiG at the latest
        rate captured today. Without a rate for today, settlements with a ZiG portion are blocked.
      </p>
      <ActionForm action={captureRateAction} submitLabel="Save rate" className="card flex flex-wrap items-end gap-3" resetOnSuccess>
        <Field label="ZiG per 1 USD" name="zigPerUsd" inputMode="decimal" required />
      </ActionForm>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Effective from</th>
              <th className="num">ZiG per USD</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id}>
                <td>{r.effectiveFrom.toLocaleString("en-ZW")}</td>
                <td className="num">{formatNumber(r.zigPerUsd, 4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
