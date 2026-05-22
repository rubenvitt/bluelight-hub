-- CreateEnum
CREATE TYPE "SkEnum" AS ENUM ('SK_I', 'SK_II', 'SK_III', 'SK_IV', 'TOT');

-- CreateEnum
CREATE TYPE "BehandlungsstatusEnum" AS ENUM ('UNVERSORGT', 'IN_BEHANDLUNG', 'VERSORGT', 'TRANSPORTBEREIT');

-- CreateEnum
CREATE TYPE "TransportstatusEnum" AS ENUM ('WARTEND', 'IM_TRANSPORT', 'IM_KRANKENHAUS');

-- CreateTable
CREATE TABLE "patienten" (
    "id" TEXT NOT NULL,
    "einsatz_id" TEXT NOT NULL,
    "patientennummer" VARCHAR(16) NOT NULL,
    "divi_vak_nummer" VARCHAR(64),
    "aktuelle_sk" "SkEnum" NOT NULL,
    "behandlungsstatus" "BehandlungsstatusEnum" NOT NULL,
    "transportstatus" "TransportstatusEnum" NOT NULL,
    "erfasst_am" TIMESTAMP(3) NOT NULL,
    "erfasser_user_id" TEXT,
    "erfasser_device_id" TEXT,
    "erfasser_session_id" TEXT,
    "clock_drift_seconds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patienten_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_events" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "einsatz_id" TEXT NOT NULL,
    "event_type" VARCHAR(64) NOT NULL,
    "event_version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" TEXT,
    "actor_device_id" TEXT,
    "origin_session_id" TEXT,
    "clock_drift_seconds" INTEGER,
    "outbox_ref" TEXT,

    CONSTRAINT "patient_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patienten_einsatz_id_aktuelle_sk_idx" ON "patienten"("einsatz_id", "aktuelle_sk");

-- CreateIndex
CREATE INDEX "patienten_einsatz_id_behandlungsstatus_idx" ON "patienten"("einsatz_id", "behandlungsstatus");

-- CreateIndex
CREATE INDEX "patienten_einsatz_id_transportstatus_idx" ON "patienten"("einsatz_id", "transportstatus");

-- CreateIndex
CREATE UNIQUE INDEX "patienten_einsatz_id_patientennummer_key" ON "patienten"("einsatz_id", "patientennummer");

-- CreateIndex
CREATE INDEX "patient_events_einsatz_id_occurred_at_idx" ON "patient_events"("einsatz_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "patient_events_patient_id_event_version_key" ON "patient_events"("patient_id", "event_version");

-- AddForeignKey
ALTER TABLE "patienten" ADD CONSTRAINT "patienten_einsatz_id_fkey" FOREIGN KEY ("einsatz_id") REFERENCES "einsaetze"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_events" ADD CONSTRAINT "patient_events_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patienten"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_events" ADD CONSTRAINT "patient_events_einsatz_id_fkey" FOREIGN KEY ("einsatz_id") REFERENCES "einsaetze"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
