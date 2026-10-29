"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { ActionState, runAction, str } from "@/lib/action";
import { requireAction } from "@/lib/auth/dal";
import { DomainError } from "@/lib/services/common";
import { createSettlement, markSettlementPaid, reverseSettlement } from "@/lib/services/settlements";

const METHODS: PaymentMethod[] = ["BANK_TRANSFER", "MOBILE_MONEY", "CASH"];

export async function createSettlementAction(
  growerId: string,
  floorId: string,
  contractId: string | null,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    const user = await requireAction("settlement.create");
    const method = METHODS.find((m) => m === str(formData, "paymentMethod"));
    if (!method) throw new DomainError("Choose a payment method.");
    const settlement = await createSettlement(user, growerId, { floorId, contractId }, method);
    id = settlement.id;
  });
  if (id) redirect(`/settlements/${id}`);
  return result;
}

export async function paySettlementAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireAction("settlement.pay");
    await markSettlementPaid(user, id, str(formData, "reference"));
    refresh();
    return "Payment released.";
  });
}

export async function reverseSettlementAction(id: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireAction("settlement.reverse");
    await reverseSettlement(user, id, str(formData, "reason"));
    refresh();
    return "Settlement reversed. Its bales can be settled again.";
  });
}
