# Models

## User

**Beschreibung:** Zentrale Benutzerverwaltung mit Rollenkonzept, Soft-Delete und manuellem Lock-Mechanismus.

**Tabelle:** `User`

**Felder:**

| Field            | Type       | Required | Default | Description                                    |
|------------------|------------|----------|---------|------------------------------------------------|
| id               | String     | Ja       | cuid()  | Primary Key                                    |
| username         | String     | Ja       | -       | Unique Username (max. 100 Zeichen)             |
| passwordHash     | String     | Nein     | null    | Nur für Admin-User (TEXT)                      |
| role             | UserRole   | Ja       | USER    | Benutzerrolle (Enum)                           |
| isActive         | Boolean    | Ja       | true    | Account aktiv/inaktiv                          |
| lastLoginAt      | DateTime   | Nein     | null    | Letzter Login-Zeitpunkt                        |
| failedLoginCount | Int        | Ja       | 0       | Anzahl fehlgeschlagener Login-Versuche         |
| lockedUntil      | DateTime   | Nein     | null    | Auto-Lock nach fehlgeschlagenen Logins         |
| createdAt        | DateTime   | Ja       | now()   | Erstellungszeitpunkt                           |
| updatedAt        | DateTime   | Ja       | (auto)  | Aktualisierungszeitpunkt                       |
| isDeleted        | Boolean    | Ja       | false   | Soft-Delete Flag                               |
| deletedAt        | DateTime   | Nein     | null    | Soft-Delete Zeitstempel                        |
| deletedBy        | String     | Nein     | null    | User ID der Löschung                           |
| isLocked         | Boolean    | Ja       | false   | Manueller Lock (Admin-initiiert)               |
| lockedManuallyAt | DateTime   | Nein     | null    | Zeitpunkt des manuellen Locks                  |
| lockedManuallyBy | String     | Nein     | null    | User ID des Lock-Initiators                    |
| lockReason       | String     | Nein     | null    | Grund des manuellen Locks (TEXT)               |

**Beziehungen:**

- **createdEinsaetze**: 1:N zu `Einsatz` (als Creator) - Restrict onDelete
- **updatedEinsaetze**: 1:N zu `Einsatz` (als Updater) - SetNull onDelete
- **archivedEinsaetze**: 1:N zu `Einsatz` (als Archiver) - SetNull onDelete
- **createdEtbs**: 1:N zu `Einsatztagebuch` (als Creator) - Restrict onDelete
- **updatedEtbs**: 1:N zu `Einsatztagebuch` (als Updater) - SetNull onDelete
- **lockedEtbs**: 1:N zu `Einsatztagebuch` (als Locker) - SetNull onDelete
- **createdEtbEintraege**: 1:N zu `EtbEintrag` (als Creator) - Restrict onDelete
- **updatedEtbEintraege**: 1:N zu `EtbEintrag` (als Updater) - SetNull onDelete
- **deletedEtbEintraege**: 1:N zu `EtbEintrag` (als Deleter) - SetNull onDelete
- **modifiedEtbHistorie**: 1:N zu `EtbEintragHistorie` (als Modifier) - Restrict onDelete
- **createdEtbTextbausteine**: 1:N zu `EtbTextbaustein` (als Creator) - Restrict onDelete
- **updatedEtbTextbausteine**: 1:N zu `EtbTextbaustein` (als Updater) - SetNull onDelete
- **archivedEtbs**: 1:N zu `EtbArchiv` (als Archiver) - Restrict onDelete

**Indexes:**

- `idx_user_username`: Auf `username`
- `idx_user_role_active`: Compound auf `role, isActive`
- `idx_user_last_login`: Auf `lastLoginAt`
- `idx_user_is_deleted`: Auf `isDeleted`
- `idx_user_username_deleted`: Compound auf `username, isDeleted`
- `idx_user_is_locked`: Auf `isLocked`
- `idx_user_status`: Compound auf `isActive, isDeleted, isLocked`

**Constraints:**

- `username` muss unique sein
- Soft-Delete Logik: `isDeleted` statt physischer Löschung
- Manual-Lock getrennt von Auto-Lock (`isLocked` vs. `lockedUntil`)

---

## Einsatz

**Beschreibung:** Einsatz-Entität mit Status-Tracking und No-Delete-Policy (nur Archivierung). Zentrale Entität für alle Einsatz-bezogenen Daten.

**Tabelle:** `einsaetze`

**Felder:**

| Field            | Type          | Required | Default     | Description                           |
|------------------|---------------|----------|-------------|---------------------------------------|
| id               | String        | Ja       | cuid()      | Primary Key                           |
| alarmstichwort   | String        | Nein     | null        | Alarmstichwort (max. 255 Zeichen)     |
| einsatzort       | String        | Nein     | null        | Einsatzadresse (max. 500 Zeichen)     |
| beschreibung     | String        | Nein     | null        | Freitext-Beschreibung (TEXT)          |
| alarmierungszeit | DateTime      | Nein     | null        | Zeitpunkt der Alarmierung             |
| einsatzleiter    | String        | Nein     | null        | Name des Einsatzleiters (max. 255)    |
| status           | EinsatzStatus | Ja       | ANGELEGT    | Status des Einsatzes (Enum)           |
| metadata         | Json          | Nein     | null        | Zusätzliche strukturierte Daten       |
| createdAt        | DateTime      | Ja       | now()       | Erstellungszeitpunkt                  |
| updatedAt        | DateTime      | Ja       | (auto)      | Aktualisierungszeitpunkt              |
| createdBy        | String        | Ja       | -           | User ID des Erstellers                |
| updatedBy        | String        | Nein     | null        | User ID des letzten Bearbeiters       |
| archivedAt       | DateTime      | Nein     | null        | Zeitpunkt der Archivierung            |
| archivedBy       | String        | Nein     | null        | User ID des Archivierers              |

**Beziehungen:**

- **creator**: N:1 zu `User` (Foreign Key: `createdBy`) - Restrict onDelete
- **updater**: N:1 zu `User` (Foreign Key: `updatedBy`) - SetNull onDelete
- **archiver**: N:1 zu `User` (Foreign Key: `archivedBy`) - SetNull onDelete
- **einsatztagebuch**: 1:1 zu `Einsatztagebuch` (Optional)
- **lagekarte**: 1:1 zu `Lagekarte` (Optional)

**Indexes:**

- Compound auf `status, createdAt`
- Auf `createdBy`

**Constraints:**

- **No-Delete Policy**: Physisches Löschen nicht erlaubt, nur Archivierung via `archivedAt`
- Creator darf nicht gelöscht werden (Restrict)
- Bei User-Löschung: Updater/Archiver werden auf NULL gesetzt

---

## Einsatztagebuch

**Beschreibung:** 1:1 Beziehung zu `Einsatz`. Verwaltet den Status des ETB (Draft/Active/Locked) und sammelt alle Einträge.

**Tabelle:** `einsatztagebuecher`

**Felder:**

| Field     | Type      | Required | Default | Description                           |
|-----------|-----------|----------|---------|---------------------------------------|
| id        | String    | Ja       | cuid()  | Primary Key                           |
| einsatzId | String    | Ja       | -       | Foreign Key zu Einsatz (Unique)       |
| status    | EtbStatus | Ja       | DRAFT   | Status des ETB (Enum)                 |
| lockedAt  | DateTime  | Nein     | null    | Zeitpunkt der Sperrung                |
| lockedBy  | String    | Nein     | null    | User ID der Sperrung                  |
| createdAt | DateTime  | Ja       | now()   | Erstellungszeitpunkt                  |
| updatedAt | DateTime  | Ja       | (auto)  | Aktualisierungszeitpunkt              |
| createdBy | String    | Ja       | -       | User ID des Erstellers                |
| updatedBy | String    | Nein     | null    | User ID des letzten Bearbeiters       |

**Beziehungen:**

- **einsatz**: N:1 zu `Einsatz` (Foreign Key: `einsatzId`) - Restrict onDelete
- **creator**: N:1 zu `User` (Foreign Key: `createdBy`) - Restrict onDelete
- **updater**: N:1 zu `User` (Foreign Key: `updatedBy`) - SetNull onDelete
- **locker**: N:1 zu `User` (Foreign Key: `lockedBy`) - SetNull onDelete
- **eintraege**: 1:N zu `EtbEintrag`

**Indexes:**

- Compound auf `status, createdAt`
- Auf `createdBy`
- Auf `lockedAt`

**Constraints:**

- `einsatzId` muss unique sein (1:1 Beziehung)
- Status-Übergang: DRAFT → ACTIVE → LOCKED (unveränderlich)

---

## EtbEintrag

**Beschreibung:** Einzelner Eintrag im Einsatztagebuch mit Versionierung und Soft-Delete. Kategorisiert nach DRK-Standard.

**Tabelle:** `etb_eintraege`

**Felder:**

| Field          | Type         | Required | Default | Description                              |
|----------------|--------------|----------|---------|------------------------------------------|
| id             | String       | Ja       | cuid()  | Primary Key                              |
| etbId          | String       | Ja       | -       | Foreign Key zu Einsatztagebuch           |
| timestamp      | DateTime     | Ja       | now()   | Zeitstempel des Eintrags                 |
| sequenceNumber | Int          | Ja       | -       | Laufende Nummer innerhalb des ETB        |
| kategorie      | EtbKategorie | Ja       | -       | Kategorie des Eintrags (Enum)            |
| text           | String       | Ja       | -       | Eintragstext (TEXT)                      |
| version        | Int          | Ja       | 1       | Versionsnummer für Historie              |
| funkrufname    | String       | Nein     | null    | Optionaler Funkrufname (max. 100)        |
| standort       | String       | Nein     | null    | Optionaler Standort (max. 255)           |
| isAutomatic    | Boolean      | Ja       | false   | Automatisch generierter Eintrag          |
| metadata       | Json         | Nein     | null    | Zusätzliche strukturierte Daten (JSON)   |
| createdAt      | DateTime     | Ja       | now()   | Erstellungszeitpunkt                     |
| updatedAt      | DateTime     | Ja       | (auto)  | Aktualisierungszeitpunkt                 |
| createdBy      | String       | Ja       | -       | User ID des Erstellers                   |
| updatedBy      | String       | Nein     | null    | User ID des letzten Bearbeiters          |
| deletedAt      | DateTime     | Nein     | null    | Soft-Delete Zeitstempel                  |
| deletedBy      | String       | Nein     | null    | User ID der Löschung                     |

**Beziehungen:**

- **einsatztagebuch**: N:1 zu `Einsatztagebuch` (Foreign Key: `etbId`) - Cascade onDelete
- **creator**: N:1 zu `User` (Foreign Key: `createdBy`) - Restrict onDelete
- **updater**: N:1 zu `User` (Foreign Key: `updatedBy`) - SetNull onDelete
- **deleter**: N:1 zu `User` (Foreign Key: `deletedBy`) - SetNull onDelete
- **historie**: 1:N zu `EtbEintragHistorie` (Versionierungshistorie)

**Indexes:**

- Unique Constraint auf `etbId, sequenceNumber` (eindeutige laufende Nummer pro ETB)
- Compound auf `etbId, timestamp`
- Compound auf `etbId, kategorie`
- Auf `createdBy`
- Auf `deletedAt`

**Constraints:**

- `sequenceNumber` muss unique sein innerhalb eines ETB
- Soft-Delete Logik: `deletedAt` statt physischer Löschung
- Bei ETB-Löschung: Cascade Delete (alle Einträge werden mit gelöscht)

---

## EtbEintragHistorie

**Beschreibung:** Versionierungshistorie für ETB-Einträge. Speichert Snapshots bei jeder Änderung.

**Tabelle:** `etb_eintrag_historie`

**Felder:**

| Field          | Type         | Required | Default | Description                           |
|----------------|--------------|----------|---------|---------------------------------------|
| id             | String       | Ja       | cuid()  | Primary Key                           |
| eintragId      | String       | Ja       | -       | Foreign Key zu EtbEintrag             |
| version        | Int          | Ja       | -       | Versionsnummer                        |
| timestamp      | DateTime     | Ja       | -       | Original Zeitstempel                  |
| sequenceNumber | Int          | Ja       | -       | Original laufende Nummer              |
| kategorie      | EtbKategorie | Ja       | -       | Original Kategorie                    |
| text           | String       | Ja       | -       | Original Text (TEXT)                  |
| funkrufname    | String       | Nein     | null    | Original Funkrufname                  |
| standort       | String       | Nein     | null    | Original Standort                     |
| metadata       | Json         | Nein     | null    | Original Metadaten (JSON)             |
| changeReason   | String       | Nein     | null    | Grund der Änderung (TEXT)             |
| changedAt      | DateTime     | Ja       | now()   | Zeitpunkt der Änderung                |
| changedBy      | String       | Ja       | -       | User ID der Änderung                  |

**Beziehungen:**

- **eintrag**: N:1 zu `EtbEintrag` (Foreign Key: `eintragId`) - Cascade onDelete
- **modifier**: N:1 zu `User` (Foreign Key: `changedBy`) - Restrict onDelete

**Indexes:**

- Unique Constraint auf `eintragId, version` (eindeutige Version pro Eintrag)
- Compound auf `eintragId, changedAt`
- Auf `changedBy`

**Constraints:**

- `version` muss unique sein pro `eintragId`
- Bei Eintrag-Löschung: Cascade Delete (Historie wird mit gelöscht)

---

## EtbTextbaustein

**Beschreibung:** Wiederverwendbare Textbausteine für schnelle Eintragserfassung (Quick-Entry Templates).

**Tabelle:** `etb_textbausteine`

**Felder:**

| Field        | Type         | Required | Default | Description                           |
|--------------|--------------|----------|---------|---------------------------------------|
| id           | String       | Ja       | cuid()  | Primary Key                           |
| kategorie    | EtbKategorie | Ja       | -       | Kategorie für den Textbaustein        |
| kurztext     | String       | Ja       | -       | Kurzbeschreibung (max. 100 Zeichen)   |
| volltext     | String       | Ja       | -       | Vollständiger Text (TEXT)             |
| isActive     | Boolean      | Ja       | true    | Aktiv/Inaktiv                         |
| sortOrder    | Int          | Ja       | 0       | Sortierreihenfolge                    |
| verwendungen | Int          | Ja       | 0       | Anzahl der Verwendungen               |
| letztGenutzt | DateTime     | Nein     | null    | Letzte Verwendung                     |
| createdAt    | DateTime     | Ja       | now()   | Erstellungszeitpunkt                  |
| updatedAt    | DateTime     | Ja       | (auto)  | Aktualisierungszeitpunkt              |
| createdBy    | String       | Ja       | -       | User ID des Erstellers                |
| updatedBy    | String       | Nein     | null    | User ID des letzten Bearbeiters       |

**Beziehungen:**

- **creator**: N:1 zu `User` (Foreign Key: `createdBy`) - Restrict onDelete
- **updater**: N:1 zu `User` (Foreign Key: `updatedBy`) - SetNull onDelete

**Indexes:**

- Unique Constraint auf `kategorie, kurztext`
- Compound auf `kategorie, isActive, sortOrder`
- Auf `createdBy`

**Constraints:**

- Kombination aus `kategorie` und `kurztext` muss unique sein

---

## EtbArchiv

**Beschreibung:** Langzeitarchivierung von ETBs (10 Jahre Aufbewahrungspflicht). Speichert vollständige Snapshots als JSON.

**Tabelle:** `etb_archiv`

**Felder:**

| Field            | Type     | Required | Default      | Description                              |
|------------------|----------|----------|--------------|------------------------------------------|
| id               | String   | Ja       | cuid()       | Primary Key                              |
| einsatzId        | String   | Ja       | -            | Original Einsatz ID                      |
| etbId            | String   | Ja       | -            | Original ETB ID                          |
| archiveDatum     | DateTime | Ja       | now()        | Datum der Archivierung                   |
| aufbewahrungBis  | DateTime | Ja       | -            | Datum bis zur Aufbewahrung (10 Jahre)    |
| etbData          | Json     | Ja       | -            | Komplettes ETB als JSON (JSONB)          |
| eintraegeData    | Json     | Ja       | -            | Alle Einträge als JSON (JSONB)           |
| historieData     | Json     | Ja       | -            | Komplette Historie als JSON (JSONB)      |
| dataChecksum     | String   | Ja       | -            | SHA-256 Hash für Integrität (64 Zeichen) |
| storagePath      | String   | Nein     | null         | Pfad zu externem Archiv (max. 500)       |
| storageType      | String   | Ja       | "database"   | Speicherort-Typ (max. 50)                |
| alarmstichwort   | String   | Nein     | null         | Kopie für schnelle Suche (max. 255)      |
| einsatzort       | String   | Nein     | null         | Kopie für schnelle Suche (max. 500)      |
| alarmierungszeit | DateTime | Nein     | null         | Kopie für schnelle Suche                 |
| einsatzleiter    | String   | Nein     | null         | Kopie für schnelle Suche (max. 255)      |
| anzahlEintraege  | Int      | Ja       | -            | Anzahl der Einträge                      |
| archivedBy       | String   | Ja       | -            | User ID des Archivierers                 |
| archiveReason    | String   | Nein     | null         | Grund der Archivierung (TEXT)            |

**Beziehungen:**

- **archiver**: N:1 zu `User` (Foreign Key: `archivedBy`) - Restrict onDelete

**Indexes:**

- Auf `einsatzId`
- Auf `etbId`
- Auf `archiveDatum`
- Auf `aufbewahrungBis`
- Auf `archivedBy`

**Constraints:**

- `storageType` kann sein: "database", "filesystem", "s3"
- Checksum sichert Datenintegrität (SHA-256)

---

## Lagekarte

**Beschreibung:** 1:1 Beziehung zu `Einsatz`. Verwaltet geografische Visualisierung mit GeoJSON-State.

**Tabelle:** `lagekarte`

**Felder:**

| Field     | Type     | Required | Default | Description                           |
|-----------|----------|----------|---------|---------------------------------------|
| id        | String   | Ja       | cuid()  | Primary Key                           |
| einsatzId | String   | Ja       | -       | Foreign Key zu Einsatz (Unique)       |
| state     | Json     | Ja       | {}      | GeoJSON für Zeichnungen (JSONB)       |
| createdAt | DateTime | Ja       | now()   | Erstellungszeitpunkt                  |
| updatedAt | DateTime | Ja       | (auto)  | Aktualisierungszeitpunkt              |

**Beziehungen:**

- **einsatz**: N:1 zu `Einsatz` (Foreign Key: `einsatzId`) - Cascade onDelete
- **pois**: 1:N zu `LagekartePoi`

**Indexes:**

- Auf `einsatzId`

**Constraints:**

- `einsatzId` muss unique sein (1:1 Beziehung)
- Bei Einsatz-Löschung: Cascade Delete (Lagekarte wird mit gelöscht)

---

## LagekartePoi

**Beschreibung:** Point of Interest (POI) auf der Lagekarte. Unterstützt MGRS-Koordinaten als primäres Format mit Lat/Lng-Fallback.

**Tabelle:** `lagekarte_poi`

**Felder:**

| Field       | Type     | Required | Default | Description                                   |
|-------------|----------|----------|---------|-----------------------------------------------|
| id          | String   | Ja       | cuid()  | Primary Key                                   |
| lagekarteId | String   | Ja       | -       | Foreign Key zu Lagekarte                      |
| type        | PoiType  | Ja       | -       | POI-Typ (Enum)                                |
| name        | String   | Nein     | null    | POI-Name (max. 255 Zeichen)                   |
| adresse     | String   | Nein     | null    | Adresse (max. 500 Zeichen)                    |
| mgrs        | String   | Nein     | null    | MGRS-Koordinaten (primär, max. 20 Zeichen)    |
| latitude    | Float    | Ja       | -       | Breitengrad (aus MGRS berechnet oder direkt)  |
| longitude   | Float    | Ja       | -       | Längengrad (aus MGRS berechnet oder direkt)   |
| icon        | String   | Nein     | null    | Icon-Identifier (max. 50 Zeichen)             |
| metadata    | Json     | Nein     | null    | Zusätzliche strukturierte Daten (JSON)        |
| createdAt   | DateTime | Ja       | now()   | Erstellungszeitpunkt                          |
| updatedAt   | DateTime | Ja       | (auto)  | Aktualisierungszeitpunkt                      |

**Beziehungen:**

- **lagekarte**: N:1 zu `Lagekarte` (Foreign Key: `lagekarteId`) - Cascade onDelete

**Indexes:**

- Auf `lagekarteId`
- Auf `type`
- Auf `mgrs` (für schnelle MGRS-Suche)

**Constraints:**

- Bei Lagekarte-Löschung: Cascade Delete (alle POIs werden mit gelöscht)
- **MGRS ist das primäre Koordinatenformat**, Lat/Lng dient als Fallback
- MGRS-Format: z.B. "33UVU1234567890" (max. 20 Zeichen)

---
