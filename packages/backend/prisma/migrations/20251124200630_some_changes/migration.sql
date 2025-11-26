-- AlterTable
ALTER TABLE "einsatztagebuecher" ADD COLUMN     "nextSequenceNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "versionTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "etb_snapshots" (
    "id" TEXT NOT NULL,
    "etbId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eintraege" JSONB NOT NULL,

    CONSTRAINT "etb_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "etb_snapshots_etbId_versionNumber_idx" ON "etb_snapshots"("etbId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "etb_snapshots_etbId_versionNumber_key" ON "etb_snapshots"("etbId", "versionNumber");

-- CreateIndex
CREATE INDEX "einsatztagebuecher_version_idx" ON "einsatztagebuecher"("version");

-- AddForeignKey
ALTER TABLE "etb_snapshots" ADD CONSTRAINT "etb_snapshots_etbId_fkey" FOREIGN KEY ("etbId") REFERENCES "einsatztagebuecher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
