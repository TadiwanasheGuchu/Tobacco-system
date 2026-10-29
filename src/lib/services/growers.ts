import { z } from "zod";
import { audit, db } from "@/lib/db";
import { dec } from "@/lib/money";
import { getTimbAdapter } from "@/lib/timb";
import { activeSeason, Actor, DomainError } from "./common";

export const growerSchema = z.object({
  timbGrowerNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{5,12}$/, "TIMB grower number must be 5-12 letters or digits."),
  firstName: z.string().trim().min(1, "First name is required."),
  lastName: z.string().trim().min(1, "Last name is required."),
  // Zimbabwe national ID, e.g. 63-123456A-42 (dashes and spaces optional).
  nationalId: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => /^\d{2}\d{6,7}[A-Z]\d{2}$/.test(v), "National ID should look like 63-123456A-42."),
  phone: z.string().trim().optional(),
  province: z.string().trim().optional(),
  district: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
  bankAccountNumber: z.string().trim().optional(),
  mobileMoneyNumber: z.string().trim().optional(),
});

export type GrowerInput = z.input<typeof growerSchema>;

async function verifyWithTimb(timbGrowerNumber: string, nationalId: string) {
  try {
    const result = await getTimbAdapter().verifyGrower(timbGrowerNumber, nationalId);
    if (!result.valid) throw new DomainError(`TIMB rejected this grower: ${result.reason ?? "not registered"}.`);
    return true;
  } catch (err) {
    if (err instanceof DomainError) throw err;
    // TIMB unreachable: register anyway, but the grower cannot sell until verified.
    return false;
  }
}

export async function registerGrower(actor: Actor, input: GrowerInput) {
  const data = growerSchema.parse(input);
  const existing = await db.grower.findFirst({
    where: { OR: [{ timbGrowerNumber: data.timbGrowerNumber }, { nationalId: data.nationalId }] },
  });
  if (existing) throw new DomainError("A grower with this TIMB number or national ID is already registered.");

  const verified = await verifyWithTimb(data.timbGrowerNumber, data.nationalId);
  return db.$transaction(async (tx) => {
    const grower = await tx.grower.create({
      data: { ...emptyToNull(data), timbVerifiedAt: verified ? new Date() : null },
    });
    await audit(tx, actor.id, "grower.register", "Grower", grower.id, { verified });
    return grower;
  });
}

export async function reverifyGrower(actor: Actor, growerId: string) {
  const grower = await db.grower.findUnique({ where: { id: growerId } });
  if (!grower) throw new DomainError("Grower not found.");
  const verified = await verifyWithTimb(grower.timbGrowerNumber, grower.nationalId);
  if (!verified) throw new DomainError("TIMB could not be reached. Try again shortly.");
  await db.$transaction(async (tx) => {
    await tx.grower.update({ where: { id: growerId }, data: { timbVerifiedAt: new Date() } });
    await audit(tx, actor.id, "grower.verify", "Grower", growerId);
  });
}

export async function setGrowerStatus(actor: Actor, growerId: string, status: "ACTIVE" | "SUSPENDED", reason: string) {
  if (!reason.trim()) throw new DomainError("A reason is required.");
  await db.$transaction(async (tx) => {
    await tx.grower.update({ where: { id: growerId }, data: { status } });
    await audit(tx, actor.id, `grower.${status.toLowerCase()}`, "Grower", growerId, { reason });
  });
}

export const contractSchema = z.object({
  contractNumber: z.string().trim().toUpperCase().min(3, "Contract number is required."),
  buyerId: z.string().min(1, "Choose the contractor."),
  inputLoanUsd: z
    .string()
    .trim()
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Enter the input loan in USD, e.g. 850.00."),
});

export async function addContract(actor: Actor, growerId: string, input: z.input<typeof contractSchema>) {
  const data = contractSchema.parse(input);
  return db.$transaction(async (tx) => {
    const season = await activeSeason(tx);
    const clash = await tx.contract.findFirst({
      where: { OR: [{ contractNumber: data.contractNumber }, { growerId, seasonId: season.id }] },
    });
    if (clash) throw new DomainError("This contract number exists, or the grower already has a contract this season.");
    const contract = await tx.contract.create({
      data: {
        contractNumber: data.contractNumber,
        growerId,
        buyerId: data.buyerId,
        seasonId: season.id,
        inputLoanUsd: dec(data.inputLoanUsd).toFixed(2),
      },
    });
    await audit(tx, actor.id, "contract.create", "Contract", contract.id, { inputLoanUsd: data.inputLoanUsd });
    return contract;
  });
}

function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === "" ? null : v])) as T;
}
