# 6. Domain Model

## Domain-Driven Design Konzepte

Die Hexagonale Architektur Migration führt DDD-Patterns ein, die eine klare Trennung zwischen fachlicher Domänenlogik und technischer Infrastruktur ermöglichen. Die folgenden Abschnitte dokumentieren die wichtigsten DDD-Konzepte, die in der Domain Layer implementiert sind.

### Aggregate Roots

Aggregates definieren die transaktionalen Grenzen und stellen sicher, dass Business Rules konsistent durchgesetzt werden. Jedes Aggregate Root verwaltet seine Child Entities und garantiert Invariantenschutz.

| Aggregate | Datei | Verantwortlichkeit |
|-----------|-------|-------------------|
| **EinsatzAggregate** | `src/domain/aggregates/einsatz.aggregate.ts` | Zentrale Einsatzverwaltung mit State Machine für Status-Transitionen (ANGELEGT → IN_BEARBEITUNG → ABGESCHLOSSEN → ARCHIVIERT). Implementiert NO-DELETE Policy für DRK-Compliance (10-Jahres-Aufbewahrungspflicht). Archivierte Einsätze sind immutable und können nicht mehr geändert werden. |
| **EinsatztagebuchAggregate** | `src/domain/aggregates/einsatztagebuch.aggregate.ts` | ETB-Verwaltung mit Soft-Delete Pattern für Einträge, automatischer Versionierung bei jeder Änderung, und Snapshot-Mechanismus für Audit-Trail. Unterstützt irreversibles Locking (DRAFT → ACTIVE → LOCKED). Nach LOCKED sind keine Änderungen mehr möglich. |
| **LagekarteAggregate** | `src/domain/aggregates/lagekarte.aggregate.ts` | POI-Management mit MGRS-Koordinaten als primäres Koordinatensystem (DRK-Standard). Verwaltet POI-Entities als Child-Entities und erzwingt eindeutige POI-Namen pro Lagekarte. Automatische Konvertierung zwischen GeoCoordinate und MGRS. |
| **UserAggregate** | `src/domain/aggregates/user.aggregate.ts` | Benutzerverwaltung mit RBAC (Role-Based Access Control). Implementiert Min-1-SUPER_ADMIN Constraint: System muss jederzeit mindestens einen SUPER_ADMIN haben. Unterscheidet zwischen Account Locking (reversibel) und Soft Delete (final). |

### Value Objects

Value Objects sind unveränderliche Objekte, die durch ihre Eigenschaften (nicht durch Identität) definiert werden. Sie kapseln Validierungslogik und verhindern Primitive Obsession.

| Value Object | Datei | Beschreibung |
|--------------|-------|--------------|
| **EinsatzId** | `value-objects/einsatz-id.ts` | Type-safe ID für Einsatz (basiert auf cuid2) |
| **EinsatzStatus** | `value-objects/einsatz-status.ts` | State Machine Implementation (ANGELEGT → IN_BEARBEITUNG → ABGESCHLOSSEN → ARCHIVIERT). Verhindert ungültige Status-Transitionen. |
| **EtbId** | `value-objects/etb-id.ts` | Type-safe ID für Einsatztagebuch |
| **EintragId** | `value-objects/eintrag-id.ts` | Type-safe ID für ETB-Einträge |
| **EtbKategorie** | `value-objects/etb-kategorie.ts` | ETB-Entry Kategorisierung (LAGE, MASSNAHME, KOMMUNIKATION, SONSTIGES) |
| **EtbStatus** | `value-objects/etb-status.ts` | ETB Lifecycle Status (DRAFT, ACTIVE, LOCKED) |
| **EtbSequenceNumber** | `value-objects/etb-sequence-number.ts` | Fortlaufende Nummer für ETB-Einträge |
| **EtbVersion** | `value-objects/etb-version.ts` | Versionsnummer für Optimistic Locking |
| **EtbSnapshot** | `value-objects/etb-snapshot.ts` | Immutable Snapshot eines ETB-Zustands für Audit-Trail |
| **UserId** | `value-objects/user-id.ts` | Type-safe ID für User (basiert auf cuid2) |
| **Username** | `value-objects/username.ts` | Validierter Username (min 3 Zeichen) |
| **UserRole** | `value-objects/user-role.ts` | RBAC Roles (USER, ADMIN, SUPER_ADMIN) mit Permission Mapping |
| **Permission** | `value-objects/permission.ts` | Granulare Berechtigungen mit Wildcard-Unterstützung (z.B. `einsatz:*`) |
| **LagekarteId** | `value-objects/lagekarte-id.ts` | Type-safe ID für Lagekarte |
| **PoiId** | `value-objects/poi-id.ts` | Type-safe ID für Point of Interest |
| **PoiCategory** | `value-objects/poi-category.ts` | POI-Kategorisierung (z.B. EINSATZSTELLE, SAMMELPLATZ, GEFAHRENBEREICH) |
| **MgrsCoordinate** | `value-objects/mgrs-coordinate.ts` | MGRS-Koordinaten (NATO-Standard, DRK-Primär) mit Validierung |
| **GeoCoordinate** | `value-objects/geo-coordinate.ts` | Lat/Lng-Koordinaten mit Konvertierung zu MGRS |
| **Address** | `value-objects/address.ts` | Strukturierte Adresse (Straße, PLZ, Ort) |

### Domain Events

Domain Events dokumentieren wichtige Geschäftsvorfälle und ermöglichen Event-Driven Architecture. Sie werden via Transactional Outbox Pattern atomar mit Aggregate-Änderungen persistiert.

| Event | Auslöser | Beschreibung |
|-------|----------|--------------|
| **EinsatzCreatedEvent** | Neuer Einsatz erstellt | Wird emittiert beim Anlegen eines neuen Einsatzes. Triggert automatische ETB-Erstellung und Lagekarte-Initialisierung. |
| **EinsatzStatusChangedEvent** | Status-Transition | Dokumentiert jeden Statuswechsel mit altem und neuem Status. Wichtig für Audit-Trail. |
| **EinsatzCompletedEvent** | Einsatz abgeschlossen | Einsatz erreicht Status ABGESCHLOSSEN. Setzt `abgeschlossenAt` Timestamp. |
| **EinsatzArchivedEvent** | Einsatz archiviert | Finale Status-Transition. Einsatz wird immutable. Triggert Archivierungsprozesse. |
| **EinsatzUpdatedEvent** | Einsatz-Daten geändert | Dokumentiert Änderungen an Einsatz-Properties (z.B. Alarmstichwort, Einsatzort). |
| **EtbCreatedEvent** | ETB automatisch angelegt | Wird automatisch beim Einsatz-Create ausgelöst. |
| **EintragAddedEvent** | Neuer ETB-Eintrag | Logs Erstellung eines ETB-Eintrags mit Kategorie und laufender Nummer. |
| **EintragUpdatedEvent** | ETB-Eintrag geändert | Dokumentiert Änderungen an bestehendem Eintrag. Triggert Versionierung. |
| **EintragDeletedEvent** | ETB-Eintrag gelöscht | Soft-Delete eines Eintrags. Eintrag bleibt in DB, wird aber als gelöscht markiert. |
| **EtbLockedEvent** | ETB gesperrt | Irreversible Sperrung. Keine weiteren Änderungen möglich. Triggert Snapshot-Erstellung. |
| **LagekarteCreatedEvent** | Lagekarte initialisiert | Lagekarte für Einsatz angelegt. Optional mit initiales POI. |
| **PoiAddedEvent** | POI hinzugefügt | Neuer Point of Interest auf Lagekarte platziert. |
| **PoiRemovedEvent** | POI entfernt | POI von Lagekarte gelöscht. |
| **PoiPositionUpdatedEvent** | POI-Position geändert | POI verschoben. Enthält alte und neue Koordinaten. |
| **UserCreatedEvent** | Neuer User angelegt | User-Account erstellt. Enthält initiale Role und Permissions. |
| **UserRoleChangedEvent** | User-Rolle geändert | RBAC Role-Wechsel (z.B. USER → ADMIN). Prüft Min-1-SUPER_ADMIN Constraint. |
| **PermissionGrantedEvent** | Berechtigung erteilt | Zusätzliche Permission gewährt. Ergänzt Role-basierte Permissions. |
| **PermissionRevokedEvent** | Berechtigung entzogen | Permission entfernt. |
| **UserDeletedEvent** | User gelöscht (Soft-Delete) | Account deaktiviert. Prüft Min-1-SUPER_ADMIN Constraint vor Löschung. |

### Repository Ports

Repository Interfaces definieren die Persistenz-Schnittstelle für Aggregates ohne technische Implementierungsdetails. Sie folgen dem Dependency Inversion Principle: Domain Layer hängt von Abstraktion ab, Infrastructure Layer implementiert.

| Port | Datei | Aggregate | Return-Type | Anmerkungen |
|------|-------|-----------|-------------|-------------|
| **IEinsatzRepository** | `repositories/ieinsatz.repository.ts` | EinsatzAggregate | `Result<T>` | Unterstützt Pagination (`findAllPaginated`), Status-Counts (`countByStatus`), und Active-Filter (`findActive`). Siehe ADR-024 für Result<T> Pattern Entscheidung. |
| **IEtbRepository** | `repositories/i-etb.repository.ts` | EinsatztagebuchAggregate | `Promise<T>` (Legacy, zu migrieren) | Beinhaltet `getHistory()` für Snapshot-Versionierung. Migration zu `Result<T>` Pattern geplant. |
| **ILagekarteRepository** | `repositories/i-lagekarte.repository.ts` | LagekarteAggregate | `Promise<T>` (Legacy, zu migrieren) | Unterstützt Lookup via `findByEinsatzId()` (1:1 Beziehung). `exists()` Methode für Performance-Optimierung. Migration zu `Result<T>` Pattern geplant. |
| **IUserRepository** | `repositories/i-user.repository.ts` | UserAggregate | `Result<T>` | Spezielle Methoden: `countSuperAdmins()` für Min-1-SUPER_ADMIN Constraint, `getPasswordHash()` für Auth (separiert von Aggregate). Siehe ADR-024. |
| **IOutboxRepository** | `repositories/i-outbox.repository.ts` | OutboxEvent (kein Aggregate) | `Promise<T>` (Sonderfall) | Transactional Outbox Pattern für atomare Event-Persistierung. `findAndLockPending()` verwendet PostgreSQL `FOR UPDATE SKIP LOCKED` für Race-Condition Prevention. |

**Hinweis:** Siehe ADR-024 für die Entscheidung zum Result<T> Pattern. Legacy-Repositories (`IEtbRepository`, `ILagekarteRepository`) verwenden noch `Promise<T>` und werden schrittweise auf `Result<T>` migriert.

---

## Core Entities (9 Models)

### 1. User

**Purpose:** Zentrale Benutzerverwaltung

**Key Fields:**
- `id` (String, cuid) - Primary Key
- `username` (String, unique) - Username
- `passwordHash` (String, optional) - Nur für Admin-User
- `role` (UserRole) - USER, ADMIN, SUPER_ADMIN
- `isActive` (Boolean) - Account aktiv/inaktiv
- `isDeleted` (Boolean) - Soft-Delete
- `isLocked` (Boolean) - Manueller Lock

**Relationships:**
- `createdEinsaetze` - Einsätze erstellt
- `updatedEinsaetze` - Einsätze aktualisiert
- `archivedEinsaetze` - Einsätze archiviert
- `createdEtbs` - ETBs erstellt
- `createdEtbEintraege` - ETB-Einträge erstellt

**Business Rules:**
- Soft-Delete statt physischer Löschung
- Manueller Lock getrennt von Auto-Lock
- Password-Hash nur für Admin-User (Standard-User haben keins)

### 2. Einsatz

**Purpose:** Einsatzverwaltung

**Key Fields:**
- `id` (String, cuid) - Primary Key
- `alarmstichwort` (String, optional) - Kann leer sein (ADR-018)
- `alarmierungszeit` (DateTime, optional) - Kann leer sein
- `status` (EinsatzStatus) - ANGELEGT, IN_BEARBEITUNG, ABGESCHLOSSEN, ARCHIVIERT
- `archivedAt` (DateTime, optional) - Archivierungszeitpunkt
- `archivedBy` (String, optional) - User ID des Archivierers

**Relationships:**
- `createdBy` - User (Creator)
- `updatedBy` - User (Updater)
- `archivedBy` - User (Archiver)
- `einsatztagebuch` - 1:1 Einsatztagebuch
- `lagekarte` - 1:1 Lagekarte

**Business Rules:**
- **No-Delete Policy (ADR-017):** Einsätze werden NIEMALS gelöscht, nur archiviert
- **Minimale Erstellung (ADR-018):** Keine Pflichtfelder außer ID
- **Computed Fields (ADR-019):** `name`, `completeness` werden berechnet

### 3. Einsatztagebuch

**Purpose:** 1:1 Beziehung zu Einsatz, Container für ETB-Einträge

**Key Fields:**
- `id` (String, cuid) - Primary Key
- `einsatzId` (String, unique) - Foreign Key zu Einsatz
- `status` (EtbStatus) - DRAFT, ACTIVE, LOCKED
- `lockedAt` (DateTime, optional) - Lock-Zeitpunkt
- `lockedBy` (String, optional) - User ID des Lockers

**Relationships:**
- `einsatz` - 1:1 Einsatz
- `eintraege` - 1:N EtbEintrag
- `createdBy` - User (Creator)
- `updatedBy` - User (Updater)
- `lockedBy` - User (Locker)

**Business Rules:**
- Status-Transition: DRAFT → ACTIVE → LOCKED
- Nach LOCKED: Keine Änderungen mehr möglich
- Automatische Archivierung nach 10 Jahren (EtbArchiv)

### 4. EtbEintrag

**Purpose:** Einzelner Einsatztagebuch-Eintrag mit Versionierung

**Key Fields:**
- `id` (String, cuid) - Primary Key
- `laufendeNummer` (Int) - Fortlaufende Nummer innerhalb ETB
- `timestampErstellung` (DateTime) - Erstellungszeitpunkt
- `timestampEreignis` (DateTime) - Ereigniszeitpunkt
- `kategorie` (EtbKategorie) - LAGE, MASSNAHME, KOMMUNIKATION
- `beschreibung` (String) - Freitext
- `isDeleted` (Boolean) - Soft-Delete

**Relationships:**
- `einsatztagebuch` - N:1 Einsatztagebuch
- `historie` - 1:N EtbEintragHistorie
- `createdBy` - User (Creator)
- `updatedBy` - User (Updater)
- `deletedBy` - User (Deleter)

**Business Rules:**
- Versionierung bei jeder Änderung
- Soft-Delete mit Zeitstempel
- Laufende Nummer für einfache Referenzierung

### 5. EtbEintragHistorie

**Purpose:** Vollständige Versionshistorie eines ETB-Eintrags

**Key Fields:**
- `id` (String, cuid) - Primary Key
- `eintragId` (String) - Foreign Key zu EtbEintrag
- `versionNumber` (Int) - Versionsnummer
- `modifiedAt` (DateTime) - Änderungszeitpunkt
- `changes` (JSON) - Diff der Änderungen

**Relationships:**
- `eintrag` - N:1 EtbEintrag
- `modifiedBy` - User (Modifier)

**Business Rules:**
- Unveränderbar nach Erstellung
- Vollständige Nachvollziehbarkeit
- JSON-Diff für effizienten Speicher

### 6. EtbTextbaustein

**Purpose:** Wiederverwendbare Textbausteine für ETB-Einträge

**Key Fields:**
- `id` (String, cuid) - Primary Key
- `titel` (String) - Titel des Bausteins
- `inhalt` (String) - Textinhalt
- `kategorie` (EtbKategorie) - Zugeordnete Kategorie
- `isDeleted` (Boolean) - Soft-Delete

**Relationships:**
- `createdBy` - User (Creator)
- `updatedBy` - User (Updater)

**Business Rules:**
- Global verfügbar (nicht Einsatz-spezifisch)
- Soft-Delete für Audit-Trail

### 7. EtbArchiv

**Purpose:** 10-Jahre-Archivierung von ETBs mit Checksummen

**Key Fields:**
- `id` (String, cuid) - Primary Key
- `einsatztagebuchId` (String, unique) - Foreign Key zu Einsatztagebuch
- `archivData` (JSON) - Vollständiger ETB-Snapshot
- `checksum` (String) - SHA-256 Checksum
- `archivedAt` (DateTime) - Archivierungszeitpunkt

**Relationships:**
- `einsatztagebuch` - 1:1 Einsatztagebuch
- `archivedBy` - User (Archiver)

**Business Rules:**
- Unveränderbar nach Erstellung
- SHA-256 Checksum für Integrität
- Automatische Erstellung bei ETB-Lock oder 10 Jahren

### 8. Lagekarte

**Purpose:** Geografische Visualisierung eines Einsatzes

**Key Fields:**
- `id` (String, cuid) - Primary Key
- `einsatzId` (String, unique) - Foreign Key zu Einsatz
- `centerLat` (Float, optional) - Zentrum Latitude
- `centerLng` (Float, optional) - Zentrum Longitude
- `centerMgrs` (String, optional) - MGRS-Koordinate (primary)
- `zoom` (Int, default: 13) - Zoom-Level
- `geoJson` (JSON) - GeoJSON Features

**Relationships:**
- `einsatz` - 1:1 Einsatz
- `pois` - 1:N LagekartePoi

**Business Rules:**
- MGRS-Koordinaten als Primär (mit Lat/Lng Fallback)
- GeoJSON für Zeichnungen (Polygone, Linien, etc.)
- Offline-fähig (Leaflet Tiles)

### 9. LagekartePoi

**Purpose:** Point of Interest auf Lagekarte

**Key Fields:**
- `id` (String, cuid) - Primary Key
- `lagekarteId` (String) - Foreign Key zu Lagekarte
- `typ` (PoiType) - EINSATZSTELLE, SAMMELPLATZ, GEFAHRENBEREICH
- `name` (String) - POI-Name
- `latitude` (Float) - Lat-Koordinate
- `longitude` (Float) - Lng-Koordinate
- `mgrsKoordinate` (String, optional) - MGRS-Koordinate

**Relationships:**
- `lagekarte` - N:1 Lagekarte

**Business Rules:**
- Lat/Lng als Primär (mit MGRS optional)
- Icon basierend auf `typ`
- Clustering bei vielen POIs

## Entity Relationships (ER Diagram)

```
User
  │
  ├── 1:N ──► Einsatz (as Creator/Updater/Archiver)
  │           │
  │           ├── 1:1 ──► Einsatztagebuch
  │           │           │
  │           │           └── 1:N ──► EtbEintrag
  │           │                       │
  │           │                       └── 1:N ──► EtbEintragHistorie
  │           │
  │           └── 1:1 ──► Lagekarte
  │                       │
  │                       └── 1:N ──► LagekartePoi
  │
  ├── 1:N ──► Einsatztagebuch (as Creator/Updater/Locker)
  │
  ├── 1:N ──► EtbEintrag (as Creator/Updater/Deleter)
  │
  ├── 1:N ──► EtbEintragHistorie (as Modifier)
  │
  ├── 1:N ──► EtbTextbaustein (as Creator/Updater)
  │
  └── 1:N ──► EtbArchiv (as Archiver)
```

## Enums (5)

1. **UserRole:** USER, ADMIN, SUPER_ADMIN
2. **EinsatzStatus:** ANGELEGT, IN_BEARBEITUNG, ABGESCHLOSSEN, ARCHIVIERT
3. **EtbStatus:** DRAFT, ACTIVE, LOCKED
4. **EtbKategorie:** LAGE, MASSNAHME, KOMMUNIKATION, SONSTIGES
5. **PoiType:** EINSATZSTELLE, SAMMELPLATZ, GEFAHRENBEREICH, BEREITSTELLUNGSRAUM, ABSPERRUNG

---
