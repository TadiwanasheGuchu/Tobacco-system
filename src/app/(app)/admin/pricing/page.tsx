import { ActionForm, Field, Select } from "@/components/action-form";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatUsd } from "@/lib/money";
import { AdminNav } from "../admin-nav";
import { createGradeAction, setGradePriceAction } from "../actions";

export default async function PricingPage() {
  await requirePage("admin");
  const season = await db.season.findFirst({ where: { active: true } });
  const [grades, buyers, prices] = await Promise.all([
    db.grade.findMany({ orderBy: { code: "asc" } }),
    db.buyer.findMany({ orderBy: { code: "asc" } }),
    season
      ? db.gradePrice.findMany({ where: { seasonId: season.id }, orderBy: { effectiveFrom: "desc" } })
      : Promise.resolve([]),
  ]);
  // Latest price per contractor and grade.
  const current = new Map<string, (typeof prices)[number]>();
  for (const p of prices) if (!current.has(`${p.buyerId}|${p.gradeId}`)) current.set(`${p.buyerId}|${p.gradeId}`, p);
  const contractors = buyers.filter((b) => [...current.keys()].some((k) => k.startsWith(b.id)));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Grades & contract prices</h1>
      <AdminNav />
      <p className="text-sm text-muted">
        Contract floor bales are priced automatically from the contractor&apos;s list for season {season?.year ?? "-"}. A new
        price applies to bales priced after it is saved; already priced bales keep their offer.
      </p>
      <section className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Grade</th>
              <th>Description</th>
              {contractors.map((c) => (
                <th key={c.id} className="num">
                  {c.code} USD/kg
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grades.map((g) => (
              <tr key={g.id}>
                <td className="font-medium">{g.code}</td>
                <td>{g.description}</td>
                {contractors.map((c) => {
                  const p = current.get(`${c.id}|${g.id}`);
                  return (
                    <td key={c.id} className="num">
                      {p ? formatUsd(p.pricePerKgUsd) : "-"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2 className="mb-2 font-semibold">Set a contract price</h2>
        <ActionForm action={setGradePriceAction} submitLabel="Save price" className="grid gap-3 sm:grid-cols-4" resetOnSuccess>
          <Select label="Contractor" name="buyerId" options={buyers.map((b) => ({ value: b.id, label: b.code }))} />
          <Select label="Grade" name="gradeId" options={grades.map((g) => ({ value: g.id, label: g.code }))} />
          <Field label="USD per kg" name="pricePerKgUsd" inputMode="decimal" required />
        </ActionForm>
      </section>
      <section className="card">
        <h2 className="mb-2 font-semibold">Add grade</h2>
        <ActionForm action={createGradeAction} submitLabel="Add grade" className="grid gap-3 sm:grid-cols-3" resetOnSuccess>
          <Field label="Code" name="code" required />
          <Field label="Description" name="description" required />
        </ActionForm>
      </section>
    </div>
  );
}
