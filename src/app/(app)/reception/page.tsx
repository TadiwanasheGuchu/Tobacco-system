import { PageTitle } from "@/components/page-title";
import { Printer, Scale } from "lucide-react";
import { ActionForm, Field, Select } from "@/components/action-form";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { ScaleReader } from "@/components/scale-reader";
import { manualWeightAllowed } from "@/lib/services/bales";
import { receiveBaleAction } from "../bales/actions";

export default async function ReceptionPage() {
  const user = await requirePage("bale.receive");
  const floors = await db.floor.findMany({ where: { active: true }, orderBy: { code: "asc" } });
  const ordered = user.floorId ? [...floors].sort((a, b) => Number(b.id === user.floorId) - Number(a.id === user.floorId)) : floors;

  return (
    <div className="max-w-xl space-y-4">
      <PageTitle icon={<Scale size={22} />} title="Receive bale" />
      <p className="text-sm text-muted">
        Scan or type the grower number, put the bale on the scale and save once the weight is stable. The ticket prints
        on the label printer. On contract floors the grower&apos;s contract for this season is attached automatically.
      </p>
      <ActionForm action={receiveBaleAction} submitLabel="Save and print ticket" icon={<Printer size={16} />} className="card space-y-3">
        <Select
          label="Floor"
          name="floorId"
          options={ordered.map((f) => ({ value: f.id, label: `${f.code} · ${f.name} (${f.type.toLowerCase()})` }))}
        />
        <Field label="TIMB grower number" name="timbGrowerNumber" required autoFocus autoComplete="off" />
        <ScaleReader manualAllowed={manualWeightAllowed(user.role)} hint="Typed weights are marked as manual (M) on the ticket." />
        <Field label="Lane / row" name="lane" />
      </ActionForm>
    </div>
  );
}
