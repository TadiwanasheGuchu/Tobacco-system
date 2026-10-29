import "server-only";
import { redirect } from "next/navigation";
import { can, Permission } from "@/lib/permissions";
import { getSessionUser, SessionUser } from "./session";

export class ForbiddenError extends Error {
  constructor() {
    super("You do not have permission to do that.");
  }
}

/** For pages: redirects to login when signed out, shows 403 text when not allowed. */
export async function requirePage(permission?: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (permission && !can(user.role, permission)) redirect("/?forbidden=1");
  return user;
}

/** For server actions: every action re-checks the session and permission itself. */
export async function requireAction(permission: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!can(user.role, permission)) throw new ForbiddenError();
  return user;
}
