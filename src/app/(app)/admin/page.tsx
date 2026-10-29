import { ActionForm, Field, Select } from "@/components/action-form";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { AdminNav } from "./admin-nav";
import { createBuyerAction, createFloorAction, openSeasonAction } from "./actions";

export default async function AdminPage() {
  await requirePage("admin");
  const [floors, seasons, buyers] = await Promise.all([
    db.floor.findMany({ orderBy: { code: "asc" } }),
    db.season.findMany({ orderBy: { year: "desc" } }),
    db.buyer.findMany({ orderBy: { code: "asc" } }),
  ]);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <AdminNav />

      <section className="card space-y-3">
        <h2 className="font-semibold">Marketing seasons</h2>
        <p className="text-sm">
          Open: {seasons.find((s) => s.active)?.year ?? <span className="text-danger">none</span>} · Past:{" "}
          {seasons.filter((s) => !s.active).map((s) => s.year).join(", ") || "-"}
        </p>
        <ActionForm action={openSeasonAction} submitLabel="Open season" className="flex flex-wrap items-end gap-3" confirm="Opening a season closes the current one. Continue?">
          <Field label="Year" name="year" inputMode="numeric" required />
        </ActionForm>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Floors</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {floors.map((f) => (
              <tr key={f.id}>
                <td>{f.code}</td>
                <td>{f.name}</td>
                <td>{f.type.toLowerCase()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ActionForm action={createFloorAction} submitLabel="Add floor" className="grid gap-3 sm:grid-cols-4" resetOnSuccess>
          <Field label="Code" name="code" required />
          <Field label="Name" name="name" required />
          <Select label="Type" name="type" options={[{ value: "AUCTION", label: "Auction" }, { value: "CONTRACT", label: "Contract" }]} />
        </ActionForm>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Buyers and contractors</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>TIMB licence</th>
            </tr>
          </thead>
          <tbody>
            {buyers.map((b) => (
              <tr key={b.id}>
                <td>{b.code}</td>
                <td>{b.name}</td>
                <td>{b.timbLicenseNumber}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ActionForm action={createBuyerAction} submitLabel="Add buyer" className="grid gap-3 sm:grid-cols-4" resetOnSuccess>
          <Field label="Code" name="code" required />
          <Field label="Name" name="name" required />
          <Field label="TIMB licence number" name="timbLicenseNumber" required />
        </ActionForm>
      </section>
    </div>
  );
}
