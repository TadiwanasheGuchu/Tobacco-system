import { PageTitle } from "@/components/page-title";
import { ShieldCheck, UserPlus } from "lucide-react";
import { ActionForm, Field } from "@/components/action-form";
import { requirePage } from "@/lib/auth/dal";
import { registerGrowerAction } from "../actions";

export default async function NewGrowerPage() {
  await requirePage("grower.register");
  return (
    <div className="max-w-2xl space-y-4">
      <PageTitle icon={<UserPlus size={22} />} title="Register grower" />
      <p className="text-sm text-muted">
        The grower number and national ID are checked with TIMB. If TIMB can&apos;t be reached the grower is saved but
        cannot sell until verified.
      </p>
      <ActionForm action={registerGrowerAction} submitLabel="Register and verify" icon={<ShieldCheck size={16} />} pendingLabel="Checking with TIMB…" className="card space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="TIMB grower number" name="timbGrowerNumber" required autoFocus />
          <Field label="National ID" name="nationalId" required placeholder="63-123456A-42" />
          <Field label="First name" name="firstName" required />
          <Field label="Last name" name="lastName" required />
          <Field label="Phone" name="phone" type="tel" />
          <Field label="Province" name="province" />
          <Field label="District" name="district" />
        </div>
        <h2 className="pt-2 font-semibold">Payment details</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Bank" name="bankName" />
          <Field label="Account number" name="bankAccountNumber" />
          <Field label="Mobile money number" name="mobileMoneyNumber" type="tel" />
        </div>
      </ActionForm>
    </div>
  );
}
