import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Reuse one client across hot reloads in development.
export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

/** Atomically increments and returns a named counter. */
export async function nextSequence(tx: Tx, name: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Sequence" (name, value) VALUES (${name}, 1)
    ON CONFLICT (name) DO UPDATE SET value = "Sequence".value + 1
    RETURNING value`;
  return rows[0].value;
}

export async function audit(
  tx: Tx,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  data?: Record<string, unknown>,
) {
  await tx.auditLog.create({
    data: { actorId, action, entityType, entityId, data: data as object | undefined },
  });
}
