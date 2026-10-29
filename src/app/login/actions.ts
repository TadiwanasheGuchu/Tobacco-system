"use server";

import { redirect } from "next/navigation";
import { ActionState, runAction, str } from "@/lib/action";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, deleteSession } from "@/lib/auth/session";
import { audit, db } from "@/lib/db";
import { DomainError } from "@/lib/services/common";

export async function login(_: ActionState, formData: FormData): Promise<ActionState> {
  const username = str(formData, "username").trim().toLowerCase();
  const password = str(formData, "password");
  let signedIn = false;
  // runAction turns an unreachable database into a message instead of a crash.
  const result = await runAction(async () => {
    const user = await db.user.findUnique({ where: { username } });
    // Same message whether the user or the password is wrong.
    if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
      await audit(db, user?.id ?? null, "auth.loginFailed", "User", user?.id ?? username);
      throw new DomainError("Wrong username or password.");
    }
    await createSession(user.id);
    await audit(db, user.id, "auth.login", "User", user.id);
    signedIn = true;
  });
  if (signedIn) redirect("/");
  return result;
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
