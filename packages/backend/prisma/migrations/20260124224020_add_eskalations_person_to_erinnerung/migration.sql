-- AlterTable
ALTER TABLE "erinnerungen" ADD COLUMN     "eskalations_person_id" VARCHAR(100);

-- AddForeignKey
ALTER TABLE "erinnerungen" ADD CONSTRAINT "erinnerungen_eskalations_person_id_fkey" FOREIGN KEY ("eskalations_person_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
