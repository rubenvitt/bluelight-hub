# Epic 1: Hexagonal Architecture Foundation

**Goal:** Establish framework-agnostic Domain Layer as foundation for all future development.

**Business Value:**
- ORM-Wechsel betrifft nur 5 Adapter-Dateien statt 37+ Dateien
- Domain-Tests ohne Framework-Dependencies (90% schneller)
- Business-Logic zentral in Aggregates (Single Source of Truth)
- Zukunftssicher: Neue Features = neue Use Cases, ohne Legacy-Code zu ändern

**Technical Scope:**
- Domain Layer Package-Struktur (`domain/aggregates/`, `domain/value-objects/`, `domain/events/`)
- Base Classes (AggregateRoot, DomainEvent, ValueObject, Result<T>, EntityId)
- 4 Aggregates (Einsatz, ETB, Lagekarte, User) mit kompletter Business-Logic
- 15-20 Value Objects mit Validierung (EinsatzStatus, MgrsCoordinate, UserId, etc.)
- 15-20 typisierte Domain Events
- 4 Repository Interfaces (Ports)
- 3-5 Domain Services (Cross-Aggregate Logic)

**Success Criteria:**
- [ ] Domain Layer kompiliert isoliert: `pnpm --filter @bluelight-hub/domain build`
- [ ] 0 externe Dependencies (außer TypeScript stdlib)
- [ ] 50+ Unit-Tests ohne Framework-Mock
- [ ] KEINE Änderung an bestehendem Code (paralleler Aufbau)

**Estimated Effort:** 44-59h (updated with Story 1.0)

---

## Story 1.0: Test Infrastructure Setup (Jest + SWC)

**As a** Backend Developer,
**I want** a fast, framework-independent test infrastructure,
**So that** I can write Domain Layer unit tests without NestJS dependencies.

**Acceptance Criteria:**

**Given** the backend has no test framework installed
**When** I set up the test infrastructure
**Then** the following are installed:
- `jest` (testing framework)
- `@swc/jest` (2-4x faster than ts-jest)
- `@types/jest` (TypeScript support)

**And** a `jest.config.js` exists with:
- SWC transformer for TypeScript
- Domain Layer test paths: `**/domain/**/*.spec.ts`
- Coverage collection for `src/domain/` only
- Module path aliases (`@domain/*`, `@application/*`, `@infrastructure/*`)

**And** package.json scripts exist:
- `test`: Run all tests
- `test:watch`: Watch mode
- `test:cov`: Coverage report
- `test:domain`: Domain Layer tests only

**And** a first example test exists:
- `src/domain/common/result.spec.ts` (tests Result<T> class)
- Uses pure TypeScript (NO @nestjs/testing imports)
- Follows Given-When-Then pattern

**Prerequisites:** None (Foundation Story)

**Technical Notes:**
- **Why Jest?** Official NestJS framework, mature ecosystem, @nestjs/testing support for Epic 2+
- **Why @swc/jest?** 2.59x faster than ts-jest for unit tests, 4.99x for coverage
- **Framework Independence:** Domain Layer tests use NO NestJS utilities (pure TS)
- **Reference:** Test Framework Research Report in validation findings

**Estimated Effort:** 2-3h

---

## Story 1.1: Domain Layer Project Structure & Infrastructure

**As a** Backend Developer,
**I want** a clean Domain Layer package structure with build tooling,
**So that** I can develop framework-agnostic Domain objects independently from Application/Infrastructure layers.

**Acceptance Criteria:**

**Given** the monorepo structure at `packages/backend/src/`
**When** I create the Domain Layer package structure
**Then** the following directories exist:
- `domain/aggregates/` (Rich Domain Models)
- `domain/value-objects/` (Immutable, self-validating objects)
- `domain/events/` (Typed Domain Events)
- `domain/repositories/` (Port Interfaces)
- `domain/services/` (Cross-Aggregate Logic)

**And** a `domain/package.json` exists with:
- TypeScript compiler configuration
- No external dependencies (only devDependencies: typescript, vitest)
- Build script: `pnpm build` compiles to `domain/dist/`

**And** Dependency validation is enforced:
- Install `madge` for circular dependency detection: `pnpm add -D madge -w --filter @bluelight-hub/backend`
- ESLint `no-restricted-imports` prevents imports from `application/` or `infrastructure/`
- Package.json script: `"check:deps": "madge --circular src/domain/"`
- Pre-commit hook runs `pnpm check:deps`

**And** a `domain/README.md` exists explaining:
- Hexagonal Architecture principles
- Layer responsibilities
- Coding conventions (Aggregates, VOs, Events)
- Example: "How to create a new Aggregate"

**Prerequisites:** None (Foundation Story)

**Technical Notes:**
- **ADR-022:** Domain Layer als Backend Subfolder (`packages/backend/src/domain/`)
- Use TypeScript `paths` for clean imports: `@domain/aggregates/*`
- Vitest config for isolated tests (no NestJS test utilities)
- ADR-001: Document decision for Hexagonal Architecture
- This story sets up structure ONLY - no domain logic yet

---

## Story 1.2: Base Classes for Domain Layer Patterns

**As a** Domain Developer,
**I want** reusable base classes for Aggregates, Value Objects, and Events,
**So that** all Domain objects follow consistent patterns for equality, immutability, and event handling.

**Acceptance Criteria:**

**Given** the Domain Layer structure exists (Story 1.1)
**When** I implement the base classes
**Then** the following classes exist in `domain/common/`:

**1. AggregateRoot<TId> (Abstract Base Class)**
- Properties: `id: TId`, `createdAt: Date`, `updatedAt: Date`
- Methods:
  - `addDomainEvent(event: DomainEvent): void` - Add event to uncommitted list
  - `getUncommittedEvents(): DomainEvent[]` - Return events since last commit
  - `clearEvents(): void` - Clear uncommitted events after publishing
  - `equals(other: AggregateRoot<TId>): boolean` - Identity equality by ID

**2. DomainEvent (Abstract Base Class)**
- Properties: `eventId: string (UUID)`, `occurredAt: Date`, `aggregateId: string`
- Constructor auto-generates `eventId` and `occurredAt`
- Immutable (readonly properties)

**3. ValueObject (Abstract Base Class)**
- Method: `equals(other: ValueObject): boolean` - Structural equality
- All properties must be readonly
- No identity (equality by value, not reference)

**4. Result<T> (Railway Oriented Programming)**
- Static methods:
  - `Result.ok<T>(value: T): Result<T>` - Success case
  - `Result.fail<T>(error: string): Result<T>` - Failure case
- Properties: `isSuccess: boolean`, `isFailure: boolean`, `value?: T`, `error?: string`
- Prevents throwing exceptions in Domain Layer

**5. EntityId<T> (Typed ID Base Class)**
- Generic wrapper for typed IDs (e.g., `UserId extends EntityId<'User'>`)
- Properties: `value: string`
- Methods: `equals(other: EntityId<T>): boolean`, `toString(): string`
- Prevents primitive obsession (no raw `string` IDs)

**And** Unit-Tests cover:
- AggregateRoot event accumulation and clearing
- ValueObject equality (same value = equal, even if different instances)
- Result success/failure paths
- EntityId type safety (UserId ≠ EinsatzId at compile-time)

**Prerequisites:** Story 1.1 (Project Structure)

**Technical Notes:**
- Use TypeScript generics for type safety
- AggregateRoot event handling pattern from DDD Blue Book (Eric Evans)
- Result<T> pattern prevents domain exceptions leaking to Application Layer
- EntityId uses TypeScript branded types: `type UserId = EntityId<'User'> & { __brand: 'UserId' }`
- DomainEvent uses `crypto.randomUUID()` for `eventId` (Node.js built-in, no dependency)

---

## Story 1.3: Einsatz Aggregate & Value Objects

**As a** Domain Developer,
**I want** the Einsatz Aggregate with rich domain logic and typed value objects,
**So that** business rules (status transitions, NO-DELETE policy, archival) are enforced at the domain level.

**Acceptance Criteria:**

**Given** Base Classes exist (Story 1.2)
**When** I implement Einsatz domain objects
**Then** the following exist:

**1. EinsatzAggregate extends AggregateRoot<EinsatzId>**

Properties:
- `nummer: string` (auto-generated, e.g., "E2024-001")
- `alarmstichwort: string`
- `status: EinsatzStatus` (Value Object)
- `einsatzort?: Address` (Value Object)
- `bemerkung?: string`
- `createdBy: UserId`
- `abgeschlossenAt?: Date`

Methods (Business Logic):
- `static create(props): Result<EinsatzAggregate>` - Factory mit Validierung
- `complete(userId: UserId): Result<void>` - Transition zu ABGESCHLOSSEN, emits EinsatzCompletedEvent
- `archive(userId: UserId): Result<void>` - Transition zu ARCHIVIERT, emits EinsatzArchivedEvent
- `updateStatus(newStatus: EinsatzStatus): Result<void>` - Validierte Status-Transitions
- `canBeDeleted(): boolean` - **ALWAYS returns false** (NO-DELETE Policy für DRK-Compliance)

Business Rules:
- Status-Transition nur erlaubt: ANGELEGT → IN_BEARBEITUNG → ABGESCHLOSSEN → ARCHIVIERT
- Rückwärts-Transition verboten (z.B. ABGESCHLOSSEN → IN_BEARBEITUNG)
- `complete()` setzt `abgeschlossenAt` timestamp
- `archive()` verhindert weitere Änderungen (Immutable nach Archivierung)

**2. Value Objects**

`EinsatzStatus`:
- Erlaubte Werte: ANGELEGT, IN_BEARBEITUNG, ABGESCHLOSSEN, ARCHIVIERT
- Method: `canTransitionTo(newStatus: EinsatzStatus): boolean` (State Machine)

`EinsatzId extends EntityId<'Einsatz'>`:
- Typed ID (compile-time sicher)

`Address`:
- Properties: `strasse?: string`, `hausnummer?: string`, `plz?: string`, `ort?: string`
- Validation: PLZ format (5 digits für Deutschland)
- Method: `toString(): string` - Formatierte Adresse

**3. Domain Events**

`EinsatzCreatedEvent extends DomainEvent`:
- `einsatzId: EinsatzId`
- `createdBy: UserId`
- `alarmstichwort: string`

`EinsatzCompletedEvent extends DomainEvent`:
- `einsatzId: EinsatzId`
- `completedBy: UserId`
- `completedAt: Date`

`EinsatzArchivedEvent extends DomainEvent`:
- `einsatzId: EinsatzId`
- `archivedBy: UserId`

`EinsatzStatusChangedEvent extends DomainEvent`:
- `einsatzId: EinsatzId`
- `oldStatus: EinsatzStatus`
- `newStatus: EinsatzStatus`

**4. Repository Interface (Port)**

`IEinsatzRepository`:
```typescript
interface IEinsatzRepository {
  save(aggregate: EinsatzAggregate): Promise<void>;
  findById(id: EinsatzId): Promise<EinsatzAggregate | null>;
  findActive(): Promise<EinsatzAggregate[]>; // Status != ARCHIVIERT
  findByNummer(nummer: string): Promise<EinsatzAggregate | null>;
  exists(id: EinsatzId): Promise<boolean>;
}
```

**And** Unit-Tests validate:
- Status transitions (valid paths succeed, invalid fail)
- NO-DELETE policy (`canBeDeleted()` always false)
- Event emission (complete/archive emit correct events)
- Value Object validation (Address PLZ, EinsatzStatus transitions)
- Aggregate invariants (z.B. archived Einsatz kann nicht mehr geändert werden)

**Prerequisites:** Story 1.2 (Base Classes)

**Technical Notes:**
- Use Result<T> for all methods that can fail (no exceptions)
- State Machine for EinsatzStatus ensures only valid transitions
- NO-DELETE policy ist DRK-Compliance: 10-year archival requirement
- Events follow Event Storming notation from DDD
- Repository Interface in Domain Layer (implementation in Infrastructure Layer)

---

## Story 1.4: Einsatztagebuch (ETB) Aggregate with Versioning

**As a** Domain Developer,
**I want** the ETB Aggregate with automatic versioning, locking, and sequence numbers,
**So that** audit-trail and revision safety are enforced at the domain level (DRK-Compliance).

**Acceptance Criteria:**

**Given** Base Classes exist (Story 1.2)
**When** I implement ETB domain objects
**Then** the following exist:

**1. EinsatztagebuchAggregate extends AggregateRoot<EtbId>**

Properties:
- `einsatzId: EinsatzId` (Foreign Aggregate Reference)
- `status: EtbStatus` (DRAFT, ACTIVE, LOCKED)
- `eintraege: EtbEintrag[]` (Ordered List)
- `version: EtbVersion` (Value Object mit Versionsnummer + Timestamp)
- `currentVersion: EtbVersion` (Current version number only)
- `nextSequenceNumber: number` (Auto-Increment für neue Einträge)

Methods:
- `static create(einsatzId: EinsatzId): Result<EinsatztagebuchAggregate>` - Factory
- `addEintrag(text: string, userId: UserId): Result<EtbEintrag>` - Fügt Eintrag hinzu, auto-increment Sequence Number, emits EintragAddedEvent
- `updateEintrag(eintragId: EintragId, newText: string, userId: UserId): Result<void>` - Speichert alte Version in History, emits EintragUpdatedEvent
- `deleteEintrag(eintragId: EintragId, userId: UserId): Result<void>` - **Soft-Delete**: Eintrag bleibt in History sichtbar, emits EintragDeletedEvent
- `lock(userId: UserId): Result<void>` - Status → LOCKED (verhindert weitere Änderungen), emits EtbLockedEvent
- `isLocked(): boolean` - Check if modifications allowed

Business Rules:
- **Sequence Numbers sind immutable:** Einmal vergeben, nie änderbar
- **Versionierung:** Jede Änderung (add/update/delete) erhöht `version` und speichert Snapshot in `history`
- **Immutability when locked:** Wenn `status === LOCKED`, alle Änderungs-Methoden returnen `Result.fail()`
- **Soft-Delete für Einträge:** Gelöschte Einträge bleiben in History (Compliance)
- **Auto-Create Strategy:** ETB wird automatisch bei Einsatz-Creation erstellt
- **Implementation:** Application Layer Event Handler (nicht Epic-1 Scope)
- **Epic-1 Scope:** Nur Domain Layer (Aggregate + Events), KEIN Event Handler

**2. EtbEintrag (Entity, NOT Aggregate)**

Properties:
- `id: EintragId`
- `sequenceNumber: EtbSequenceNumber` (Value Object, immutable)
- `text: string`
- `createdBy: UserId`
- `createdAt: Date`
- `updatedAt?: Date`
- `isDeleted: boolean` (Soft-Delete Flag)

Methods:
- `update(newText: string, userId: UserId): void` - Updates text + timestamp
- `markAsDeleted(): void` - Soft-Delete

**3. Value Objects**

`EtbId extends EntityId<'Etb'>`

`EintragId extends EntityId<'Eintrag'>`

`EtbSequenceNumber`:
- Property: `value: number` (starting at 1)
- Validation: Must be positive integer
- Immutable (can never change)

`EtbVersion`:
- Properties: `versionNumber: number`, `timestamp: Date`
- Method: `increment(): EtbVersion` - Returns new version (versionNumber + 1)

`EtbStatus`:
- Erlaubte Werte: DRAFT, ACTIVE, LOCKED
- Validation: Transition LOCKED → ACTIVE verboten (lock is irreversible)

`EtbSnapshot` (Versioning Snapshot):
- Properties: `version: EtbVersion`, `eintraege: EtbEintrag[]`, `snapshotAt: Date`
- Stores previous state before modification

**4. Domain Events**

`EintragAddedEvent extends DomainEvent`:
- `etbId: EtbId`, `eintragId: EintragId`, `sequenceNumber: number`, `text: string`, `createdBy: UserId`

`EintragUpdatedEvent extends DomainEvent`:
- `etbId: EtbId`, `eintragId: EintragId`, `oldText: string`, `newText: string`, `updatedBy: UserId`

`EintragDeletedEvent extends DomainEvent`:
- `etbId: EtbId`, `eintragId: EintragId`, `deletedBy: UserId`

`EtbLockedEvent extends DomainEvent`:
- `etbId: EtbId`, `lockedBy: UserId`, `lockedAt: Date`

**5. Repository Interface**

`IEtbRepository`:
```typescript
interface IEtbRepository {
  save(aggregate: EinsatztagebuchAggregate): Promise<void>;
  findById(id: EtbId): Promise<EinsatztagebuchAggregate | null>;
  findByEinsatzId(einsatzId: EinsatzId): Promise<EinsatztagebuchAggregate | null>;
  getHistory(id: EtbId): Promise<EtbSnapshot[]>;
}
```

**And** Unit-Tests validate:
- Sequence number auto-increment (1, 2, 3, ...)
- Versionierung: Snapshot wird vor Änderung gespeichert
- Locked ETB rejects all modifications
- Soft-Delete: Deleted entries remain in history
- Event emission (add/update/delete/lock emit events)

**Prerequisites:** Story 1.2 (Base Classes)

**Technical Notes:**
- Versionierung pattern from Event Sourcing (snapshot before each mutation)
- Sequence numbers are domain invariants (never gaps, never duplicates)
- Locking is irreversible (compliance requirement for finalized logs)
- EtbEintrag is Entity (has identity), NOT Value Object
- Repository stores snapshots in separate table (e.g., `etb_history`)
- **History Storage:** Snapshots stored in DB (via `IEtbRepository.getHistory()`), NOT in Aggregate
- **Rationale:** Unbounded growth prevention (10,000+ changes = 10,000 snapshots in memory)
- **Domain Invariant:** Aggregate tracks `currentVersion`, Repository manages history persistence

---

## Story 1.5: Lagekarte Aggregate with MGRS Coordinates

**As a** Domain Developer,
**I want** the Lagekarte Aggregate with MGRS coordinate system (primary) and Lat/Lng fallback,
**So that** geo-positioning follows DRK standards (MGRS) while supporting external APIs (Lat/Lng).

**Acceptance Criteria:**

**Given** Base Classes exist (Story 1.2)
**When** I implement Lagekarte domain objects
**Then** the following exist:

**1. LagekarteAggregate extends AggregateRoot<LagekarteId>**

Properties:
- `einsatzId: EinsatzId` (Foreign Aggregate Reference)
- `pois: Poi[]` (Points of Interest)
- `createdAt: Date`

Methods:
- `static create(einsatzId: EinsatzId, initialPoi?: Poi): Result<LagekarteAggregate>` - Factory (Lagekarte + optional initialer POI atomically)
- `addPoi(name: string, coordinate: MgrsCoordinate | GeoCoordinate, category: PoiCategory): Result<Poi>` - Fügt POI hinzu, emits PoiAddedEvent
- `removePoi(poiId: PoiId): Result<void>` - Entfernt POI, emits PoiRemovedEvent
- `updatePoiPosition(poiId: PoiId, newCoordinate: MgrsCoordinate | GeoCoordinate): Result<void>` - Update POI location
- `findPoisByCategory(category: PoiCategory): Poi[]` - Filter POIs

Business Rules:
- **MGRS is primary:** Wenn POI mit Lat/Lng erstellt wird, konvertiere zu MGRS (via `GeoCoordinate.toMgrs()`)
- **Lazy Creation Strategy:** Lagekarte wird NUR bei erster POI-Erstellung angelegt
- **Implementation:** Application Layer Command Handler (nicht Epic-1 Scope)
- **Epic-1 Scope:** Nur Domain Layer (Aggregate + Events), KEIN Command Handler
- **Rationale:** Nicht jeder Einsatz benötigt Lagekarte (Optional)
- **Transactional Atomic:** `create()` mit initialPoi MUSS atomar sein (DB-Transaktion)

**2. Poi (Entity, NOT Aggregate)**

Properties:
- `id: PoiId`
- `name: string`
- `coordinate: MgrsCoordinate` (ALWAYS stored as MGRS)
- `category: PoiCategory` (Value Object)
- `beschreibung?: string`
- `createdAt: Date`

Methods:
- `updatePosition(newCoordinate: MgrsCoordinate): void`
- `getLatLng(): GeoCoordinate` - Konvertiere MGRS → Lat/Lng für externe APIs

**3. Value Objects**

`LagekarteId extends EntityId<'Lagekarte'>`

`PoiId extends EntityId<'Poi'>`

`MgrsCoordinate` (PRIMARY Coordinate System):
- Properties: `gridZone: string` (e.g., "32U"), `squareId: string` (e.g., "MV"), `easting: number`, `northing: number`
- Validation: MGRS format (Regex: `^\d{1,2}[A-Z] [A-Z]{2} \d{5} \d{5}$`)
- Methods:
  - `toLatLng(): GeoCoordinate` - Convert MGRS → Lat/Lng (use external library like `mgrs` npm package)
  - `toString(): string` - Format as "32U MV 12345 67890"
  - `distanceTo(other: MgrsCoordinate): number` - Calculate distance in meters

`GeoCoordinate` (FALLBACK System):
- Properties: `latitude: number`, `longitude: number`
- Validation: Lat range [-90, 90], Lng range [-180, 180]
- Methods:
  - `toMgrs(): MgrsCoordinate` - Convert Lat/Lng → MGRS
  - `distanceTo(other: GeoCoordinate): number` - Haversine formula
  - `toString(): string` - Format as "52.5200°N, 13.4050°E"

`PoiCategory`:
- Erlaubte Werte: EINSATZSTELLE, BEREITSTELLUNGSRAUM, GEFAHRENSTELLE, WASSERENTNAHMESTELLE, SONSTIGES
- Color mapping für UI (z.B., EINSATZSTELLE = red)

**4. Domain Events**

`PoiAddedEvent extends DomainEvent`:
- `lagekarteId: LagekarteId`, `poiId: PoiId`, `name: string`, `coordinate: MgrsCoordinate`, `category: PoiCategory`

`PoiRemovedEvent extends DomainEvent`:
- `lagekarteId: LagekarteId`, `poiId: PoiId`

`PoiPositionUpdatedEvent extends DomainEvent`:
- `lagekarteId: LagekarteId`, `poiId: PoiId`, `oldCoordinate: MgrsCoordinate`, `newCoordinate: MgrsCoordinate`

**5. Repository Interface**

`ILagekarteRepository`:
```typescript
interface ILagekarteRepository {
  save(aggregate: LagekarteAggregate): Promise<void>;
  findById(id: LagekarteId): Promise<LagekarteAggregate | null>;
  findByEinsatzId(einsatzId: EinsatzId): Promise<LagekarteAggregate | null>;
  exists(einsatzId: EinsatzId): Promise<boolean>;
}
```

**6. Port for Geocoding Service**

`IGeocodingPort` (Domain Service Interface):
```typescript
interface IGeocodingPort {
  geocodeAddress(address: Address): Promise<Result<GeoCoordinate>>;
  reverseGeocode(coordinate: GeoCoordinate): Promise<Result<Address>>;
}
```

**And** Unit-Tests validate:
- MGRS ↔ Lat/Lng conversion (bidirectional, use known test coordinates)
- Coordinate validation (invalid MGRS/Lat/Lng rejected)
- POI addition emits event with MGRS coordinate
- Distance calculation (MGRS and Lat/Lng both accurate within 1m tolerance)
- PoiCategory enum validation

**Prerequisites:** Story 1.2 (Base Classes)

**Technical Notes:**
- Use `mgrs` npm package (https://www.npmjs.com/package/mgrs) for MGRS ↔ Lat/Lng conversion
- MGRS is NATO standard (used by DRK for precision)
- Geocoding Port interface defined in Domain, implemented in Infrastructure (Adapter Pattern)
- Nominatim API Adapter will implement `IGeocodingPort` (not in this story)
- Haversine formula for Lat/Lng distance: https://en.wikipedia.org/wiki/Haversine_formula

---

## Story 1.6: User Aggregate & RBAC Value Objects

**As a** Domain Developer,
**I want** the User Aggregate with role-based access control (RBAC) and account locking,
**So that** authentication and authorization business rules are enforced at the domain level.

**Acceptance Criteria:**

**Given** Base Classes exist (Story 1.2)
**When** I implement User domain objects
**Then** the following exist:

**1. UserAggregate extends AggregateRoot<UserId>**

Properties:
- `username: Username` (Value Object, unique)
- `email?: string`
- `role: UserRole` (Value Object)
- `isLocked: boolean` (Account-Sperrung)
- `passwordHash?: string` (nur für ADMIN/SUPER_ADMIN)
- `lastLoginAt?: Date`
- `createdAt: Date`

Methods:
- `static create(props): Result<UserAggregate>` - Factory mit Username-Validierung
- `lock(reason: string, lockedBy: UserId): Result<void>` - Sperrt Account, emits UserLockedEvent
- `unlock(unlockedBy: UserId): Result<void>` - Entsperrt Account, emits UserUnlockedEvent
- `updatePassword(newPasswordHash: string): Result<void>` - Update password (nur für ADMIN/SUPER_ADMIN)
- `updateRole(newRole: UserRole, changedBy: UserId): Result<void>` - Role ändern, emits UserRoleChangedEvent
- `recordLogin(): void` - Update `lastLoginAt` timestamp
- `canBeDeleted(): boolean` - Prüft: Wenn letzter SUPER_ADMIN, return false (Min 1 SUPER_ADMIN Constraint)
- `hasRole(role: UserRole): boolean` - Role-Check für RBAC

Business Rules:
- **Min 1 SUPER_ADMIN Constraint:** System verhindert Löschen/Sperren des letzten SUPER_ADMIN
- **Unified Auth:** USER = Passwordless (kein `passwordHash`), ADMIN/SUPER_ADMIN = Password
- **Username eindeutig:** Validierung bei Erstellung (Repository-Check via `IUserRepository.existsByUsername()`)
- **Account Locking:** Gesperrte User können sich nicht einloggen (Application Layer muss prüfen)

**2. Value Objects**

`UserId extends EntityId<'User'>`

`Username`:
- Property: `value: string`
- Validation: 3-50 Zeichen, alphanumerisch + Unterstrich, keine Leerzeichen
- Case-insensitive equality (z.B., "Ruben" === "ruben")

`UserRole`:
- Erlaubte Werte: SUPER_ADMIN, ADMIN, USER
- Method: `hasPermission(permission: Permission): boolean` - Role → Permission Mapping
- Hierarchy: SUPER_ADMIN > ADMIN > USER (höhere Rolle hat alle Rechte niedrigerer Rollen)

`Permission` (Enum):
- Values: CREATE_EINSATZ, EDIT_EINSATZ, DELETE_EINSATZ, LOCK_ETB, MANAGE_USERS, SYSTEM_CONFIG
- Mapping:
  - SUPER_ADMIN: ALL permissions
  - ADMIN: CREATE_EINSATZ, EDIT_EINSATZ, LOCK_ETB, MANAGE_USERS
  - USER: CREATE_EINSATZ, EDIT_EINSATZ

**3. Domain Events**

`UserCreatedEvent extends DomainEvent`:
- `userId: UserId`, `username: Username`, `role: UserRole`, `createdBy?: UserId`

`UserLockedEvent extends DomainEvent`:
- `userId: UserId`, `reason: string`, `lockedBy: UserId`, `lockedAt: Date`

`UserUnlockedEvent extends DomainEvent`:
- `userId: UserId`, `unlockedBy: UserId`

`UserRoleChangedEvent extends DomainEvent`:
- `userId: UserId`, `oldRole: UserRole`, `newRole: UserRole`, `changedBy: UserId`

`UserPasswordChangedEvent extends DomainEvent`:
- `userId: UserId`, `changedAt: Date` (NO password in event für Security)

**4. Repository Interface**

`IUserRepository`:
```typescript
interface IUserRepository {
  save(aggregate: UserAggregate): Promise<void>;
  findById(id: UserId): Promise<UserAggregate | null>;
  findByUsername(username: Username): Promise<UserAggregate | null>;
  existsByUsername(username: Username): Promise<boolean>;
  findByRole(role: UserRole): Promise<UserAggregate[]>;
  countSuperAdmins(): Promise<number>; // Für Min 1 SUPER_ADMIN Constraint
}
```

**5. Port for Token Service**

`ITokenServicePort` (Domain Service Interface):
```typescript
interface ITokenServicePort {
  generateToken(userId: UserId, role: UserRole): Promise<string>;
  validateToken(token: string): Promise<Result<{ userId: UserId; role: UserRole }>>;
  revokeToken(token: string): Promise<void>;
}
```

**And** Unit-Tests validate:
- Username validation (min/max length, no special chars)
- Role hierarchy (SUPER_ADMIN has all permissions)
- Min 1 SUPER_ADMIN constraint (`canBeDeleted()` false for last SUPER_ADMIN)
- Account locking (locked user cannot login - simulated via `isLocked` check)
- Event emission (lock/unlock/role change emit events)
- Case-insensitive username equality

**Prerequisites:** Story 1.2 (Base Classes)

**Technical Notes:**
- RBAC follows Permission-Based model (not just role strings)
- Passwordless for USER role (DRK-Standard: Tablet-Login ohne Password)
- JWT Token Service Port interface in Domain, implementation in Infrastructure
- Password hashing done in Application Layer (before calling `updatePassword()`)
- Min 1 SUPER_ADMIN check requires Repository query (not pure domain logic)

---

## Story 1.7: Domain Services for Cross-Aggregate Logic

**As a** Domain Developer,
**I want** Domain Services for business logic spanning multiple Aggregates,
**So that** cross-aggregate coordination (naming, validation, geocoding) is centralized and reusable.

**Acceptance Criteria:**

**Given** All Aggregates exist (Stories 1.3-1.6)
**When** I implement Domain Services
**Then** the following services exist in `domain/services/`:

**1. EinsatzNamingService**

**Purpose:** Generate unique Einsatz numbers (e.g., "E2024-001") based on year + sequence.

Methods:
```typescript
class EinsatzNamingService {
  generateEinsatzNummer(year: number, sequenceNumber: number): string;
  // Example: generateEinsatzNummer(2024, 1) → "E2024-001"
  // Example: generateEinsatzNummer(2024, 42) → "E2024-042"
}
```

Business Rules:
- Format: `E{YEAR}-{SEQUENCE}` where SEQUENCE is zero-padded to 3 digits
- Sequence resets every year (E2024-999 → E2025-001)
- NOT responsible for sequence generation (Application Layer fetches next number from Repository)

**2. EinsatzCompletenessService**

**Purpose:** Validate if Einsatz can be completed (all required data present).

Methods:
```typescript
class EinsatzCompletenessService {
  canBeCompleted(einsatz: EinsatzAggregate): Result<void>;
  // Returns Result.ok() if completable, Result.fail(reason) if not

  getMissingRequirements(einsatz: EinsatzAggregate): string[];
  // Returns list of missing fields (e.g., ["einsatzort", "alarmstichwort"])
}
```

Business Rules:
- Einsatz kann nur completed werden wenn:
  - `alarmstichwort` ist gesetzt
  - `einsatzort` ist gesetzt (Optional: kann relaxed werden)
  - Status ist IN_BEARBEITUNG (nicht ANGELEGT)

**3. AddressGeocodingService (Port Implementation Skeleton)**

**Purpose:** Define interface for geocoding Address → GeoCoordinate (implemented in Infrastructure).

Interface:
```typescript
interface IAddressGeocodingService {
  geocode(address: Address): Promise<Result<GeoCoordinate>>;
  reverseGeocode(coordinate: GeoCoordinate): Promise<Result<Address>>;
}
```

**Note:** This is the SAME as `IGeocodingPort` from Story 1.5 - consolidate into one interface in `domain/services/ports/`.

**4. EinsatzArchivalPolicy (Domain Policy)**

**Purpose:** Enforce DRK 10-year archival policy (when Einsatz can be permanently archived).

Methods:
```typescript
class EinsatzArchivalPolicy {
  canBeArchived(einsatz: EinsatzAggregate, currentDate: Date): boolean;
  // Returns true if Einsatz is older than 10 years AND status is ABGESCHLOSSEN

  getArchivalDate(einsatz: EinsatzAggregate): Date;
  // Returns date when Einsatz becomes eligible for archival (abgeschlossenAt + 10 years)
}
```

Business Rules:
- Archival erlaubt NUR wenn:
  - Status ist ABGESCHLOSSEN
  - `abgeschlossenAt` ist mindestens 10 Jahre alt
- Nach Archivierung (Status → ARCHIVIERT) ist Einsatz immutable

**And** Unit-Tests validate:
- EinsatzNamingService: Number formatting (zero-padding, year boundary)
- EinsatzCompletenessService: Missing requirements detection
- EinsatzArchivalPolicy: 10-year calculation (use fixed test date)
- All services are stateless (Pure Functions where possible)

**And** README exists at `domain/services/README.md` explaining:
- When to use Domain Services vs Aggregate methods
- Domain Services are for cross-aggregate logic OR external integrations
- Naming convention: `{Context}Service` or `{Context}Policy`

**Prerequisites:**
- Story 1.3 (Einsatz Aggregate)
- Story 1.5 (Lagekarte Aggregate - for Geocoding Port)

**Technical Notes:**
- Domain Services are stateless (no internal state, only methods)
- Services that need persistence use Repository Ports (defined in Domain, injected from Infrastructure)
- Geocoding Service is a Port (interface in Domain, implementation in Infrastructure via Nominatim Adapter)
- Archival Policy implements DRK compliance requirement (10-year retention)
- Naming Service does NOT generate sequence numbers (Application Layer queries Repository for next number)

---

## Story 1.8: Database Constraints & Triggers for NO-DELETE Policy

**As a** Backend Developer,
**I want** PostgreSQL database-level constraints and triggers enforcing the NO-DELETE policy,
**So that** DRK compliance is guaranteed even if domain layer is bypassed (direct SQL, migrations, Prisma operations).

**Acceptance Criteria:**

**Given** Domain Layer enforces NO-DELETE via `canBeDeleted(): false` (Story 1.3, 1.4, 1.6)
**When** I implement database-level protection
**Then** the following constraints exist:

**1. PostgreSQL Triggers for NO-DELETE**

Create triggers for all DRK-compliance entities:
```sql
-- Einsatz Table
CREATE OR REPLACE FUNCTION prevent_einsatz_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'DRK Compliance Violation: Einsatz cannot be deleted. Use status=ARCHIVIERT instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER einsatz_no_delete
  BEFORE DELETE ON einsatz
  FOR EACH ROW
  EXECUTE FUNCTION prevent_einsatz_delete();

-- ETB Eintrag Table (Soft-Delete only)
CREATE OR REPLACE FUNCTION prevent_etb_eintrag_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'DRK Compliance Violation: ETB Einträge cannot be deleted. Use is_deleted=true instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER etb_eintrag_no_delete
  BEFORE DELETE ON etb_eintrag
  FOR EACH ROW
  EXECUTE FUNCTION prevent_etb_eintrag_delete();

-- Lagekarte Position Table
CREATE OR REPLACE FUNCTION prevent_poi_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'DRK Compliance Violation: POIs cannot be permanently deleted. Use removal via Aggregate only.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER poi_no_delete
  BEFORE DELETE ON poi
  FOR EACH ROW
  EXECUTE FUNCTION prevent_poi_hard_delete();

-- User Table (except SUPER_ADMIN constraint handled in domain)
CREATE OR REPLACE FUNCTION prevent_user_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'DRK Compliance Violation: Users cannot be deleted. Use is_locked=true instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_no_delete
  BEFORE DELETE ON "user"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_user_delete();
```

**2. Prisma Migration**

Create migration file: `packages/backend/prisma/migrations/{timestamp}_add_no_delete_triggers.sql`

**3. Integration Tests**

Test in `packages/backend/src/infrastructure/__tests__/no-delete-triggers.integration.spec.ts`:
```typescript
describe('NO-DELETE Triggers', () => {
  it('should prevent direct DELETE on einsatz table', async () => {
    // Given: Einsatz exists
    const einsatz = await prisma.einsatz.create({...});

    // When: Try to delete via Prisma
    await expect(
      prisma.einsatz.delete({ where: { id: einsatz.id } })
    ).rejects.toThrow('DRK Compliance Violation');

    // Then: Einsatz still exists
    const exists = await prisma.einsatz.findUnique({ where: { id: einsatz.id } });
    expect(exists).not.toBeNull();
  });

  it('should prevent direct SQL DELETE on etb_eintrag', async () => {
    // Given: ETB Eintrag exists
    const eintrag = await prisma.etbEintrag.create({...});

    // When: Try raw SQL DELETE
    await expect(
      prisma.$executeRaw`DELETE FROM etb_eintrag WHERE id = ${eintrag.id}`
    ).rejects.toThrow('DRK Compliance Violation');
  });

  it('should allow status=ARCHIVIERT for einsatz', async () => {
    // Given: Einsatz exists
    const einsatz = await prisma.einsatz.create({...});

    // When: Update status to ARCHIVIERT
    await prisma.einsatz.update({
      where: { id: einsatz.id },
      data: { status: 'ARCHIVIERT' }
    });

    // Then: Update succeeds
    const archived = await prisma.einsatz.findUnique({ where: { id: einsatz.id } });
    expect(archived.status).toBe('ARCHIVIERT');
  });

  it('should allow soft-delete (is_deleted=true) for etb_eintrag', async () => {
    // Given: ETB Eintrag exists
    const eintrag = await prisma.etbEintrag.create({...});

    // When: Soft-delete
    await prisma.etbEintrag.update({
      where: { id: eintrag.id },
      data: { isDeleted: true }
    });

    // Then: Soft-delete succeeds
    const softDeleted = await prisma.etbEintrag.findUnique({ where: { id: eintrag.id } });
    expect(softDeleted.isDeleted).toBe(true);
  });
});
```

**4. Documentation Update**

Add to `packages/backend/src/domain/README.md`:
```markdown
## DRK Compliance: NO-DELETE Policy

**Layer 1: Domain Layer**
- `canBeDeleted(): false` in Aggregates (Story 1.3, 1.4, 1.6)
- Application Layer respects domain rules

**Layer 2: Database Layer** ⭐ NEW
- PostgreSQL triggers prevent direct DELETE operations
- Enforced even if domain layer is bypassed (migrations, scripts, Prisma raw queries)

**Archival Strategy:**
- Einsatz: Use `status = ARCHIVIERT` (10-year retention, then eligible for archival)
- ETB Einträge: Use `is_deleted = true` (soft-delete, history preserved)
- Users: Use `is_locked = true` (account suspension)
- POIs: Remove via Aggregate method (business logic enforced)

**Testing:**
- Integration tests validate triggers: `no-delete-triggers.integration.spec.ts`
```

**And** the following exist:
- ✅ Migration file in `prisma/migrations/`
- ✅ Integration tests pass (4 test cases)
- ✅ README documents double-layer protection (Domain + Database)

**Prerequisites:**
- Story 1.3 (Einsatz Aggregate - Domain Layer NO-DELETE)
- Story 1.4 (ETB Aggregate - Soft-Delete)
- Story 1.6 (User Aggregate - Account Locking)
- Prisma schema with einsatz, etb_eintrag, poi, user tables

**Technical Notes:**
- **Defense in Depth:** Domain Layer + Database Layer protection (two independent safeguards)
- PostgreSQL triggers fire BEFORE DELETE (transaction-safe, no data loss)
- Error messages explicitly mention "DRK Compliance Violation" (clear audit trail)
- Triggers do NOT prevent UPDATE operations (status changes allowed)
- Integration tests use real database (not mocked) to validate trigger behavior
- Migration is idempotent (can be re-run safely via `CREATE OR REPLACE FUNCTION`)
- Triggers have zero performance impact (only fires on DELETE, which should never happen)

**Effort Estimate:** 2-3h
- 30min: Write triggers + migration
- 1h: Integration tests
- 30min: Documentation
- 30min: Review + validation

**Priority:** 🔴 CRITICAL (Blocker for Epic 4 - DRK Compliance requirement)

---
