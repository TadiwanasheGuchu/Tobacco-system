"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { ActionState, runAction, str } from "@/lib/action";
import { requireAction } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import {
  gradeBale,
  overridePrice,
  placeBid,
  receiveBale,
  recordDecision,
  reofferBale,
  withdrawBale,
} from "@/lib/services/bales";
import { parseTicketNumber } from "@/lib/ticket";

export async function receiveBaleAction(_: ActionState, formData: FormData): Promise<ActionState> {
  let ticket = "";
  const result = await runAction(async () => {
    const user = await requireAction("bale.receive");
    const bale = await receiveBale(user, {
      timbGrowerNumber: str(formData, "timbGrowerNumber"),
      floorId: str(formData, "floorId"),
      massKg: str(formData, "massKg"),
      // Signed by the reception agent; without it the weight is typed (MANUAL).
      scaleReading: str(formData, "scaleReading") || undefined,
      lane: str(formData, "lane"),
    });
    ticket = bale.ticketNumber;
  });
  if (ticket) redirect(`/bales/${ticket}/ticket?autoprint=1`);
  return result;
}

export async function findTicketAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const ticket = parseTicketNumber(str(formData, "ticket"));
  if (!ticket) return { error: "That ticket number is not valid. Check the digits and try again." };
  redirect(`/bales/${ticket}`);
}

export async function gradeAction(baleId: string, kind: "TIMB" | "BUYER", _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireAction(kind === "TIMB" ? "bale.gradeTimb" : "bale.gradeBuyer");
    const { priced } = await gradeBale(user, baleId, str(formData, "gradeCode"), kind);
    refresh();
    return priced ? "Graded and priced from the contract price list." : "Grade recorded.";
  });
}

export async function bidAction(baleId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireAction("bale.bid");
    const anyBuyer = can(user.role, "bale.bidAnyBuyer");
    const buyerId = anyBuyer ? str(formData, "buyerId") : (user.buyerId ?? "");
    await placeBid(user, baleId, buyerId, str(formData, "price"), anyBuyer);
    refresh();
    return "Bid recorded.";
  });
}

export async function overrideAction(baleId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireAction("bale.priceOverride");
    await overridePrice(user, baleId, str(formData, "price"), str(formData, "reason"), str(formData, "buyerId") || undefined);
    refresh();
    return "Price set.";
  });
}

export async function decisionAction(baleId: string, accept: boolean, _: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireAction("bale.decision");
    await recordDecision(user, baleId, accept);
    refresh();
    return accept ? "Accepted. The sale is queued for TIMB." : "Rejected. The bale can be re-offered or withdrawn.";
  });
}

export async function reofferAction(baleId: string, _: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireAction("bale.decision");
    await reofferBale(user, baleId);
    refresh();
    return "Bale is back on sale.";
  });
}

export async function withdrawAction(baleId: string, _: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireAction("bale.decision");
    await withdrawBale(user, baleId);
    refresh();
    return "Bale withdrawn.";
  });
}
