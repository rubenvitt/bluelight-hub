# Bluelight Hub - Architecture Refactoring PRD

**Author:** Ruben
**Date:** 2025-11-11
**Version:** 1.0
**GitHub Issue:** #276

---

## Executive Summary

**BlueLight-Hub** erfordert eine fundamentale Architektur-Migration von der aktuellen 3-Tier-Architektur zu **Hexagonal
Architecture + Domain-Driven Design (DDD)**, um kritische Technical Debt zu beseitigen und das System wartbar, testbar
und zukunftssicher zu machen.

### Das Problem (Technical Debt)

Das System leidet unter:

- **Framework-Kopplung:** 37+ Dateien direkt an `@prisma/client` gekoppelt
- **Anemic Domain Model:** Business-Logic verstreut in Services statt in Domain-Objekten
- **God Services:** Services mit 5+ Responsibilities (SRP-Verletzung)
- **String-basierte Events:** Nicht typsicher, typo-anfällig
- **Leaky Abstractions:** Repository gibt Prisma-Typen zurück
- **Fehlende Transactional Outbox:** Event-Verlust bei Crashes möglich

**Konsequenz:** ORM-Wechsel würde 37+ Dateien betreffen, Tests sind framework-abhängig, Business-Logic schwer zu finden.

### Die Lösung (Hexagonal Architecture + DDD)

Migration zu Clean Architecture mit:

- **Rich Domain Model:** Business-Logic in Aggregates/Value Objects
- **Framework-Agnostisch:** Domain Layer ohne externe Dependencies
- **Ports & Adapters:** Klare Grenzen zwischen Layers
- **CQRS:** Commands/Queries statt God Services
- **Typisierte Events:** Type-safe Domain Events
- **Strangler Fig Pattern:** Schrittweise Migration (Lagekarte → ETB → Einsatz → Auth)

### What Makes This Special

**Die Magie dieses Refactorings:**

- **Zukunftssicher:** ORM-Wechsel = nur 5 Adapter-Dateien ändern (statt 37)
- **Testbar:** Domain-Tests ohne Framework (Pure TypeScript)
- **Wartbar:** Business-Logic zentral in Aggregates
- **Erweiterbar:** Neue Features = neue Use Cases, ohne bestehenden Code zu ändern
- **DRK-tauglich:** Compliance-Logik explizit in Domain-Objekten (10-year archival, no-delete policy)

---

## Project Classification

**Technical Type:** Architecture Refactoring (Strangler Fig Pattern)
**Domain:** Emergency Response Management (DRK)
**Complexity:** High (138-186h Aufwand Backend+Frontend, optional +12-16h Cleanup)
**Approach:** Incremental Migration (Breaking Changes erlaubt)
**Risk Level:** Medium (Strangler Fig minimiert Risiko, kein Prod-System)

**Brownfield Context:**

- Bestehendes System in aktiver Entwicklung (NICHT produktiv)
- Backend: NestJS + Prisma (3-Tier Architecture)
- Frontend: React + Vite + TanStack Query (API-Client generiert)
- Desktop: Tauri 2 Wrapper
- Compliance-Anforderungen (10-year archival, audit logging)
- Migration kann Breaking Changes haben (kein Prod-System)

---

## Success Criteria

### Business Success

- **Feature Parity:** Alle bestehenden Features funktionieren nach Migration
- **No Regressions:** Integration-Tests bleiben grün
- **Clean API:** OpenAPI-Spec bleibt konsistent (kann sich ändern, da Frontend migriert wird)
- **Type Safety:** Frontend + Backend durchgehend typsicher (generierter API-Client)

### Technical Success Metrics

| Metrik                              | Vorher                      | Nachher                   | Erfolg                    |
|-------------------------------------|-----------------------------|---------------------------|---------------------------|
| **Prisma-Imports**                  | 37 Dateien                  | ≤5 Dateien (nur Adapters) | ✅ 85% Reduktion           |
| **Service Responsibilities**        | 5+ pro Service              | 1 pro Handler             | ✅ SRP erfüllt             |
| **Domain Logic Locations**          | Verstreut (Services, Utils) | Zentral (Aggregates)      | ✅ Single Source of Truth  |
| **Event Type-Safety**               | 0% (Strings)                | 100% (Typisiert)          | ✅ Compile-Zeit Sicherheit |
| **Framework-Abhängigkeit (Domain)** | 100%                        | 0%                        | ✅ Pure TypeScript         |
| **Testbarkeit (Domain)**            | Framework nötig             | Kein Framework            | ✅ Unit-Test Speed +90%    |

### Qualitative Success Indicators

- **Developer Experience:** Neue Features schneller implementierbar
- **Onboarding:** Architektur-Intent erkennbar (Clean Architecture Layers)
- **Debugging:** Business-Logic-Fehler sofort im Aggregate findbar
- **Confidence:** ORM/Framework-Wechsel = kein Angstprojekt mehr

---

## Product Scope

### MVP Scope (Must-Have)

**Phase 1: Domain Layer (Backend) (Woche 1) - 42-56h**

- ✅ Aggregates: `EinsatzAggregate`, `EinsatztagebuchAggregate`, `LagekarteAggregate`, `UserAggregate`
- ✅ Value Objects: 15-20 VOs (Status, IDs, Koordinaten, Address mit Validierung)
- ✅ Domain Events: 15-20 typisierte Events (EinsatzCreated, EinsatzCompleted, etc.)
- ✅ Domain Services: 3-5 Services (Cross-Aggregate Logic)
- ✅ Repository Interfaces: 4 Ports (IEinsatzRepository, IEtbRepository, etc.)
- ✅ **Frontend:** Keine Änderungen (Backend-intern)

**Phase 2: Lagekarte Migration (Backend + Frontend) (Woche 2) - 30-40h**

**Backend (26-34h):**

- ✅ Commands/Handlers: CreateLagekarte, AddPoi
- ✅ Queries/Handlers: GetLagekarte, GetPois
- ✅ Adapters: PrismaLagekarteRepository, NominatimGeocodingAdapter
- ✅ Mappers: Domain ↔ Prisma (lagekarte, POI)
- ✅ Controller Refactoring (Thin Adapter)
- ✅ Integration-Tests grün

**Frontend (4-6h):**

- ✅ API-Client neu generieren (`pnpm run generate-api`)
- ✅ TanStack Query Hooks anpassen (falls API-Spec sich geändert hat)
- ✅ Type-Errors fixen (TypeScript Compiler)
- ✅ Frontend-Tests aktualisieren

**Phase 3: ETB Migration (Backend + Frontend) (Woche 3) - 30-40h**

**Backend (26-34h):**

- ✅ 7-10 Use Cases (Create, AddEintrag, Lock, UpdateEintrag)
- ✅ Event Handler: EinsatzCreated → Auto-Create ETB
- ✅ Versionierung-Logic in Aggregate
- ✅ PrismaEtbRepository + Mapper
- ✅ Controller Refactoring

**Frontend (4-6h):**

- ✅ API-Client neu generieren
- ✅ ETB-Komponenten anpassen (falls API-Changes)
- ✅ Type-Errors fixen
- ✅ Frontend-Tests aktualisieren

**Phase 4: Einsatz + Auth (Backend + Frontend) (Woche 4) - 36-50h**

**Backend (30-40h):**

- ✅ 10-15 Use Cases (Einsatz CRUD, Status Transitions, Archival)
- ✅ Event Publishing (EinsatzCreated, EinsatzCompleted, EinsatzArchived)
- ✅ Domain Services Integration (Naming, Completeness)
- ✅ PrismaEinsatzRepository + Mapper
- ✅ JWT Token Service Adapter
- ✅ PrismaUserRepository + Mapper
- ✅ **Transactional Outbox Pattern** (Event-Verlust verhindern - KRITISCH für Compliance)
    - Outbox Table Schema (eventId, aggregateId, eventType, payload, status, createdAt)
    - Polling Worker (CronJob alle 5s)
    - Event Status (PENDING → PUBLISHED → FAILED)
    - Retry-Logic (exponential backoff, max 3 Versuche)

**Frontend (6-10h):**

- ✅ API-Client neu generieren (Einsatz + Auth Endpoints)
- ✅ Einsatz-Komponenten anpassen
- ✅ Auth-Flow anpassen (falls JWT-Handling sich ändert)
- ✅ Type-Errors fixen
- ✅ Frontend-Tests aktualisieren
- ✅ E2E-Smoke-Tests (Einsatz CRUD Flow)

### Growth Features (Nice-to-Have)

**Phase 5: Optimization & Cleanup (Woche 5) - 12-16h**

- 🔄 Alte Services löschen (nach vollständiger Migration)
- 🔄 Unit-Tests für Domain Layer (kein Framework)
- 🔄 Performance-Benchmarks (vor/nach Vergleich)
- 🔄 Specification Pattern für komplexe Queries

### Vision (Future)

- **Event Sourcing:** Für Audit-Trail (statt Versionierung)
- **CQRS Read Models:** Optimierte Projektion für Queries
- **Multi-Tenant Architecture:** Für mehrere DRK-Organisationen
- **GraphQL Gateway:** Für Mobile App (Alternative zu REST)

---

## Functional Requirements (Architecture)

Diese Requirements definieren die **Ziel-Architektur** und Code-Struktur nach der Migration.

### FR-1: Domain Layer (Framework-Agnostisch)

**Requirement:** Domain Layer darf KEINE externen Dependencies haben (außer TypeScript Standard Library)

**Details:**

- **Aggregates:** Rich Domain Models mit Business-Logic
    - `EinsatzAggregate.complete()` - Status-Transition mit Validierung
    - `EinsatzAggregate.archive()` - **NO-DELETE Policy: Einsätze werden NIEMALS gelöscht, nur archiviert (
      DRK-Compliance)**
    - `EinsatzAggregate.canBeDeleted()` - **IMMER false** (Soft-Delete verboten, nur Status ARCHIVIERT)
    - `EinsatztagebuchAggregate.addEintrag()` - **Automatische Nummerierung (Sequence-Numbers)**
        - **Versionierung mit History-Snapshots:** Jede Änderung speichert vorherige Version
        - **Sequence-Numbers:** Fortlaufende Nummerierung (1, 2, 3, ...) - unveränderlich
        - **Immutability when locked:** Status LOCKED verhindert alle Änderungen
        - **Soft-Delete für Einträge:** Gelöschte Einträge bleiben in History sichtbar
        - **Textbausteine:** Templates für wiederkehrende Einträge (EtbTextbaustein)
    - `LagekarteAggregate.addPoi()` - **MGRS-Koordinaten (Primär-System)**
        - **MGRS als Primär:** Militärisch präzise (DRK-Standard)
        - **Lat/Lng als Fallback:** Für externe Systeme (Geocoding APIs)
        - **Transactional Atomic:** Lagekarte + initialer POI in einer DB-Transaktion
        - **Lazy Creation:** Lagekarte wird erst beim ersten Abruf erstellt
    - `UserAggregate.lock()` - **Account-Sperrung (RBAC)**
        - **3 Rollen:** SUPER_ADMIN, ADMIN, USER
        - **Unified Auth:** Passwordless für USER, Password für ADMIN/SUPER_ADMIN
        - **Min 1 SUPER_ADMIN Constraint:** System verhindert Löschen/Sperren des letzten SUPER_ADMIN
        - **Username eindeutig:** Validierung bei Erstellung

- **Value Objects:** Immutable, Self-Validating
    - `EinsatzStatus` - State Machine (ANGELEGT → IN_BEARBEITUNG → ABGESCHLOSSEN → ARCHIVIERT)
    - `EtbStatus` - State Machine (DRAFT → ACTIVE → LOCKED)
    - `EtbSequenceNumber` - Fortlaufende Nummer (immutable, auto-increment)
    - `EtbVersion` - Versionsnummer mit Timestamp
    - `MgrsCoordinate` - **Primär-Koordinatensystem** (Validierung + `toLatLng()` Konversion)
    - `GeoCoordinate` (Lat/Lng) - **Fallback-System** (`distanceTo(other)`, `toMgrs()` Konversion)
    - `UserId`, `EinsatzId`, `EtbId`, `EintragId` - Typed IDs (nicht `string`)
    - `Address` - PLZ-Validierung, Normalisierung

- **Domain Events:** Typisiert, Immutable
  ```typescript
  class EinsatzCreatedEvent extends DomainEvent {
    constructor(
      public readonly einsatzId: EinsatzId,
      public readonly createdBy: UserId,
      public readonly alarmstichwort: string
    ) {}
  }
  ```

- **Repository Interfaces (Ports):** In Domain definiert, in Infrastructure implementiert
  ```typescript
  interface IEinsatzRepository {
    save(aggregate: EinsatzAggregate): Promise<void>;
    findById(id: EinsatzId): Promise<EinsatzAggregate | null>;
    findActive(): Promise<EinsatzAggregate[]>;
  }
  ```

- **Business-Rules (DRK-Compliance):**
    - **NO-DELETE Policy:** Einsätze dürfen NIEMALS physisch gelöscht werden (10-year archival requirement)
    - **Nur Archivierung:** Status-Transition zu `ARCHIVIERT` (reversibel), kein DELETE
    - **Soft-Delete verboten:** Auch gelöschte Einträge müssen revisionssicher bleiben
    - **Audit Trail:** Alle Status-Änderungen werden protokolliert (via Domain Events)
    - **RBAC:** 3 Rollen (SUPER_ADMIN, ADMIN, USER) - Min 1 SUPER_ADMIN immer vorhanden

**Acceptance Criteria:**

- [ ] `pnpm --filter @bluelight-hub/domain build` funktioniert OHNE Prisma/NestJS
- [ ] Domain Layer hat 0 externe Dependencies (außer TS stdlib)
- [ ] Business-Logic-Tests ohne Framework-Mock

---

### FR-2: Application Layer (Use Cases)

**Requirement:** Use Cases orchestrieren Domain Objects, KEIN direktes Prisma

**Details:**

- **Commands:** Write-Operations
    - `CreateEinsatzCommand` → `CreateEinsatzHandler`
    - `CompleteEinsatzCommand` → `CompleteEinsatzHandler`
    - `ArchiveEinsatzCommand` → `ArchiveEinsatzHandler`
    - `AddEtbEintragCommand` → `AddEtbEintragHandler`
    - `AddPoiCommand` → `AddPoiHandler`

- **Queries:** Read-Operations (dünn, direkt Prisma OK für Queries)
    - `GetActiveEinsaetzeQuery` → `GetActiveEinsaetzeHandler`
    - `GetEtbQuery` → `GetEtbHandler`
    - `GetLagekarteQuery` → `GetLagekarteHandler`

- **Single Responsibility:** 1 Handler = 1 Use Case
  ```typescript
  class CompleteEinsatzHandler {
    async execute(command: CompleteEinsatzCommand): Promise<Result<void>> {
      const aggregate = await this.repository.findById(command.einsatzId);
      aggregate.complete(command.completedBy); // Business-Logic im Aggregate!
      await this.repository.save(aggregate);
      await this.eventPublisher.publishAll(aggregate.getUncommittedEvents());
    }
  }
  ```

**Acceptance Criteria:**

- [ ] Kein Handler hat mehr als 1 Responsibility
- [ ] Alle Schreib-Operationen gehen durch Commands
- [ ] Event Publishing nach Domain-Änderungen

---

### FR-3: Infrastructure Layer (Adapters)

**Requirement:** Alle Framework-Dependencies isoliert in Infrastructure

**Details:**

- **Persistence Adapters:**
    - `PrismaEinsatzRepository implements IEinsatzRepository`
    - `PrismaEtbRepository implements IEtbRepository`
    - `PrismaLagekarteRepository implements ILagekarteRepository`
    - `PrismaUserRepository implements IUserRepository`

- **Mappers:** Domain ↔ Prisma Transformation
  ```typescript
  class PrismaEinsatzMapper {
    static toDomain(prisma: PrismaEinsatz): EinsatzAggregate { ... }
    static toPersistence(aggregate: EinsatzAggregate): PrismaEinsatzCreateInput { ... }
  }
  ```

- **External Service Adapters:**
    - `NominatimGeocodingAdapter implements IGeocodingPort`
    - `JwtTokenServiceAdapter implements ITokenServicePort`

- **HTTP Controllers:** Thin Adapter (nur Request/Response Mapping)
  ```typescript
  @Controller('einsatz')
  class EinsatzController {
    @Post()
    async create(@Body() dto: CreateEinsatzDto) {
      const command = new CreateEinsatzCommand(dto.alarmstichwort, ...);
      await this.commandBus.execute(command);
    }
  }
  ```

**Acceptance Criteria:**

- [ ] Prisma-Imports NUR in Infrastructure Layer
- [ ] Mapper-Tests für alle Aggregates
- [ ] Controller haben max. 20 Zeilen pro Methode

---

### FR-4: Event System (Type-Safe)

**Requirement:** Domain Events typisiert, keine Magic Strings

**Vorher (❌):**

```typescript
this.eventEmitter.emit('einsatz.created', {id: '123'});
@OnEvent('einsatz.created') // Typo-anfällig!
```

**Nachher (✅):**

```typescript
class EinsatzCreatedEvent extends DomainEvent {
    constructor(
        public readonly einsatzId: EinsatzId,
        public readonly createdBy: UserId
    ) {
    }
}

this.eventPublisher.publish(new EinsatzCreatedEvent(einsatzId, userId));

@OnEvent(EinsatzCreatedEvent)
async
handle(event
:
EinsatzCreatedEvent
)
{ ...
}
```

**Acceptance Criteria:**

- [ ] Alle Domain Events als Klassen
- [ ] TypeScript-Compiler erkennt Event-Name-Typos
- [ ] Event-Handler typsicher (Autocomplete)

---

### FR-5: Dependency Inversion

**Requirement:** Domain definiert Interfaces, Infrastructure implementiert

**Module Structure:**

```
packages/backend/src/
├── domain/           # Keine Dependencies auf andere Layer!
│   ├── aggregates/
│   ├── value-objects/
│   ├── events/
│   └── repositories/    # INTERFACES (Ports)
│       └── ieinsatz.repository.ts
├── application/      # Abhängig von Domain
│   ├── commands/
│   ├── queries/
│   └── ports/
└── infrastructure/   # Abhängig von Domain + Application
    ├── persistence/
    │   └── prisma/
    │       ├── adapters/
    │       │   └── prisma-einsatz.repository.ts  # implementiert IEinsatzRepository
    │       └── mappers/
    ├── http/
    │   └── controllers/
    └── external/
        └── nominatim/
```

**Dependency Flow:** Infrastructure → Application → Domain (NEVER umgekehrt!)

**Acceptance Criteria:**

- [ ] Domain importiert NICHTS aus Application/Infrastructure
- [ ] Application importiert NICHTS aus Infrastructure
- [ ] Circular Dependencies = 0

---

## Non-Functional Requirements

### NFR-1: Maintainability (Kritisch!)

**Requirement:** Code muss lesbar, änderbar und erweiterbar sein

**Metriken:**

- **Cyclomatic Complexity:** Max. 10 pro Methode
- **Class Responsibilities:** Max. 1 Responsibility (SRP)
- **Code Duplication:** <3% (DRY)
- **Business-Logic Location:** 100% in Domain Layer

**Impact:**

- **Vorher:** Neue Feature = 5-10 Dateien ändern (Services, Utils, Repository)
- **Nachher:** Neue Feature = neuer Use Case + neues Aggregate

**Acceptance Criteria:**

- [ ] SonarQube Maintainability Rating: A
- [ ] Keine God Classes (>500 Zeilen)
- [ ] Business-Logic zu 100% in Domain Layer

---

### NFR-2: Testability

**Requirement:** Domain-Tests ohne Framework, schnell, isoliert

**Metriken:**

- **Domain Test Coverage:** >80%
- **Unit Test Speed:** <1s für 100 Tests
- **Integration Test Coverage:** >60%
- **Framework Mocks in Domain Tests:** 0

**Beispiel:**

```typescript
// ✅ Pure Domain Test (kein NestJS, kein Prisma)
describe('EinsatzAggregate', () => {
    it('should transition to ABGESCHLOSSEN when complete()', () => {
        const einsatz = EinsatzAggregate.create({status: EinsatzStatus.IN_BEARBEITUNG});
        einsatz.complete(new UserId('user-1'));
        expect(einsatz.status.value).toBe('ABGESCHLOSSEN');
        expect(einsatz.getUncommittedEvents()).toContainEqual(
            expect.any(EinsatzCompletedEvent)
        );
    });
});
```

**Acceptance Criteria:**

- [ ] Domain-Tests ohne `@nestjs/testing`
- [ ] 100+ Domain-Tests in <1s
- [ ] Aggregate-Tests decken alle Business-Rules ab

---

### NFR-3: Framework Independence

**Requirement:** ORM/Framework-Wechsel = nur Infrastructure-Änderungen

**Metriken:**

- **Prisma-Imports:** Max. 5 Dateien (nur Adapters)
- **NestJS-Decorators in Domain:** 0
- **Domain Dependencies:** 0 (außer TS stdlib)

**Wechsel-Szenario:** Prisma → TypeORM

- **Vorher:** 37+ Dateien ändern
- **Nachher:** 5 Adapter-Dateien + 4 Mapper ändern

**Acceptance Criteria:**

- [ ] Domain kompiliert ohne Framework-Dependencies
- [ ] Mock-Repository in <50 Zeilen implementierbar
- [ ] Integration-Tests mit In-Memory-Repository

---

### NFR-4: Performance

**Requirement:** Keine Performance-Regression durch Refactoring

**Metriken:**

- **API Response Time:** <200ms (p95) - unverändert
- **Database Queries:** Keine zusätzlichen Queries durch Mapper
- **Memory Footprint:** +5% max. (Aggregate-Objekte)

**Optimization:**

- **Lazy Loading:** Aggregates laden nur nötige Relationen
- **Query Optimization:** CQRS-Queries direkt Prisma (kein Aggregate)
- **Caching:** Unverändertes Caching-Verhalten

**Acceptance Criteria:**

- [ ] API Benchmarks: ±5% von Baseline
- [ ] Keine N+1-Queries durch Mapper
- [ ] Memory Profiling: <10% Increase

---

### NFR-5: Migration Safety

**Requirement:** Strangler Fig Pattern - kein Big Bang

**Strategie:**

- **Parallel Betrieb:** Alte Services + neue Handlers koexistieren
- **Feature Flags:** Schrittweises Umschalten pro Context
- **Rollback:** Einfaches Zurückschalten auf alte Services

**Phasen:**

1. **Domain Layer:** Parallel aufbauen (keine Änderung am Code)
2. **Lagekarte:** Controller auf Handler umstellen (Rollback möglich)
3. **ETB:** Controller umstellen
4. **Einsatz:** Controller umstellen
5. **Cleanup:** Alte Services löschen

**Acceptance Criteria:**

- [ ] Jede Phase einzeln rollbar
- [ ] Integration-Tests grün nach jeder Phase
- [ ] Breaking Changes erlaubt (kein Prod-System, aber Migration sollte trotzdem inkrementell sein)

---

### NFR-6: Developer Experience

**Requirement:** Architektur-Intent erkennbar, Onboarding schnell

**Features:**

- **Self-Documenting Code:** Layers klar getrennt (Domain/Application/Infrastructure)
- **README pro Layer:** Erklärt Pattern und Conventions
- **Code-Beispiele:** Template für neuen Use Case
- **ADRs:** Architecture Decision Records für Patterns

**Onboarding-Zeit:**

- **Vorher:** 2-3 Tage bis Developer Code-Struktur versteht
- **Nachher:** <1 Tag (Clean Architecture Standard)

**Acceptance Criteria:**

- [ ] README.md für jeden Layer
- [ ] ADR für Hexagonal Architecture
- [ ] Template: "Neuen Use Case hinzufügen"
- [ ] Linter-Rules für Dependency-Richtung

---

## Implementation Strategy: Strangler Fig Pattern

**Kern-Prinzip:** Neues System wächst um altes System herum, bis es komplett ersetzt ist.

### Warum Strangler Fig?

**Vorteile:**

- ✅ Kein Big Bang (Risiko minimiert)
- ✅ Jede Phase einzeln testbar
- ✅ Rollback jederzeit möglich
- ✅ Produktionssystem bleibt online
- ✅ Paralleles Arbeiten an altem + neuem System

**Alternative (verworfen):** Big Bang Migration

- ❌ Hohes Risiko (150h Code ändern = hohe Fehlerrate)
- ❌ Merge-Konflikte bei parallel laufender Feature-Entwicklung
- ❌ Kein Rollback (all-or-nothing)

---

### Phase 1: Domain Layer aufbauen (Woche 1) - 42-56h

**Strategie:** Paralleles Aufbauen OHNE bestehenden Code zu ändern

**Tasks:**

1. **Package-Struktur erstellen** (2h)
   ```
   packages/backend/src/
   ├── domain/
   │   ├── aggregates/
   │   ├── value-objects/
   │   ├── events/
   │   ├── services/
   │   └── repositories/
   └── (bestehender Code unberührt)
   ```

2. **Base Classes** (4h)
    - `AggregateRoot` - Event-Handling
    - `DomainEvent` - Base Event Class
    - `ValueObject` - Equality + Immutability
    - `Result<T>` - Railway Oriented Programming
    - `EntityId` - Typed ID Base Class

3. **Einsatz Domain Objects** (12-14h)
    - `EinsatzAggregate` - Complete, Archive, UpdateStatus
    - `EinsatzStatus` VO - State Machine
    - `EinsatzId` VO
    - `EinsatzCreatedEvent`, `EinsatzCompletedEvent`, `EinsatzArchivedEvent`
    - `IEinsatzRepository` Interface

4. **ETB Domain Objects** (8-10h)
    - `EinsatztagebuchAggregate` - AddEintrag, Lock, UpdateEintrag
    - `EtbEintrag` Entity
    - `EtbId`, `EintragId` VOs
    - `EtbEintragAddedEvent`, `EtbLockedEvent`
    - `IEtbRepository` Interface

5. **Lagekarte Domain Objects** (6-8h)
    - `LagekarteAggregate` - AddPoi, RemovePoi
    - `Poi` Entity
    - `MgrsCoordinate`, `GeoCoordinate` VOs
    - `LagekarteId`, `PoiId` VOs
    - `PoiAddedEvent`
    - `ILagekarteRepository` Interface

6. **User Domain Objects** (4-6h)
    - `UserAggregate` - Lock, Unlock, UpdatePassword
    - `UserId`, `Username` VOs
    - `UserLockedEvent`
    - `IUserRepository` Interface

7. **Domain Services** (6-8h)
    - `EinsatzNamingService` - Cross-Aggregate Naming Logic
    - `EinsatzCompletenessService` - Validation
    - `AddressGeocodingService` - Interface (Port)

**Deliverable:**

- ✅ Domain Layer kompiliert isoliert (`pnpm --filter domain build`)
- ✅ 50+ Unit-Tests (kein Framework)
- ✅ KEINE Änderung an bestehendem Code

**Rollback:** Domain-Ordner löschen (keine Auswirkung auf Prod)

---

### Phase 2: Lagekarte migrieren (Backend + Frontend) (Woche 2) - 30-40h

**Warum Lagekarte zuerst?**

- ✅ Kleinster Bounded Context (4 Modelle)
- ✅ Isoliert (keine kritischen Dependencies)
- ✅ Geringes Risiko (nicht-kritisch für Einsatzablauf)

**Backend Tasks (26-34h):**

1. **Application Layer** (8-10h)
    - Commands: `CreateLagekarteCommand`, `AddPoiCommand`, `RemovePoiCommand`
    - Handlers: `CreateLagekarteHandler`, `AddPoiHandler`, `RemovePoiHandler`
    - Queries: `GetLagekarteQuery`, `GetPoisQuery`
    - Query Handlers: `GetLagekarteHandler`, `GetPoisHandler`

2. **Infrastructure Layer** (10-12h)
    - `PrismaLagekarteRepository implements ILagekarteRepository`
    - `PrismaLagekarteMapper` - Domain ↔ Prisma
    - `NominatimGeocodingAdapter implements IGeocodingPort`
    - Event Publisher Integration

3. **Controller Refactoring** (4-6h)
    - `LagekarteController` - Von Service auf CommandBus/QueryBus
    - DTOs → Commands/Queries Mapping
    - OpenAPI-Spec kann sich ändern (Frontend wird migriert)

4. **Testing** (4-6h)
    - Integration-Tests: API-Funktionalität validiert
    - Domain-Tests: Aggregate Business-Rules
    - Mapper-Tests: Bidirektionale Konversion

**Frontend Tasks (4-6h):**

1. **API-Client Regeneration** (1h)
    - `pnpm run generate-api` nach Backend-Änderungen
    - Neue TypeScript-Types prüfen

2. **Component Updates** (2-3h)
    - Lagekarte-Komponenten anpassen (falls API sich geändert hat)
    - TanStack Query Hooks aktualisieren
    - Type-Errors fixen (TypeScript Compiler)

3. **Testing** (1-2h)
    - Frontend-Tests aktualisieren
    - Manual QA: Lagekarte CRUD Flow

**Rollback-Plan:**

```typescript
// Backend: Controller wieder auf alten Service umstellen
@Post()
async
create(@Body()
dto: CreateLagekarteDto
)
{
    // return await this.commandBus.execute(new CreateLagekarteCommand(...)); // NEU
    return await this.lagekarteService.create(dto); // ROLLBACK
}

// Frontend: Git revert auf alten API-Client
git
checkout
HEAD
~1
packages / shared / client / apis /
```

**Deliverable:**

- ✅ Lagekarte komplett auf neue Architektur (Backend + Frontend)
- ✅ Integration-Tests grün
- ✅ Frontend funktioniert mit neuer API

---

### Phase 3: ETB migrieren (Woche 3) - 26-34h

**Tasks:**

1. **Application Layer** (10-12h)
    - 7-10 Commands/Handlers
    - Event-Handler: `EinsatzCreatedEvent` → Auto-Create ETB
    - Queries für ETB + Einträge

2. **Infrastructure Layer** (10-12h)
    - `PrismaEtbRepository`
    - `PrismaEtbMapper` (inkl. Historie-Handling)
    - Versionierung-Logic

3. **Controller + Tests** (6-10h)

**Deliverable:**

- ✅ ETB auf neue Architektur
- ✅ Versionierung funktioniert

---

### Phase 4: Einsatz + Auth migrieren (Woche 4) - 30-40h

**Einsatz (24-32h):**

1. **Application Layer** (12-16h)
    - 10-15 Commands/Handlers
    - Domain Events Publishing
    - Query Handlers

2. **Infrastructure Layer** (8-12h)
    - `PrismaEinsatzRepository`
    - `PrismaEinsatzMapper`
    - Event-Handler für ETB/Lagekarte Auto-Create

3. **Controller + Tests** (4-4h)

**Auth (6-8h):**

1. **Application Layer** (3-4h)
    - Login/Logout Commands
    - Token Service Port

2. **Infrastructure** (3-4h)
    - `JwtTokenServiceAdapter`
    - `PrismaUserRepository`

---

### Phase 5: Cleanup & Optimization (Optional, Woche 5) - 12-16h

1. **Alte Services löschen** (4-6h)
    - `EinsatzService` → Deleted
    - `EtbService` → Deleted
    - `LagekarteService` → Deleted
    - Repository-Cleanup

2. **Tests migrieren** (4-6h)
    - Service-Tests → Handler-Tests

3. **Performance-Optimierung** (4-4h)
    - Benchmarking
    - Lazy Loading
    - Optional: Transactional Outbox Pattern

---

## Risk Management

### Risiko 1: Performance-Regression

**Likelihood:** Medium | **Impact:** High

**Mitigation:**

- ✅ Benchmarks vor/nach Migration
- ✅ CQRS: Queries direkt Prisma (kein Aggregate-Overhead)
- ✅ Lazy Loading für Relations
- ✅ Profiling nach jeder Phase

**Rollback:** Controller auf alten Service zurück

---

### Risiko 2: Mapper-Fehler (Datenverlust)

**Likelihood:** Low | **Impact:** Critical

**Mitigation:**

- ✅ Mapper-Tests mit realen Produktionsdaten (anonymisiert)
- ✅ Bidirektionale Tests (Domain → Prisma → Domain)
- ✅ Integration-Tests mit Datenbank
- ✅ Checksum-Validierung für kritische Felder

**Detection:** Automated Tests + Manual QA

---

### Risiko 3: Event-Verlust (MITIGIERT in Phase 4)

**Likelihood:** Low (nach Outbox-Implementierung) | **Impact:** Critical

**Mitigation:**

- ✅ **Transactional Outbox Pattern** (Phase 4 - PFLICHT, nicht optional)
- ✅ Events in Outbox-Table schreiben (innerhalb DB-Transaktion)
- ✅ Polling Worker published Events asynchron
- ✅ Retry-Mechanismus mit exponential backoff
- ✅ Event-Monitoring (Failed Events alarmieren)

**Acceptance:** NICHT mehr akzeptabel - Outbox ist Pflicht für Go-Live

---

### Risiko 4: Circular Dependencies

**Likelihood:** Medium | **Impact:** Medium

**Mitigation:**

- ✅ ESLint Rule: `no-restricted-imports`
  ```json
  {
    "no-restricted-imports": ["error", {
      "patterns": [{
        "group": ["**/infrastructure/**"],
        "message": "Domain/Application dürfen nicht Infrastructure importieren"
      }]
    }]
  }
  ```
- ✅ CI: `madge --circular src/` (Detect Cycles)
- ✅ Code Review: Dependency-Richtung checken

---

### Risiko 5: Scope Creep

**Likelihood:** High | **Impact:** Medium

**Mitigation:**

- ✅ Strangler Fig: Nicht alte Services verbessern (nur ersetzen)
- ✅ Feature Freeze während Migration
- ✅ Timeboxing: Jede Phase max. 1 Woche

**Detection:** Wöchentliches Review

---

## References

### Dokumentation

- **GitHub Issue:** #276 - Architektur-Migration
- **Detaillierte Analyse:** `.bmad-ephemeral/hexagonal-migration-analysis.md` (25.000 Wörter)
- **Projekt-Dokumentation:** `docs/project-overview/index.md`
- **Bestehende Architektur:** `docs/architecture/index.md` (arc42)

### Architecture Decision Records (ADRs)

- ADR-001: Hexagonal Architecture + DDD (zu erstellen)
- ADR-002: Strangler Fig Pattern (zu erstellen)
- ADR-003: CQRS für Commands/Queries (zu erstellen)
- ADR-004: Typed Domain Events (zu erstellen)

### External Resources

- **Hexagonal Architecture:** Alistair Cockburn (2005)
- **Domain-Driven Design:** Eric Evans "Blue Book"
- **Strangler Fig Pattern:** Martin Fowler
- **CQRS:** Greg Young

---

## Next Steps

### 1. Review & Approval (Diese Woche)

- [ ] PRD Review mit Stakeholdern
- [ ] Go/No-Go Decision
- [ ] Zeitplan final abstimmen

### 2. PRD → Epics & Stories (Nach Approval)

- [ ] Workflow `create-epics-and-stories` ausführen
- [ ] PRD in implementierbare Stories zerlegen
- [ ] Story-Estimation (Phase 1-5)

### 3. Architecture Documentation (Vor Phase 1)

- [ ] ADR-001: Hexagonal Architecture schreiben
- [ ] README.md für Domain Layer (Conventions)
- [ ] Template: "Neuen Use Case hinzufügen"

### 4. Phase 1 starten (Woche 1)

- [ ] Domain Layer Package-Struktur
- [ ] Base Classes implementieren
- [ ] Aggregates implementieren (Einsatz, ETB, Lagekarte, User)

### 5. Parallel: Monitoring & Alerting Setup

- [ ] Performance-Baseline erstellen
- [ ] Event-Publishing Monitoring
- [ ] Error-Tracking für Mapper

---

## Implementation Planning

**PRD → Architecture → Epics → Stories → Implementation**

Nach PRD-Approval:

1. **Architecture Phase:**
    - ADRs schreiben
    - Layer-READMEs
    - Linter-Rules definieren

2. **Epic Breakdown:**
    - Epic 1: Domain Layer Foundation
    - Epic 2: Lagekarte Migration
    - Epic 3: ETB Migration
    - Epic 4: Einsatz + Auth Migration
    - Epic 5: Cleanup & Optimization

3. **Sprint Planning:**
    - Workflow: `sprint-planning`
    - Stories aus Epics extrahieren
    - Timeboxing: 1 Woche pro Phase

---

_Dieses PRD definiert die Transformation von BlueLight-Hub zu einer wartbaren, testbaren und zukunftssicheren
Architektur. Die Migration erfolgt schrittweise (Strangler Fig Pattern) ohne Produktionsausfälle._

_Erstellt durch kollaborative Discovery zwischen Ruben und PM Agent (BMad Enterprise Method)._
