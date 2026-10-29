"use server";

import { redirect } from "next/navigation";
import { ActionState, str } from "@/lib/action";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, deleteSession } from "@/lib/auth/session";
import { audit, db } from "@/lib/db";

export async function login(_: ActionState, formData: FormData): Promise<ActionState> {
  const username = str(formData, "username").trim().toLowerCase();
  const password = str(formData, "password");
  const user = await db.user.findUnique({ where: { username } });
  // Same message whether the user or the password is wrong.
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    await audit(db, user?.id ?? null, "auth.loginFailed", "User", user?.id ?? username);
    return { error: "Wrong username or password." };
  }
  await createSession(user.id);
  await audit(db, user.id, "auth.login", "User", user.id);
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
