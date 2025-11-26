# 6. Domain Model

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
