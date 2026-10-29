"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { ActionState, runAction, str } from "@/lib/action";
import { requireAction } from "@/lib/auth/dal";
import { addContract, GrowerInput, registerGrower, reverifyGrower, setGrowerStatus } from "@/lib/services/growers";

const GROWER_FIELDS = [
  "timbGrowerNumber",
  "firstName",
  "lastName",
  "nationalId",
  "phone",
  "province",
  "district",
  "bankName",
  "bankAccountNumber",
  "mobileMoneyNumber",
] as const;

export async function registerGrowerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  const result = await runAction(async () => {
    const user = await requireAction("grower.register");
    const input = Object.fromEntries(GROWER_FIELDS.map((f) => [f, str(formData, f)]));
    const grower = await registerGrower(user, input as GrowerInput);
    id = grower.id;
  });
  if (id) redirect(`/growers/${id}`);
  return result;
}

export async function reverifyGrowerAction(growerId: string, _: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireAction("grower.register");
    await reverifyGrower(user, growerId);
    refresh();
    return "Verified with TIMB.";
  });
}

export async function setGrowerStatusAction(growerId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireAction("contract.manage");
    const status = str(formData, "status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
    await setGrowerStatus(user, growerId, status, str(formData, "reason"));
    refresh();
    return status === "SUSPENDED" ? "Grower suspended." : "Grower reactivated.";
  });
}

export async function addContractAction(growerId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireAction("contract.manage");
    await addContract(user, growerId, {
      contractNumber: str(formData, "contractNumber"),
      buyerId: str(formData, "buyerId"),
      inputLoanUsd: str(formData, "inputLoanUsd"),
    });
    refresh();
    return "Contract added.";
  });
}
