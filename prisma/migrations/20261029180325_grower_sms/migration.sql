-- AlterTable
ALTER TABLE "Grower" ADD COLUMN     "smsOptIn" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "SmsOutbox" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "growerId" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsOutbox_status_nextAttemptAt_idx" ON "SmsOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "SmsOutbox_growerId_idx" ON "SmsOutbox"("growerId");
