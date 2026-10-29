-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SUPERVISOR', 'RECEPTION', 'CLASSIFIER', 'BUYER', 'CASHIER');

-- CreateEnum
CREATE TYPE "FloorType" AS ENUM ('AUCTION', 'CONTRACT');

-- CreateEnum
CREATE TYPE "GrowerStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BaleStatus" AS ENUM ('RECEIVED', 'GRADED', 'PRICED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'SETTLED');

-- CreateEnum
CREATE TYPE "WeighSource" AS ENUM ('SCALE', 'MANUAL');

-- CreateEnum
CREATE TYPE "GradingKind" AS ENUM ('TIMB', 'BUYER');

-- CreateEnum
CREATE TYPE "OfferSource" AS ENUM ('AUCTION_BID', 'CONTRACT_PRICE', 'SUPERVISOR_OVERRIDE');

-- CreateEnum
CREATE TYPE "ChargeKind" AS ENUM ('PERCENT_OF_GROSS', 'PER_BALE', 'PER_KG');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('APPROVED', 'PAID', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'MOBILE_MONEY', 'CASH');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "buyerId" TEXT,
    "floorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FloorType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Buyer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timbLicenseNumber" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Buyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grower" (
    "id" TEXT NOT NULL,
    "timbGrowerNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "phone" TEXT,
    "province" TEXT,
    "district" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "mobileMoneyNumber" TEXT,
    "status" "GrowerStatus" NOT NULL DEFAULT 'ACTIVE',
    "timbVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "growerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "inputLoanUsd" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradePrice" (
    "id" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "pricePerKgUsd" DECIMAL(10,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bale" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "growerId" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "contractId" TEXT,
    "massKg" DECIMAL(8,2) NOT NULL,
    "weighSource" "WeighSource" NOT NULL,
    "lane" TEXT,
    "status" "BaleStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentOfferId" TEXT,
    "decisionAt" TIMESTAMP(3),

    CONSTRAINT "Bale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaleGrading" (
    "id" TEXT NOT NULL,
    "baleId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "kind" "GradingKind" NOT NULL,
    "gradedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BaleGrading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaleOffer" (
    "id" TEXT NOT NULL,
    "baleId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "pricePerKgUsd" DECIMAL(10,4) NOT NULL,
    "source" "OfferSource" NOT NULL,
    "createdById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BaleOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ChargeKind" NOT NULL,
    "value" DECIMAL(10,4) NOT NULL,
    "floorType" "FloorType",
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChargeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSplitRule" (
    "id" TEXT NOT NULL,
    "usdPercent" DECIMAL(5,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSplitRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "zigPerUsd" DECIMAL(14,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "capturedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "growerId" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "grossUsd" DECIMAL(14,2) NOT NULL,
    "deductionsUsd" DECIMAL(14,2) NOT NULL,
    "netUsd" DECIMAL(14,2) NOT NULL,
    "usdPercent" DECIMAL(5,2) NOT NULL,
    "payUsd" DECIMAL(14,2) NOT NULL,
    "payZigUsdEquiv" DECIMAL(14,2) NOT NULL,
    "zigPerUsd" DECIMAL(14,4) NOT NULL,
    "payZig" DECIMAL(16,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentReference" TEXT,
    "status" "SettlementStatus" NOT NULL DEFAULT 'APPROVED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidById" TEXT,
    "paidAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementLine" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "baleId" TEXT NOT NULL,
    "gradeCode" TEXT NOT NULL,
    "massKg" DECIMAL(8,2) NOT NULL,
    "pricePerKgUsd" DECIMAL(10,4) NOT NULL,
    "valueUsd" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "SettlementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementDeduction" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountUsd" DECIMAL(14,2) NOT NULL,
    "contractId" TEXT,

    CONSTRAINT "SettlementDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimbOutbox" (
    "id" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "timbReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimbOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Floor_code_key" ON "Floor"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Season_year_key" ON "Season"("year");

-- CreateIndex
CREATE UNIQUE INDEX "Buyer_code_key" ON "Buyer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Buyer_timbLicenseNumber_key" ON "Buyer"("timbLicenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Grower_timbGrowerNumber_key" ON "Grower"("timbGrowerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Grower_nationalId_key" ON "Grower"("nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");

-- CreateIndex
CREATE INDEX "Contract_growerId_idx" ON "Contract"("growerId");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_code_key" ON "Grade"("code");

-- CreateIndex
CREATE INDEX "GradePrice_buyerId_seasonId_gradeId_effectiveFrom_idx" ON "GradePrice"("buyerId", "seasonId", "gradeId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Bale_ticketNumber_key" ON "Bale"("ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Bale_currentOfferId_key" ON "Bale"("currentOfferId");

-- CreateIndex
CREATE INDEX "Bale_growerId_status_idx" ON "Bale"("growerId", "status");

-- CreateIndex
CREATE INDEX "Bale_floorId_receivedAt_idx" ON "Bale"("floorId", "receivedAt");

-- CreateIndex
CREATE INDEX "BaleGrading_baleId_kind_createdAt_idx" ON "BaleGrading"("baleId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "BaleOffer_baleId_createdAt_idx" ON "BaleOffer"("baleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_number_key" ON "Settlement"("number");

-- CreateIndex
CREATE INDEX "Settlement_growerId_idx" ON "Settlement"("growerId");

-- CreateIndex
CREATE INDEX "SettlementLine_baleId_idx" ON "SettlementLine"("baleId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "TimbOutbox_status_nextAttemptAt_idx" ON "TimbOutbox"("status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_growerId_fkey" FOREIGN KEY ("growerId") REFERENCES "Grower"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradePrice" ADD CONSTRAINT "GradePrice_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradePrice" ADD CONSTRAINT "GradePrice_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradePrice" ADD CONSTRAINT "GradePrice_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bale" ADD CONSTRAINT "Bale_growerId_fkey" FOREIGN KEY ("growerId") REFERENCES "Grower"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bale" ADD CONSTRAINT "Bale_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bale" ADD CONSTRAINT "Bale_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bale" ADD CONSTRAINT "Bale_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bale" ADD CONSTRAINT "Bale_currentOfferId_fkey" FOREIGN KEY ("currentOfferId") REFERENCES "BaleOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaleGrading" ADD CONSTRAINT "BaleGrading_baleId_fkey" FOREIGN KEY ("baleId") REFERENCES "Bale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaleGrading" ADD CONSTRAINT "BaleGrading_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaleOffer" ADD CONSTRAINT "BaleOffer_baleId_fkey" FOREIGN KEY ("baleId") REFERENCES "Bale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaleOffer" ADD CONSTRAINT "BaleOffer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_growerId_fkey" FOREIGN KEY ("growerId") REFERENCES "Grower"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementLine" ADD CONSTRAINT "SettlementLine_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementLine" ADD CONSTRAINT "SettlementLine_baleId_fkey" FOREIGN KEY ("baleId") REFERENCES "Bale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementDeduction" ADD CONSTRAINT "SettlementDeduction_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementDeduction" ADD CONSTRAINT "SettlementDeduction_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
