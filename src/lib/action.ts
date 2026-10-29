import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { ForbiddenError } from "@/lib/auth/dal";
import { DomainError } from "@/lib/services/common";

export type ActionState = { error?: string; ok?: string } | null;

/**
 * Runs a server action body and turns expected failures into a message for the
 * form. Unexpected errors are logged and shown generically.
 */
export async function runAction(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const ok = await fn();
    return { ok: ok ?? "Saved." };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof DomainError || err instanceof ForbiddenError) return { error: err.message };
    if (err instanceof ZodError) return { error: err.issues[0]?.message ?? "Check the form and try again." };
    console.error(err);
    return { error: "Something went wrong. The error has been logged." };
  }
}

export function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}
