-- Story 1.7 (AC9) — Patient.notiz Snapshot-Spalte für freie Pflege-/
-- Übergabe-Notizen. Edits laufen ausschließlich über das
-- `PatientKorrigiert`-Event mit `feld='notiz'` (Append-only-Vertrag); die
-- Spalte hält den jeweils zuletzt korrigierten Wert für den schnellen
-- Detail-Render. Erstmalige Erfassung-Notiz (`patient.erfasst.payload.notiz`,
-- Story 1.2) wird **nicht** automatisch in diese Spalte gespiegelt — sie ist
-- ein Audit-Spurfeld, kein Snapshot-Backfill. Edits ab Story 1.7 ändern die
-- Spalte über den Korrektur-Pfad.
--
-- Additive Spalte (`NULL`-fähig) — keine Datenmigration nötig, kein
-- Migration-Bruch. Length-Limit 500 Zeichen mit der Domain-Validation
-- (`Patient.aktualisiereNotiz`-Aggregate-Methode + Zod-Schema).
ALTER TABLE "patienten"
  ADD COLUMN "notiz" VARCHAR(500);
