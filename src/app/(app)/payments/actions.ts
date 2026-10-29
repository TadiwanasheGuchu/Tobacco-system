"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { Currency } from "@/generated/prisma/enums";
import { ActionState, runAction, str } from "@/lib/action";
import { requireAction } from "@/lib/auth/dal";
import { BatchMethod, cancelPaymentBatch, confirmPaymentBatch, createPaymentBatch } from "@/lib/services/payments";

export async function createBatchAction(method: BatchMethod, currency: Currency, _: ActionState): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    const user = await requireAction("settlement.pay");
    const { batch } = await createPaymentBatch(user, method, currency);
    id = batch.id;
  });
  if (id) redirect(`/payments/${id}`);
  return result;
}

export async function confirmBatchAction(batchId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireAction("settlement.pay");
    const { paid, lines } = await confirmPaymentBatch(user, batchId, str(formData, "reference"));
    refresh();
    return `Confirmed. ${paid} of ${lines} settlement${lines === 1 ? "" : "s"} now fully paid.`;
  });
}

export async function cancelBatchAction(batchId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireAction("settlement.pay");
    await cancelPaymentBatch(user, batchId, str(formData, "reason"));
    refresh();
    return "Batch cancelled. Its settlements can go in a new batch.";
  });
}
