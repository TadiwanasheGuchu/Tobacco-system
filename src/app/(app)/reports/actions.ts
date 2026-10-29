"use server";

import { refresh } from "next/cache";
import { ActionState, runAction, str } from "@/lib/action";
import { requireAction } from "@/lib/auth/dal";
import { queueTimbDailySummary } from "@/lib/services/reports";

export async function queueDailySummaryAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireAction("timb.dailyReturn");
    const queued = await queueTimbDailySummary(user, str(formData, "date"));
    refresh();
    return queued === 0
      ? "Nothing new to send: no sales that day, or the summary is already queued."
      : `Queued ${queued} floor summar${queued === 1 ? "y" : "ies"} for TIMB.`;
  });
}
