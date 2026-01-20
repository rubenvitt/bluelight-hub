-- AlterTable
ALTER TABLE "erinnerungen" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" VARCHAR(100);

-- CreateIndex
CREATE INDEX "erinnerungen_deleted_at_idx" ON "erinnerungen"("deleted_at");

-- AddForeignKey
ALTER TABLE "erinnerungen" ADD CONSTRAINT "erinnerungen_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
