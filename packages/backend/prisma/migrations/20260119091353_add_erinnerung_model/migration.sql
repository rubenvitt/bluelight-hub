-- CreateEnum
CREATE TYPE "ErinnerungStatus" AS ENUM ('GEPLANT', 'AUSGELOEST', 'ACKNOWLEDGED', 'SNOOZED', 'ESKALIERT', 'ERLEDIGT');

-- CreateTable
CREATE TABLE "erinnerungen" (
    "id" TEXT NOT NULL,
    "einsatz_id" TEXT NOT NULL,
    "titel" VARCHAR(100) NOT NULL,
    "beschreibung" VARCHAR(500),
    "faellig_am" TIMESTAMP(3) NOT NULL,
    "status" "ErinnerungStatus" NOT NULL DEFAULT 'GEPLANT',
    "erstellt_von" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erinnerungen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "erinnerungen_einsatz_id_idx" ON "erinnerungen"("einsatz_id");

-- CreateIndex
CREATE INDEX "erinnerungen_einsatz_id_faellig_am_idx" ON "erinnerungen"("einsatz_id", "faellig_am");

-- CreateIndex
CREATE INDEX "erinnerungen_einsatz_id_status_idx" ON "erinnerungen"("einsatz_id", "status");

-- CreateIndex
CREATE INDEX "erinnerungen_status_idx" ON "erinnerungen"("status");

-- CreateIndex
CREATE INDEX "erinnerungen_erstellt_von_idx" ON "erinnerungen"("erstellt_von");

-- AddForeignKey
ALTER TABLE "erinnerungen" ADD CONSTRAINT "erinnerungen_einsatz_id_fkey" FOREIGN KEY ("einsatz_id") REFERENCES "einsaetze"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erinnerungen" ADD CONSTRAINT "erinnerungen_erstellt_von_fkey" FOREIGN KEY ("erstellt_von") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
