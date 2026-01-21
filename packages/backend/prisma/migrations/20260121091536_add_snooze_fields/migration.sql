-- AlterTable
ALTER TABLE "erinnerungen" ADD COLUMN     "snooze_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "snoozed_at" TIMESTAMP(3),
ADD COLUMN     "snoozed_by" VARCHAR(100),
ADD COLUMN     "snoozed_until" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "erinnerungen" ADD CONSTRAINT "erinnerungen_snoozed_by_fkey" FOREIGN KEY ("snoozed_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
