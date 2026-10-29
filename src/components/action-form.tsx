"use client";

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionState } from "@/lib/action";
import { useFlash } from "./flash";

interface Props {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  buttonClassName?: string;
  /** Ask before submitting, for actions that are hard to undo. */
  confirm?: string;
  resetOnSuccess?: boolean;
}

export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving…",
  className = "space-y-3",
  buttonClassName = "btn btn-primary",
  confirm,
  resetOnSuccess,
}: Props) {
  const flash = useFlash();
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await action(prev, formData);
    // Raised here rather than in an effect: the form may unmount in the same
    // render that delivers the result (its section disappears after the action).
    if (result?.ok) flash?.(result.ok);
    return result;
  }, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      className={className}
      // Submitting through onSubmit (not the action prop) keeps what the user typed
      // when the server rejects the form; React would otherwise clear the fields.
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonClassName} disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
        {state?.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        {state?.ok && !flash && <p className="text-sm text-ok">{state.ok}</p>}
      </div>
    </form>
  );
}

export function Field({
  label,
  name,
  hint,
  ...input
}: { label: string; name: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input name={name} className="input" {...input} />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Select({
  label,
  name,
  options,
  ...rest
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <select name={name} className="input" {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
