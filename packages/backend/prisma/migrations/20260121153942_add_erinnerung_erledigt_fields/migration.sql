-- AlterTable
ALTER TABLE "erinnerungen" ADD COLUMN     "erledigt_am" TIMESTAMP(3),
ADD COLUMN     "erledigt_by" VARCHAR(100),
ADD COLUMN     "erledigungs_notiz" VARCHAR(500);

-- AddForeignKey
ALTER TABLE "erinnerungen" ADD CONSTRAINT "erinnerungen_erledigt_by_fkey" FOREIGN KEY ("erledigt_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
