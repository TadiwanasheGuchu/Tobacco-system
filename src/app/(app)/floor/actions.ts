"use server";

import { redirect } from "next/navigation";
import { ActionState, str } from "@/lib/action";
import { requireAction } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { parseTicketNumber } from "@/lib/ticket";

/** Scan or type a ticket on a handheld: opens the bale's floor screen. */
export async function openFloorTicketAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAction("bale.view");
  const ticket = parseTicketNumber(str(formData, "ticket"));
  if (!ticket) return { error: "That ticket number doesn't check out. Scan again or check the digits." };
  if (!(await db.bale.findUnique({ where: { ticketNumber: ticket }, select: { id: true } }))) {
    return { error: `No bale with ticket ${ticket}.` };
  }
  redirect(`/floor/${ticket}`);
}
