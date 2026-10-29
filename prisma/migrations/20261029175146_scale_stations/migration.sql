-- AlterTable
ALTER TABLE "Bale" ADD COLUMN     "scaleStationId" TEXT;

-- CreateTable
CREATE TABLE "ScaleStation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "ScaleStation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScaleStation_code_key" ON "ScaleStation"("code");

-- AddForeignKey
ALTER TABLE "ScaleStation" ADD CONSTRAINT "ScaleStation_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bale" ADD CONSTRAINT "Bale_scaleStationId_fkey" FOREIGN KEY ("scaleStationId") REFERENCES "ScaleStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
