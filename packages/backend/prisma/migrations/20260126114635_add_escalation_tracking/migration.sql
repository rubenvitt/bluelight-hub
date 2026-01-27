-- AlterTable
ALTER TABLE "erinnerungen" ADD COLUMN     "escalated_at" TIMESTAMP(3),
ADD COLUMN     "previous_assignee_id" VARCHAR(100);

-- AddForeignKey
ALTER TABLE "erinnerungen" ADD CONSTRAINT "erinnerungen_previous_assignee_id_fkey" FOREIGN KEY ("previous_assignee_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
