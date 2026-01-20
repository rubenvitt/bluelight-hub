-- AlterTable
ALTER TABLE "erinnerungen" ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "erinnerungen_is_deleted_idx" ON "erinnerungen"("is_deleted");
