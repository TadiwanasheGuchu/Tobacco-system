"use server";

import { refresh } from "next/cache";
import { ActionState, runAction, str } from "@/lib/action";
import { requireAction } from "@/lib/auth/dal";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { audit, db } from "@/lib/db";
import { Role, ChargeKind, FloorType } from "@/generated/prisma/enums";
import { DomainError } from "@/lib/services/common";
import { processOutbox } from "@/lib/timb/outbox";

const decimal = (v: string, label: string, dp = 4) => {
  const re = new RegExp(`^\\d+(\\.\\d{1,${dp}})?$`);
  if (!re.test(v.trim())) throw new DomainError(`${label} must be a number with up to ${dp} decimals.`);
  return v.trim();
};
const oneOf = <T extends string>(values: Record<string, T>, v: string, label: string): T => {
  const found = Object.values(values).find((x) => x === v);
  if (!found) throw new DomainError(`Choose a ${label}.`);
  return found;
};

export async function createUserAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireAction("admin");
    const username = str(formData, "username").trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new DomainError("Username: 3-32 lowercase letters, digits, dot, dash.");
    const password = str(formData, "password");
    const problem = passwordProblem(password);
    if (problem) throw new DomainError(problem);
    const role = oneOf(Role, str(formData, "role"), "role");
    const buyerId = str(formData, "buyerId") || null;
    if (role === "BUYER" && !buyerId) throw new DomainError("Buyer accounts must belong to a buyer company.");
    if (await db.user.findUnique({ where: { username } })) throw new DomainError("That username is taken.");
    await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          username,
          fullName: str(formData, "fullName").trim() || username,
          role,
          buyerId: role === "BUYER" ? buyerId : null,
          floorId: str(formData, "floorId") || null,
          passwordHash: await hashPassword(password),
        },
      });
      await audit(tx, admin.id, "user.create", "User", u.id, { username, role });
    });
    refresh();
    return `User ${username} created.`;
  });
}

export async function setUserActiveAction(userId: string, active: boolean, _: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireAction("admin");
    if (userId === admin.id) throw new DomainError("You cannot disable your own account.");
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { active } });
      if (!active) await tx.session.deleteMany({ where: { userId } });
      await audit(tx, admin.id, active ? "user.enable" : "user.disable", "User", userId);
    });
    refresh();
    return active ? "Enabled." : "Disabled and signed out.";
  });
}

export async function resetPasswordAction(userId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireAction("admin");
    const password = str(formData, "password");
    const problem = passwordProblem(password);
    if (problem) throw new DomainError(problem);
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
      await tx.session.deleteMany({ where: { userId } });
      await audit(tx, admin.id, "user.resetPassword", "User", userId);
    });
    return "Password reset. The user must sign in again.";
  });
}

export async function createFloorAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireAction("admin");
    const code = str(formData, "code").trim().toUpperCase();
    if (!/^[A-Z0-9]{2,6}$/.test(code)) throw new DomainError("Floor code: 2-6 letters or digits (it prefixes bale tickets).");
    const type = oneOf(FloorType, str(formData, "type"), "floor type");
    await db.$transaction(async (tx) => {
      const f = await tx.floor.create({ data: { code, name: str(formData, "name").trim() || code, type } });
      await audit(tx, admin.id, "floor.create", "Floor", f.id, { code, type });
    });
    refresh();
    return "Floor added.";
  });
}

export async function openSeasonAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireAction("admin");
    const year = Number(str(formData, "year"));
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new DomainError("Enter a season year, e.g. 2027.");
    await db.$transaction(async (tx) => {
      await tx.season.updateMany({ data: { active: false } });
      const s = await tx.season.upsert({ where: { year }, update: { active: true }, create: { year, active: true } });
      await audit(tx, admin.id, "season.open", "Season", s.id, { year });
    });
    refresh();
    return `Season ${year} is now open.`;
  });
}

export async function createBuyerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireAction("admin");
    const code = str(formData, "code").trim().toUpperCase();
    const timbLicenseNumber = str(formData, "timbLicenseNumber").trim().toUpperCase();
    if (!code || !timbLicenseNumber) throw new DomainError("Code and TIMB licence number are required.");
    await db.$transaction(async (tx) => {
      const b = await tx.buyer.create({ data: { code, name: str(formData, "name").trim() || code, timbLicenseNumber } });
      await audit(tx, admin.id, "buyer.create", "Buyer", b.id, { code, timbLicenseNumber });
    });
    refresh();
    return "Buyer added.";
  });
}

export async function createGradeAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireAction("admin");
    const code = str(formData, "code").trim().toUpperCase();
    if (!/^[A-Z0-9]{1,6}$/.test(code)) throw new DomainError("Grade code: up to 6 letters or digits.");
    await db.$transaction(async (tx) => {
      const g = await tx.grade.create({ data: { code, description: str(formData, "description").trim() || code } });
      await audit(tx, admin.id, "grade.create", "Grade", g.id, { code });
    });
    refresh();
    return "Grade added.";
  });
}

export async function setGradePriceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireAction("admin");
    const season = await db.season.findFirst({ where: { active: true } });
    if (!season) throw new DomainError("Open a season first.");
    const price = decimal(str(formData, "pricePerKgUsd"), "Price");
    await db.$transaction(async (tx) => {
      const p = await tx.gradePrice.create({
        data: {
          gradeId: str(formData, "gradeId"),
          buyerId: str(formData, "buyerId"),
          seasonId: season.id,
          pricePerKgUsd: price,
          effectiveFrom: new Date(),
        },
      });
      await audit(tx, admin.id, "gradePrice.set", "GradePrice", p.id, { price });
    });
    refresh();
    return "Price saved. It applies to bales priced from now on.";
  });
}

export async function createChargeAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireAction("admin");
    const code = str(formData, "code").trim().toUpperCase();
    if (!/^[A-Z_]{2,24}$/.test(code) || code === "LOAN_RECOVERY") throw new DomainError("Choose a charge code like LEVY.");
    const kind = oneOf(ChargeKind, str(formData, "kind"), "charge type");
    const value = decimal(str(formData, "value"), "Value");
    const floorTypeRaw = str(formData, "floorType");
    const floorType = floorTypeRaw ? oneOf(FloorType, floorTypeRaw, "floor type") : null;
    await db.$transaction(async (tx) => {
      // A new rule for the same code and floor type replaces the current one from now.
      await tx.chargeRule.updateMany({
        where: { code, floorType, effectiveTo: null },
        data: { effectiveTo: new Date() },
      });
      const c = await tx.chargeRule.create({
        data: { code, name: str(formData, "name").trim() || code, kind, value, floorType, effectiveFrom: new Date() },
      });
      await audit(tx, admin.id, "charge.set", "ChargeRule", c.id, { code, kind, value, floorType });
    });
    refresh();
    return "Charge saved.";
  });
}

export async function endChargeAction(chargeId: string, _: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireAction("admin");
    await db.$transaction(async (tx) => {
      await tx.chargeRule.update({ where: { id: chargeId }, data: { effectiveTo: new Date() } });
      await audit(tx, admin.id, "charge.end", "ChargeRule", chargeId);
    });
    refresh();
    return "Charge ended.";
  });
}

export async function setSplitAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireAction("admin");
    const usdPercent = decimal(str(formData, "usdPercent"), "USD share", 2);
    if (Number(usdPercent) > 100) throw new DomainError("USD share cannot exceed 100%.");
    await db.$transaction(async (tx) => {
      const r = await tx.paymentSplitRule.create({ data: { usdPercent, effectiveFrom: new Date() } });
      await audit(tx, admin.id, "split.set", "PaymentSplitRule", r.id, { usdPercent });
    });
    refresh();
    return "Payment split saved.";
  });
}

export async function processOutboxAction(_: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await requireAction("admin");
    const { sent, failed } = await processOutbox();
    refresh();
    return `Sent ${sent}, failed ${failed}.`;
  });
}

export async function retryOutboxAction(id: string, _: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireAction("admin");
    await db.$transaction(async (tx) => {
      await tx.timbOutbox.update({ where: { id }, data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date() } });
      await audit(tx, admin.id, "timb.retry", "TimbOutbox", id);
    });
    refresh();
    return "Queued for retry.";
  });
}
