-- AlterTable
ALTER TABLE "erinnerungen" ADD COLUMN     "acknowledged_am" TIMESTAMP(3),
ADD COLUMN     "acknowledged_by" VARCHAR(100);

-- AddForeignKey
ALTER TABLE "erinnerungen" ADD CONSTRAINT "erinnerungen_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
