-- AlterTable
ALTER TABLE "erinnerungen" ADD COLUMN     "assigned_to_id" VARCHAR(100);

-- CreateIndex
CREATE INDEX "erinnerungen_einsatz_id_assigned_to_id_idx" ON "erinnerungen"("einsatz_id", "assigned_to_id");

-- AddForeignKey
ALTER TABLE "erinnerungen" ADD CONSTRAINT "erinnerungen_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
