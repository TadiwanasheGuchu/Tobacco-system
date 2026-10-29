"use server";

import { refresh } from "next/cache";
import { ActionState, runAction, str } from "@/lib/action";
import { requireAction } from "@/lib/auth/dal";
import { audit, db } from "@/lib/db";
import { DomainError } from "@/lib/services/common";

export async function captureRateAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireAction("rates.capture");
    const rate = str(formData, "zigPerUsd").trim();
    if (!/^\d+(\.\d{1,4})?$/.test(rate) || Number(rate) <= 0) throw new DomainError("Enter the rate as ZiG per 1 USD, e.g. 26.85.");
    await db.$transaction(async (tx) => {
      const r = await tx.exchangeRate.create({ data: { zigPerUsd: rate, effectiveFrom: new Date(), capturedById: user.id } });
      await audit(tx, user.id, "rate.capture", "ExchangeRate", r.id, { zigPerUsd: rate });
    });
    refresh();
    return "Rate saved. New settlements use it from now.";
  });
}
