-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'ZIG');

-- CreateEnum
CREATE TYPE "PaymentBatchStatus" AS ENUM ('OPEN', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PaymentBatch" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "currency" "Currency" NOT NULL,
    "status" "PaymentBatchStatus" NOT NULL DEFAULT 'OPEN',
    "totalAmount" DECIMAL(16,2) NOT NULL,
    "lineCount" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "bankReference" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,

    CONSTRAINT "PaymentBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentBatchLine" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "payeeName" TEXT NOT NULL,
    "payeeAccount" TEXT NOT NULL,
    "payeeBank" TEXT,
    "reference" TEXT NOT NULL,

    CONSTRAINT "PaymentBatchLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentBatch_number_key" ON "PaymentBatch"("number");

-- CreateIndex
CREATE INDEX "PaymentBatchLine_settlementId_idx" ON "PaymentBatchLine"("settlementId");

-- CreateIndex
CREATE INDEX "PaymentBatchLine_batchId_idx" ON "PaymentBatchLine"("batchId");

-- AddForeignKey
ALTER TABLE "PaymentBatchLine" ADD CONSTRAINT "PaymentBatchLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PaymentBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentBatchLine" ADD CONSTRAINT "PaymentBatchLine_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
