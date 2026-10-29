import { ActionForm, Field, Select } from "@/components/action-form";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { receiveBaleAction } from "../bales/actions";

export default async function ReceptionPage() {
  const user = await requirePage("bale.receive");
  const floors = await db.floor.findMany({ where: { active: true }, orderBy: { code: "asc" } });
  const ordered = user.floorId ? [...floors].sort((a, b) => Number(b.id === user.floorId) - Number(a.id === user.floorId)) : floors;

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Receive bale</h1>
      <p className="text-sm text-muted">
        Scan or type the grower number, weigh the bale and save. A barcoded ticket opens for printing. On contract floors
        the grower&apos;s contract for this season is attached automatically.
      </p>
      <ActionForm action={receiveBaleAction} submitLabel="Save and print ticket" className="card space-y-3">
        <Select
          label="Floor"
          name="floorId"
          options={ordered.map((f) => ({ value: f.id, label: `${f.code} · ${f.name} (${f.type.toLowerCase()})` }))}
        />
        <Field label="TIMB grower number" name="timbGrowerNumber" required autoFocus autoComplete="off" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Mass (kg)"
            name="massKg"
            inputMode="decimal"
            required
            hint="Typed weights are marked as manual. Scale integration comes with the reception agent."
          />
          <Field label="Lane / row" name="lane" />
        </div>
      </ActionForm>
    </div>
  );
}
