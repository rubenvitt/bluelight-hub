-- DRK Compliance: NO-DELETE Policy (Story 1.8)
-- Verhindert physisches Löschen von Datensätzen gemäß 10-Jahres-Aufbewahrungspflicht
-- Diese Trigger schützen kritische Tabellen vor versehentlichem oder absichtlichem Löschen

-- ========================================
-- 1. Einsatz (Missions/Operations)
-- ========================================
-- Einsätze dürfen nicht gelöscht werden, sondern müssen archiviert werden
-- Alternative: status = 'ARCHIVIERT' + archivedAt timestamp

CREATE OR REPLACE FUNCTION prevent_einsatz_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'DRK Compliance Violation: Einsatz cannot be deleted. Use status=ARCHIVIERT instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS einsatz_no_delete ON einsaetze;
CREATE TRIGGER einsatz_no_delete
  BEFORE DELETE ON einsaetze
  FOR EACH ROW
  EXECUTE FUNCTION prevent_einsatz_delete();


-- ========================================
-- 2. ETB Eintrag (Electronic Logbook Entries)
-- ========================================
-- ETB-Einträge dürfen nicht physisch gelöscht werden (Audit-Trail)
-- Alternative: deletedAt + deletedBy (soft-delete pattern)

CREATE OR REPLACE FUNCTION prevent_etb_eintrag_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'DRK Compliance Violation: ETB Einträge cannot be deleted. Use is_deleted=true instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS etb_eintrag_no_delete ON etb_eintraege;
CREATE TRIGGER etb_eintrag_no_delete
  BEFORE DELETE ON etb_eintraege
  FOR EACH ROW
  EXECUTE FUNCTION prevent_etb_eintrag_delete();


-- ========================================
-- 3. Lagekarte POI (Map Points of Interest)
-- ========================================
-- POIs können nur über Aggregate Business Logic entfernt werden
-- Kein soft-delete oder archival - strikt durch Domain Layer kontrolliert

CREATE OR REPLACE FUNCTION prevent_lagekarte_poi_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'DRK Compliance Violation: POIs cannot be permanently deleted. Use removal via Aggregate only.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lagekarte_poi_no_delete ON lagekarte_poi;
CREATE TRIGGER lagekarte_poi_no_delete
  BEFORE DELETE ON lagekarte_poi
  FOR EACH ROW
  EXECUTE FUNCTION prevent_lagekarte_poi_delete();


-- ========================================
-- 4. User (System Users)
-- ========================================
-- Benutzer dürfen nicht gelöscht werden (Audit-Trail + DSGVO)
-- Alternative: isLocked = true + lockedManuallyAt

CREATE OR REPLACE FUNCTION prevent_user_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'DRK Compliance Violation: Users cannot be deleted. Use is_locked=true instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_no_delete ON "User";
CREATE TRIGGER user_no_delete
  BEFORE DELETE ON "User"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_user_delete();
