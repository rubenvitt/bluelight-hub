-- Story 7.2: HiOrg-Server Import - Qualifikations-Mapping
--
-- Neue Features:
-- 1. StammPerson: Externe Integration Felder (externalSource, externalId, lastSyncAt)
-- 2. QualifikationMapping: Mapping externer Qualifikations-Namen auf interne Qualifikationen

-- ===========================================
-- 1. StammPerson: Externe Integration Felder
-- ===========================================

-- Neue Felder für externe Synchronisation
ALTER TABLE "stamm_personen" ADD COLUMN "externalSource" VARCHAR(50);
ALTER TABLE "stamm_personen" ADD COLUMN "externalId" VARCHAR(100);
ALTER TABLE "stamm_personen" ADD COLUMN "lastSyncAt" TIMESTAMP(3);

-- Unique Index: Jede externe ID pro Quelle einmalig
-- (NULL-Werte werden von PostgreSQL nicht als Duplikate betrachtet)
CREATE UNIQUE INDEX "stamm_personen_externalSource_externalId_key" ON "stamm_personen"("externalSource", "externalId");

-- ===========================================
-- 2. QualifikationMapping: Externe Mappings
-- ===========================================

-- Neue Tabelle für Qualifikations-Mappings
CREATE TABLE "qualifikation_mappings" (
    "id" TEXT NOT NULL,
    "externalName" VARCHAR(200) NOT NULL,
    "externalSource" VARCHAR(50) NOT NULL,
    "qualifikationId" TEXT,
    "isAutoMatched" BOOLEAN NOT NULL DEFAULT false,
    "confidence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" VARCHAR(100),
    "updatedBy" VARCHAR(100),

    CONSTRAINT "qualifikation_mappings_pkey" PRIMARY KEY ("id")
);

-- Unique Constraint: Jeder externe Name pro Quelle einmalig
CREATE UNIQUE INDEX "qualifikation_mappings_externalName_externalSource_key" ON "qualifikation_mappings"("externalName", "externalSource");

-- Index für schnelle Abfragen nach Quelle
CREATE INDEX "qualifikation_mappings_externalSource_idx" ON "qualifikation_mappings"("externalSource");

-- Index für FK-Lookups
CREATE INDEX "qualifikation_mappings_qualifikationId_idx" ON "qualifikation_mappings"("qualifikationId");

-- Foreign Key zu Qualifikation (mit ON DELETE SET NULL)
ALTER TABLE "qualifikation_mappings" ADD CONSTRAINT "qualifikation_mappings_qualifikationId_fkey" FOREIGN KEY ("qualifikationId") REFERENCES "qualifikationen"("id") ON DELETE SET NULL ON UPDATE CASCADE;
