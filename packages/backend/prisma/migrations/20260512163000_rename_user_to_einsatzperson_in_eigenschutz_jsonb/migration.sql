-- Eigenschutz: Diskriminator-Migration im JSONB
--
-- Hintergrund: Im SicherungspostenDrawer & VorfallMeldenDrawer wird die
-- Personenauswahl auf das EinsatzPerson-Modell umgestellt (analog
-- BesetzeRolleDialog). Dabei wandert die persistierte Diskriminator-Form von
-- {kind:'user', userId} auf {kind:'einsatzPerson', einsatzPersonId}.
--
-- Diese Migration ist defensiv & idempotent: sie bearbeitet ausschließlich
-- Einträge, die noch im alten 'user'-Format vorliegen. Existieren bereits
-- keine alten Einträge mehr (Dev-Setup ohne Daten oder schon migriert), ist
-- die Migration ein No-Op.
--
-- WICHTIG: Die JSONB-Inhalte werden 1:1 umgeschrieben - userId wird auf
-- einsatzPersonId umgemapped OHNE Existenzprüfung gegen EinsatzPerson. Daten
-- aus Pre-Migration-Zustand, deren userId nicht zu einer EinsatzPerson
-- gehört, bleiben als "fremde" einsatzPersonId-Werte im Array stehen.
-- Validierung beim Lesen/Schreiben wird im Mapper/Aggregate enforced.

-- Sicherungsposten.personal: Array<{kind,userId}|{kind,name,rolle}>
UPDATE "Sicherungsposten"
SET "personal" = (
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN entry->>'kind' = 'user' THEN
        jsonb_build_object('kind', 'einsatzPerson', 'einsatzPersonId', entry->'userId')
      ELSE entry
    END
  ), '[]'::jsonb)
  FROM jsonb_array_elements("personal") AS entry
)
WHERE jsonb_typeof("personal") = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements("personal") AS entry
    WHERE entry->>'kind' = 'user'
  );

-- EigenschutzVorfall.beteiligte: Array<{kind,userId,rolle}|{kind,name,rolle}>
UPDATE "EigenschutzVorfall"
SET "beteiligte" = (
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN entry->>'kind' = 'user' THEN
        jsonb_build_object(
          'kind', 'einsatzPerson',
          'einsatzPersonId', entry->'userId'
        ) || (CASE WHEN entry ? 'rolle' THEN jsonb_build_object('rolle', entry->'rolle') ELSE '{}'::jsonb END)
      ELSE entry
    END
  ), '[]'::jsonb)
  FROM jsonb_array_elements("beteiligte") AS entry
)
WHERE jsonb_typeof("beteiligte") = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements("beteiligte") AS entry
    WHERE entry->>'kind' = 'user'
  );
