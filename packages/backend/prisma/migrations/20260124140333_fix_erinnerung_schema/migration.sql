-- DropIndex
DROP INDEX "erinnerungen_einsatz_id_assigned_to_id_idx";

-- AlterTable
ALTER TABLE "erinnerungen" ADD COLUMN     "assigned_at" TIMESTAMP(3),
ADD COLUMN     "assigned_by" VARCHAR(100);

-- AddForeignKey
ALTER TABLE "erinnerungen" ADD CONSTRAINT "erinnerungen_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
