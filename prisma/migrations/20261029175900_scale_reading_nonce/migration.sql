-- AlterTable
ALTER TABLE "Bale" ADD COLUMN     "scaleReadingId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Bale_scaleReadingId_key" ON "Bale"("scaleReadingId");
