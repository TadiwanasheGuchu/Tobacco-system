import { headers } from "next/headers";
import { Plus, Power, RefreshCw, Scale } from "lucide-react";
import { ActionForm, Field, Select } from "@/components/action-form";
import { Empty } from "@/components/empty";
import { PageTitle } from "@/components/page-title";
import { requirePage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { AdminNav } from "../admin-nav";
import { createScaleStationAction, rotateScaleSecretAction, setScaleActiveAction } from "../actions";

export default async function ScalesPage() {
  await requirePage("admin");
  const [stations, floors] = await Promise.all([
    db.scaleStation.findMany({ include: { floor: true, _count: { select: { bales: true } } }, orderBy: { code: "asc" } }),
    db.floor.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
  ]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  return (
    <div className="space-y-5">
      <PageTitle icon={<Scale size={22} />} title="Scales" subtitle="Reception PCs whose scale weights are trusted." />
      <AdminNav />
      <p className="text-sm text-muted">
        Each reception PC runs the agent (see <code>agent/README.md</code>). It signs every stable weight with its station
        secret, so the server knows the weight came from that scale and wasn&apos;t typed in. Keep secrets private; if one
        leaks, issue a new one.
      </p>

      <section className="space-y-3">
        {stations.length === 0 && (
          <div className="card">
            <Empty>No scales registered yet.</Empty>
          </div>
        )}
        {stations.map((s) => (
          <div key={s.id} className={`card space-y-3 ${s.active ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <div className="font-semibold">
                  {s.code} · {s.name}
                </div>
                <div className="text-sm text-muted">
                  {s.floor.name} · {s._count.bales} bales weighed · last used {s.lastUsedAt?.toLocaleString("en-ZW") ?? "never"}
                  {!s.active && " · switched off"}
                </div>
              </div>
              <div className="ml-auto flex gap-2">
                <ActionForm
                  action={rotateScaleSecretAction.bind(null, s.id)}
                  submitLabel="New secret"
                  icon={<RefreshCw size={16} />}
                  buttonClassName="btn"
                  className=""
                  confirm="Issue a new secret? The PC's agent stops working until you update it."
                >
                  {null}
                </ActionForm>
                <ActionForm
                  action={setScaleActiveAction.bind(null, s.id, !s.active)}
                  submitLabel={s.active ? "Switch off" : "Switch on"}
                  icon={<Power size={16} />}
                  buttonClassName={s.active ? "btn btn-danger" : "btn"}
                  className=""
                >
                  {null}
                </ActionForm>
              </div>
            </div>
            <details>
              <summary className="cursor-pointer text-sm font-medium">Agent settings for this PC</summary>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-surface-2 p-3 text-xs">{`STATION_CODE=${s.code}
STATION_SECRET=${s.secret}
ALLOWED_ORIGIN=${origin}
SCALE_PORT=COM3          # or /dev/ttyUSB0, or "sim" to test without a scale
SCALE_BAUD=9600
PRINTER=tcp://192.168.1.50:9100`}</pre>
            </details>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Add a scale</h2>
        <ActionForm action={createScaleStationAction} submitLabel="Add scale" icon={<Plus size={16} />} className="grid gap-3 sm:grid-cols-4" resetOnSuccess>
          <Field label="Station code" name="code" required placeholder="HAF-R1" />
          <Field label="Name" name="name" placeholder="Reception desk 1" />
          <Select label="Floor" name="floorId" options={floors.map((f) => ({ value: f.id, label: f.code }))} />
        </ActionForm>
      </section>
    </div>
  );
}
