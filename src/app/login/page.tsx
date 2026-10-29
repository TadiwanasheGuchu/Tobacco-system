import { ActionForm, Field } from "@/components/action-form";
import { login } from "./actions";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">Tobacco Floor System</h1>
        <p className="mb-4 text-sm text-muted">Sign in with your floor account.</p>
        <ActionForm action={login} submitLabel="Sign in" pendingLabel="Signing in…">
          <Field label="Username" name="username" autoComplete="username" required autoFocus />
          <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        </ActionForm>
      </div>
    </main>
  );
}
