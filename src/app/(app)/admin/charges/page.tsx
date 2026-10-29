import { ActionForm, Field, Select } from "@/components/action-form";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/money";
import { AdminNav } from "../admin-nav";
import { createChargeAction, endChargeAction, setSplitAction } from "../actions";

const KIND_LABEL = { PERCENT_OF_GROSS: "% of gross", PER_BALE: "USD per bale", PER_KG: "USD per kg" };

export default async function ChargesPage() {
  await requirePage("admin");
  const now = new Date();
  const [charges, split] = await Promise.all([
    db.chargeRule.findMany({ where: { OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, orderBy: { code: "asc" } }),
    db.paymentSplitRule.findFirst({ where: { effectiveFrom: { lte: now } }, orderBy: { effectiveFrom: "desc" } }),
  ]);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Charges & payment split</h1>
      <AdminNav />
      <p className="text-sm text-muted">
        Levies, commissions and fees deducted from every settlement. Rates change by season and by statutory instrument, so
        confirm them with TIMB and finance before trading. Changes apply to settlements created afterwards.
      </p>
      <section className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
              <th className="num">Value</th>
              <th>Floors</th>
              <th>Since</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {charges.map((c) => (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>{c.name}</td>
                <td>{KIND_LABEL[c.kind]}</td>
                <td className="num">{formatNumber(c.value, 4)}</td>
                <td>{c.floorType?.toLowerCase() ?? "all"}</td>
                <td>{c.effectiveFrom.toLocaleDateString("en-ZW")}</td>
                <td>
                  <ActionForm action={endChargeAction.bind(null, c.id)} submitLabel="End" buttonClassName="btn btn-danger" className="" confirm="Stop applying this charge from now?">
                    {null}
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2 className="mb-2 font-semibold">Add or replace a charge</h2>
        <ActionForm action={createChargeAction} submitLabel="Save charge" className="grid gap-3 sm:grid-cols-3" resetOnSuccess>
          <Field label="Code" name="code" required hint="Same code and floors replaces the current rule." />
          <Field label="Name on statement" name="name" required />
          <Select label="Type" name="kind" options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))} />
          <Field label="Value" name="value" inputMode="decimal" required />
          <Select
            label="Applies to"
            name="floorType"
            options={[
              { value: "", label: "All floors" },
              { value: "AUCTION", label: "Auction floors" },
              { value: "CONTRACT", label: "Contract floors" },
            ]}
          />
        </ActionForm>
      </section>
      <section className="card">
        <h2 className="mb-2 font-semibold">USD / ZiG payment split</h2>
        <p className="mb-2 text-sm">Current: {split ? `${formatNumber(split.usdPercent, 2)}% USD` : "not set"}</p>
        <ActionForm action={setSplitAction} submitLabel="Save split" className="flex flex-wrap items-end gap-3" resetOnSuccess>
          <Field label="Share paid in USD (%)" name="usdPercent" inputMode="decimal" required />
        </ActionForm>
      </section>
    </div>
  );
}
