import { ActionForm, Field } from "@/components/action-form";
import { BrandMark } from "@/components/brand-mark";
import { login } from "./actions";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-text lg:flex lg:flex-col lg:justify-between">
        <LeafPattern />
        <BrandMark subtitle="Floor buying system" />
        <div className="relative max-w-md space-y-4">
          <p className="text-4xl leading-tight font-semibold tracking-tight">
            From the grower&apos;s bale to the grower&apos;s pocket.
          </p>
          <p className="text-sidebar-muted">
            Reception, grading, sales and payment for auction and contract floors, with every bale reported to TIMB.
          </p>
        </div>
        <p className="relative text-xs text-sidebar-muted">Season {new Date().getFullYear()}</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden">
            <BrandMark subtitle="Floor buying system" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Welcome back</h1>
            <p className="mt-1 text-sm text-muted">Sign in with your floor account to start the day.</p>
          </div>
          <ActionForm action={login} submitLabel="Sign in" pendingLabel="Signing in…" buttonClassName="btn btn-primary w-full">
            <Field label="Username" name="username" autoComplete="username" required autoFocus />
            <Field label="Password" name="password" type="password" autoComplete="current-password" required />
          </ActionForm>
          <p className="text-xs text-muted">Forgotten your password? Ask your floor administrator to reset it.</p>
        </div>
      </section>
    </main>
  );
}

/** Soft gold leaf shapes behind the welcome text. */
function LeafPattern() {
  return (
    <svg className="pointer-events-none absolute -right-24 -bottom-24 h-[560px] w-[560px] text-accent opacity-20" viewBox="0 0 200 200" aria-hidden>
      <g fill="currentColor">
        <path d="M100 10c40 30 60 70 40 120-10 25-30 40-40 60-10-20-30-35-40-60C40 80 60 40 100 10z" />
        <path d="M40 60c25 5 45 25 50 55-25-5-45-25-50-55zM160 60c-25 5-45 25-50 55 25-5 45-25 50-55z" opacity=".6" />
      </g>
      <path d="M100 25v170" stroke="#3a2416" strokeWidth="2" opacity=".5" />
    </svg>
  );
}
