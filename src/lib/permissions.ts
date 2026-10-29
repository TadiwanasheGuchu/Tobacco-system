import type { Role } from "@/generated/prisma/enums";

export type Permission =
  | "grower.view"
  | "grower.register"
  | "bale.view"
  | "bale.receive"
  | "bale.gradeTimb"
  | "bale.gradeBuyer"
  | "bale.bid"
  | "bale.bidAnyBuyer"
  | "bale.priceOverride"
  | "bale.decision"
  | "settlement.view"
  | "settlement.create"
  | "settlement.pay"
  | "settlement.reverse"
  | "contract.manage"
  | "rates.capture"
  | "reports.view"
  | "timb.dailyReturn"
  | "admin";

const ALL: Permission[] = [
  "grower.view",
  "grower.register",
  "bale.view",
  "bale.receive",
  "bale.gradeTimb",
  "bale.gradeBuyer",
  "bale.bid",
  "bale.bidAnyBuyer",
  "bale.priceOverride",
  "bale.decision",
  "settlement.view",
  "settlement.create",
  "settlement.pay",
  "settlement.reverse",
  "contract.manage",
  "rates.capture",
  "reports.view",
  "timb.dailyReturn",
  "admin",
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: ALL,
  SUPERVISOR: ALL.filter((p) => p !== "admin"),
  RECEPTION: ["grower.view", "grower.register", "bale.view", "bale.receive", "bale.decision"],
  CLASSIFIER: ["bale.view", "bale.gradeTimb"],
  BUYER: ["bale.view", "bale.gradeBuyer", "bale.bid"],
  // Cashiers prepare settlements; a supervisor releases payment (two-person rule).
  CASHIER: ["grower.view", "bale.view", "settlement.view", "settlement.create", "rates.capture", "reports.view"],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
