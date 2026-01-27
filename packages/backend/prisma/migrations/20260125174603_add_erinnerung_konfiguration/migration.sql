/*
  Warnings:

  - You are about to drop the column `eskalations_timeout_seconds` on the `erinnerung_konfiguration` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `erinnerung_konfiguration` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `erinnerung_konfiguration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedBy` to the `erinnerung_konfiguration` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "erinnerung_konfiguration" DROP COLUMN "eskalations_timeout_seconds",
DROP COLUMN "updated_at",
ADD COLUMN     "eskalationsTimeoutSeconds" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedBy" VARCHAR(100) NOT NULL;

-- AddForeignKey
ALTER TABLE "erinnerung_konfiguration" ADD CONSTRAINT "erinnerung_konfiguration_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
