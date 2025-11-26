# Core Features

## 1. Einsatzverwaltung (Mission Management)

**Purpose:** Manage emergency response missions from creation to archival

**Key Capabilities:**
- Create missions with alarm keywords, location, description
- Update mission status: ANGELEGT → IN_BEARBEITUNG → ABGESCHLOSSEN
- Archive missions (no deletion allowed per policy)
- Bulk archive operations for administrative cleanup
- Full audit logging (creator, updater, timestamps)

**Business Rules:**
- **No-delete policy:** Einsätze can only be archived, never deleted
- **Status progression:** Enforced state machine transitions
- **Archival requirement:** Missions must be ABGESCHLOSSEN before archival
- **10-year retention:** Archived missions kept for regulatory compliance

**Database Model:**
```prisma
model Einsatz {
  id               String        @id @default(cuid())
  alarmstichwort   String?       @db.VarChar(255)
  einsatzort       String?       @db.VarChar(500)
  beschreibung     String?       @db.Text
  status           EinsatzStatus @default(ANGELEGT)

  // Archival metadata
  isArchived       Boolean       @default(false)
  archivedAt       DateTime?
  archivalChecksum String?       @db.VarChar(64) // SHA-256

  // Audit fields
  createdAt        DateTime      @default(now())
  createdBy        String        @db.VarChar(100)
  updatedAt        DateTime      @updatedAt
  updatedBy        String?       @db.VarChar(100)
}
```

## 2. Einsatztagebuch (ETB - Mission Log)

**Purpose:** Detailed chronological logging of mission events with full versioning

**Key Capabilities:**
- Create ETB for each mission (1:1 relationship)
- Add timestamped entries with priority levels (ROUTINE, WICHTIG, KRITISCH)
- Automatic entry numbering (laufendeNummer)
- Edit entries with full version history (EtbEintragHistorie)
- Soft-delete entries (flag as deleted, never purge)
- Lock ETB after mission completion (prevent modifications)
- Template system (Textbausteine) for common entries

**Versioning System:**
- Every ETB entry edit creates a history record
- History includes: old values, editor, timestamp, change reason
- Complete audit trail for legal compliance
- History immutable once created

**Archival Process:**
- ETB archived alongside Einsatz
- Generate SHA-256 checksum of all entries
- Checksum stored in EtbArchiv model
- 10-year retention period enforced

**Database Models:**
```prisma
model Einsatztagebuch {
  id          String                   @id @default(cuid())
  einsatzId   String                   @unique
  status      EinsatztagebuchStatus    @default(AKTIV)
  isLocked    Boolean                  @default(false)
  lockedAt    DateTime?
  lockedBy    String?

  eintraege   EtbEintrag[]
  historie    EtbEintragHistorie[]
}

model EtbEintrag {
  id              String              @id @default(cuid())
  tageBuchId      String
  laufendeNummer  Int
  zeitstempel     DateTime            @default(now())
  text            String              @db.Text
  prioritaet      EtbEintragPrioritaet @default(ROUTINE)
  isDeleted       Boolean             @default(false)

  // Versioning
  historie        EtbEintragHistorie[]
}
```

## 3. Lagekarte (Situation Map)

**Purpose:** Real-time geospatial visualization of mission elements

**Key Capabilities:**
- Create situation maps linked to missions
- Add POIs (Points of Interest) with MGRS coordinates
- POI types: FAHRZEUG, EINSATZORT, SAMMELSTELLE, WASSERENTNAHME, GEFAHRENBEREICH, SONSTIGES
- Convert addresses to coordinates via Nominatim geocoding
- Interactive Leaflet map with marker clustering
- Offline tile caching (future feature)
- Export map as PNG screenshot

**Coordinate System:**
- **Primary:** MGRS (Military Grid Reference System) for precision
- **Fallback:** Latitude/Longitude for compatibility
- **Library:** `mgrs` package for conversions

**Database Models:**
```prisma
model Lagekarte {
  id          String   @id @default(cuid())
  einsatzId   String   @unique
  name        String   @db.VarChar(255)
  pois        Poi[]
}

model Poi {
  id          String   @id @default(cuid())
  lagekarteId String
  typ         PoiType
  name        String   @db.VarChar(255)

  // MGRS coordinates (primary)
  mgrs        String?  @db.VarChar(50)

  // Lat/Lng (fallback/display)
  latitude    Float?
  longitude   Float?

  beschreibung String? @db.Text
}
```

## 4. User Management

**Purpose:** Role-based access control with authentication

**Key Capabilities:**
- Unified authentication (automatic registration on first login)
- Three roles: SUPER_ADMIN, ADMIN, USER
- Password-based admin login
- Passwordless user login (username only)
- Manual user locking by admins
- Activity tracking (last login, failed login count)
- Soft delete (isDeleted flag)

**Authentication Strategy:**
- **JWT Tokens:** Access token (15 min) + Refresh token (7 days)
- **Storage:** httpOnly cookies (XSS protection)
- **CSRF Protection:** sameSite: strict
- **Auto-refresh:** Interceptor retries failed requests after token refresh

**Database Model:**
```prisma
model User {
  id               String    @id @default(cuid())
  username         String    @unique @db.VarChar(100)
  passwordHash     String?   @db.Text // only admin users
  role             UserRole  @default(USER)
  isActive         Boolean   @default(true)
  isDeleted        Boolean   @default(false)
  isLocked         Boolean   @default(false)
  lastLoginAt      DateTime?
  failedLoginCount Int       @default(0)
}
```

## 5. Audit Logging

**Purpose:** Complete audit trail for all entities

**Implementation:**
- Every model includes: `createdAt`, `createdBy`, `updatedAt`, `updatedBy`
- ETB entries have full versioning (EtbEintragHistorie)
- Archival process generates SHA-256 checksums
- User actions tracked (login attempts, account locks)

**Regulatory Compliance:**
- 10-year retention for archived missions and ETBs
- Immutable history records (no updates/deletes)
- Checksum verification for data integrity

---
