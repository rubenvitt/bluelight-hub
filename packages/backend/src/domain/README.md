# Domain Layer - Bluelight Hub Backend

**Status:** In Migration (Hexagonal Architecture + DDD)
**Created:** 2025-01-13
**Architecture:** Hexagonal Architecture / Domain-Driven Design

---

## 📖 Inhaltsverzeichnis

1. [Hexagonal Architecture Principles](#hexagonal-architecture-principles)
2. [Layer Responsibilities](#layer-responsibilities)
3. [DRK Compliance: NO-DELETE Policy (Double-Layer Protection)](#-drk-compliance-no-delete-policy-double-layer-protection)
4. [Base Classes](#base-classes)
5. [Coding Conventions](#coding-conventions)
   - [Einsatztagebuch (ETB) Aggregate](#2-einsatztagebuch-etb-aggregate---spezialfall-versioning--soft-delete)
   - [LagekarteAggregate (Lagekarte + POI Management)](#3-lagekarteaggregate-lagekarte--poi-management)
   - [UserAggregate (RBAC User Management)](#4-useraggregate-rbac-user-management)
5. [Versioning Pattern (ETB Aggregate)](#-versioning-pattern-etb-aggregate)
6. [Example - How to create a new Aggregate](#-example---how-to-create-a-new-aggregate)
7. [ETB Aggregate - Code Examples](#-etb-aggregate---code-examples)
8. [Dependency Rules](#-dependency-rules)

---

## 🏛️ Hexagonal Architecture Principles

### Was ist der Domain Layer?

Der **Domain Layer** ist das Herzstück der Anwendung und enthält die **gesamte Business-Logik** des Bluelight Hub
Einsatzmanagement-Systems. Er ist **framework-agnostisch** und hat KEINE Abhängigkeiten zu NestJS, Prisma oder
anderen External Libraries.

**Kernprinzipien:**

1. **Framework Independence**
   Der Domain Layer nutzt AUSSCHLIESSLICH TypeScript Standard Library. Keine `@nestjs/*`, `@prisma/*` oder andere
   Framework-Imports erlaubt.

2. **Dependency Inversion (Ports & Adapters)**
   Der Domain Layer definiert **Interfaces (Ports)** für externe Abhängigkeiten (z.B. `IEinsatzRepository`).
   Die **Infrastructure Layer** liefert **Adapter** (z.B. `PrismaEinsatzRepository` implementiert `IEinsatzRepository`).

3. **Explicit Business Rules**
   Business-Logik wird in **Aggregates**, **Value Objects** und **Domain Services** gekapselt, NICHT in Controllern
   oder DTOs.

**Warum Hexagonal Architecture?**

Die bisherige 3-Tier-Architektur hatte kritische Probleme:
- 37+ Prisma-Imports in Business-Logik (tight coupling)
- ORM-Wechsel würde Ripple-Effekte auslösen
- Business-Regeln verstreut in Services, Controllers und DTOs
- Schwierige Testbarkeit (NestJS Test-Infrastruktur erforderlich)

Hexagonal Architecture löst diese Probleme durch klare Separation:

```
┌─────────────────────────────────────────────────┐
│          Infrastructure Layer                   │
│   (NestJS Controllers, Prisma Repositories)     │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │       Application Layer                  │   │
│  │  (Use Cases, Command/Query Handlers)     │   │
│  │                                           │   │
│  │  ┌────────────────────────────────────┐  │   │
│  │  │      Domain Layer (CORE)           │  │   │
│  │  │  - Aggregates (Einsatz, ETB)       │  │   │
│  │  │  - Value Objects (EinsatzId, ...)  │  │   │
│  │  │  - Domain Events                   │  │   │
│  │  │  - Repository Interfaces (Ports)   │  │   │
│  │  └────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**Dependency Direction:** Infrastructure → Application → Domain (NIEMALS umgekehrt!)

---

## 🔧 Layer Responsibilities

### Domain Layer (packages/backend/src/domain/)

**Was gehört in den Domain Layer?**

| Artefakt Type | Verantwortung | Beispiel |
|---------------|---------------|----------|
| **Aggregates** | Transaktionale Konsistenz-Grenzen, Business-Logik, Event-Emission | `Einsatz`, `EinsatztagebuchAggregate`, `Lagekarte` |
| **Entities** | Business-Objekte mit Identität (Teil eines Aggregates) | `ETBEintrag` (gehört zu `EinsatzTagebuch` Aggregate) |
| **Value Objects** | Immutable, self-validating Werte | `EinsatzId`, `EinsatzStatus`, `Coordinates` |
| **Domain Events** | Fachliche Events bei Zustandsänderungen | `EinsatzCreatedEvent`, `ETBEintragAddedEvent` |
| **Repository Interfaces** | Ports für Persistence (KEINE Implementierung!) | `IEinsatzRepository`, `ILagekarteRepository` |
| **Domain Services** | Cross-Aggregate Business-Logik | `EinsatzNamingService` (generiert Einsatz-Namen) |

**Was gehört NICHT in den Domain Layer?**
- ❌ NestJS Decorators (`@Injectable()`, `@Controller()`)
- ❌ Prisma Models (`PrismaClient`, `@prisma/client`)
- ❌ DTOs (API-Layer Contracts)
- ❌ HTTP/REST Logik
- ❌ Database Queries

### Application Layer (packages/backend/src/application/)

**Orchestriert Use Cases und koordiniert Domain Objects:**

- **Use Cases / Command Handlers**
  Beispiel: `CreateEinsatzCommand` → `CreateEinsatzHandler` (nutzt `IEinsatzRepository` Port)

- **Query Handlers**
  Beispiel: `GetEinsatzByIdQuery` → `GetEinsatzByIdHandler`

- **DTOs (Data Transfer Objects)**
  Beispiel: `CreateEinsatzDto` (API Input), `EinsatzResponseDto` (API Output)

- **Application Services**
  Beispiel: `EinsatzApplicationService` (orchestriert Use Cases)

**Dependency:** Application Layer DARF Domain Layer importieren, aber NICHT umgekehrt!

### Infrastructure Layer (packages/backend/src/infrastructure/)

**Liefert Adapter für External Systems:**

- **Repositories (Adapter für Persistence)**
  Beispiel: `PrismaEinsatzRepository` implementiert `IEinsatzRepository` (Domain Port)

- **Controllers (REST API Endpoints)**
  Beispiel: `EinsatzController` (NestJS `@Controller()`, ruft Application Services auf)

- **Mappers (Domain ↔ Prisma)**
  Beispiel: `EinsatzMapper.toDomain(prismaEinsatz)`, `EinsatzMapper.toPrisma(einsatz)`

- **External Adapters**
  Beispiel: Email-Service, File-Storage, External APIs

**Dependency:** Infrastructure Layer DARF Application + Domain importieren.

---

## 🔒 DRK Compliance: NO-DELETE Policy (Double-Layer Protection)

Bluelight Hub implementiert eine **zweischichtige NO-DELETE Strategie** zur Einhaltung der DRK 10-Jahres-Aufbewahrungspflicht für Einsatzdokumente. Beide Schutzschichten arbeiten unabhängig voneinander und bieten **Defense in Depth**.

### Layer 1: Domain Layer (Story 1.3, 1.4, 1.6)

Die **erste Schutzschicht** ist in der Business-Logik der Domain Aggregates verankert:

- **Aggregates:** `canBeDeleted(): boolean` gibt IMMER `false` zurück
- **Application Layer:** Respektiert Domain-Regeln via `Result<T>` Pattern
- **Beispiel:** `EinsatzAggregate.canBeDeleted()` verhindert versehentliche Löschungen in der Business-Logik

```typescript
// Domain Layer Schutz (Story 1.3)
class EinsatzAggregate extends AggregateRoot<EinsatzId> {
  canBeDeleted(): boolean {
    return false; // ❌ Einsätze dürfen NIEMALS gelöscht werden (DRK Compliance)
  }
}
```

**Stories mit Domain-Layer-Schutz:**
- [Story 1.3](../../../../.bmad-ephemeral/stories/1-3-einsatz-aggregate-value-objects.md) - Einsatz Aggregate: `canBeDeleted()` immer `false`
- [Story 1.4](../../../../.bmad-ephemeral/stories/1-4-einsatztagebuch-etb-aggregate-with-versioning.md) - ETB Soft-Delete: `is_deleted` Flag statt physischer Löschung
- [Story 1.6](../../../../.bmad-ephemeral/stories/1-6-user-aggregate-rbac-value-objects.md) - User Account Locking: `is_locked` Flag für Sperrungen

### Layer 2: Database Layer (Story 1.8) ⭐ NEW

Die **zweite Schutzschicht** sind PostgreSQL BEFORE DELETE Triggers, die physische DELETE Operations auf Datenbank-Ebene blockieren:

- **PostgreSQL Triggers:** Verhindern direkte DELETE Operations
- **Enforcement:** Greift AUCH wenn Domain Layer umgangen wird (Migrations, Admin Scripts, Raw SQL)
- **Protected Tables:** `einsaetze`, `etb_eintraege`, `lagekarte_poi`, `User`

```sql
-- PostgreSQL Trigger Beispiel (Story 1.8 Task 1)
CREATE OR REPLACE FUNCTION prevent_einsatz_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'DRK Compliance Violation: Einsatz cannot be deleted. Use status=ARCHIVIERT instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER einsatz_no_delete
  BEFORE DELETE ON einsaetze
  FOR EACH ROW
  EXECUTE FUNCTION prevent_einsatz_delete();
```

**Migration:** [`20251118081643_add_no_delete_triggers`](../../prisma/migrations/20251118081643_add_no_delete_triggers/migration.sql)

### Archival Strategy (Alternativen zu DELETE)

Statt physischer Löschung nutzt Bluelight Hub diese Archivierungs-Strategien:

| Entity | Alternative Action | Implementierung | Story |
|--------|-------------------|----------------|-------|
| **Einsatz** | `status = ARCHIVIERT` setzen | 10-Jahres-Aufbewahrung, dann Archivierung | [Story 1.7](../../../../.bmad-ephemeral/stories/1-7-domain-services-for-cross-aggregate-logic.md) |
| **ETB Eintrag** | `is_deleted = true` setzen | Soft-Delete, Historie bleibt erhalten | [Story 1.4](../../../../.bmad-ephemeral/stories/1-4-einsatztagebuch-etb-aggregate-with-versioning.md) |
| **User** | `is_locked = true` setzen | Account-Sperrung (reversibel) | [Story 1.6](../../../../.bmad-ephemeral/stories/1-6-user-aggregate-rbac-value-objects.md) |
| **POI** | Removal via Aggregate Methode | Business-Logik-kontrolliert | [Story 1.5](../../../../.bmad-ephemeral/stories/1-5-lagekarte-aggregate-with-mgrs-coordinates.md) |

**Beispiel - Einsatz Archivierung:**
```typescript
// ✅ RICHTIG: Einsatz archivieren (UPDATE statt DELETE)
const userId = UserId.create().getValue();
const archiveResult = einsatz.archive(userId); // Setzt status = ARCHIVIERT

// ❌ FALSCH: Einsatz löschen (wird von BEIDEN Layers blockiert!)
const deleteResult = await repository.delete(einsatzId);
// Layer 1: canBeDeleted() returns false
// Layer 2: PostgreSQL Trigger wirft Exception
```

### Vorteile der doppelten Schutzschicht

1. **Defense in Depth**
   Domain Layer + Database Layer = Zwei unabhängige Schutzschichten

2. **Fail-Safe**
   Selbst Admin-Scripts oder Raw-SQL können DRK-Compliance nicht umgehen

3. **Audit Trail**
   Klare Fehlermeldungen referenzieren "DRK Compliance Violation"

4. **Zero Performance Impact**
   Triggers feuern nur bei DELETE-Operationen (die nie passieren sollten)

### Testing

Die Double-Layer Protection wird auf beiden Ebenen getestet:

**Domain Layer Tests:**
- Unit Tests validieren Aggregate Business Rules (`canBeDeleted()`, `archive()`, etc.)
- Pfad: `packages/backend/src/domain/aggregates/__tests__/`

**Infrastructure Layer Tests:**
- Integration Tests validieren PostgreSQL Triggers mit echter Datenbank
- Pfad: [`packages/backend/src/infrastructure/__tests__/no-delete-triggers.integration.spec.ts`](../infrastructure/__tests__/no-delete-triggers.integration.spec.ts)
- **7 Tests:**
  - 4 Tests: Prevent DELETE Operations (Einsatz, ETB, POI, User)
  - 3 Tests: Allow Alternative Actions (UPDATE zu ARCHIVIERT, is_deleted, is_locked)

**Test Beispiel:**
```typescript
// Test: Trigger verhindert DELETE auf einsaetze table
it('should prevent direct DELETE on einsatz table', async () => {
  // Given: Einsatz exists in database
  const einsatz = await prisma.einsatz.create({ ... });

  // When: Try to delete via Prisma Client
  const deletePromise = prisma.einsatz.delete({ where: { id: einsatz.id } });

  // Then: Expect DRK Compliance Violation exception
  await expect(deletePromise).rejects.toThrow(/DRK Compliance Violation/);

  // Verify: Einsatz still exists (not deleted)
  const stillExists = await prisma.einsatz.findUnique({ where: { id: einsatz.id } });
  expect(stillExists).not.toBeNull();
});
```

**Story:** [Story 1.8 - Database Constraints & Triggers](../../../../.bmad-ephemeral/stories/1-8-database-constraints-triggers.md)

---

## 🧱 Base Classes

Die Domain Layer Foundation besteht aus 4 Abstract Base Classes, die alle DDD Patterns implementieren:

### 1. ValueObject<TProps>

**Purpose:** Strukturelle Gleichheit und Immutability für Value Objects

```typescript
import { ValueObject } from '@domain/common/value-object';

// Example: EinsatzStatus Value Object
interface EinsatzStatusProps {
  value: string;
}

class EinsatzStatus extends ValueObject<EinsatzStatusProps> {
  private constructor(props: EinsatzStatusProps) {
    super(props);
  }

  static create(value: string): Result<EinsatzStatus> {
    if (!['AKTIV', 'ABGESCHLOSSEN', 'ARCHIVIERT'].includes(value)) {
      return Result.fail('Invalid Einsatz status');
    }
    return Result.ok(new EinsatzStatus({ value }));
  }

  get value(): string {
    return this.props.value;
  }
}

// Usage
const status1 = EinsatzStatus.create('AKTIV').value!;
const status2 = EinsatzStatus.create('AKTIV').value!;
status1.equals(status2); // true (structural equality!)
```

**Key Features:**
- ✅ `equals()`: Deep structural comparison (nicht reference equality)
- ✅ `hashCode()`: Für Set/Map Collections
- ✅ `Object.freeze()`: Runtime immutability
- ✅ Protected constructor erzwingt Factory Methods

### 2. EntityId<TAggregateType>

**Purpose:** Type-Safe IDs mit Cuid validation

```typescript
import { EntityId } from '@domain/common/entity-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';

// Usage: Auto-Generation
const result = EinsatzId.create(); // Generates cuid automatically
if (result.isSuccess) {
  console.log(result.value.value); // "A1B2C3D4E5F6G7H8I9J0K" (21 chars)
}

// Usage: With existing cuid
const result2 = EinsatzId.create('A1B2C3D4E5F6G7H8I9J0K');

// Type-Safety (compile-time!)
function processEinsatz(id: EinsatzId) { ... }
const userId = UserId.create().value!;
processEinsatz(userId); // ❌ TypeScript Compile Error!
```

**Key Features:**
- ✅ **Auto-Generation:** `create()` ohne Parameter → `cuid()`
- ✅ **Type-Safety:** `EinsatzId ≠ UserId` at compile-time
- ✅ **Result<T> Pattern:** Validierung mit Error Handling

### 3. DomainEvent

**Purpose:** Immutable Domain Events mit auto-generated eventId

```typescript
import { DomainEvent } from '@domain/common/domain-event';

// Example: EinsatzCreatedEvent
class EinsatzCreatedEvent extends DomainEvent {
  constructor(
    public readonly einsatzId: string,
    public readonly name: string,
    public readonly location: string,
    aggregateId?: string
  ) {
    super(aggregateId); // eventId + occurredAt auto-generated!
  }

  static eventName(): string {
    return 'EinsatzCreated'; // Past Tense!
  }
}

// Usage
const event = new EinsatzCreatedEvent(
  'A1B2C3D4E5F6G7H8I9J0K',
  'Wohnungsbrand',
  'Musterstraße 42'
);

console.log(event.eventId);     // "X1Y2Z3..." (cuid, 21 chars)
console.log(event.occurredAt);  // 2025-11-14T13:45:23.456Z
console.log(EinsatzCreatedEvent.eventName()); // "EinsatzCreated"
```

**Key Features:**
- ✅ **Auto-Generation:** `eventId` (cuid) + `occurredAt` (Date) im Constructor
- ✅ **Immutable:** Readonly properties (historical facts)
- ✅ **Event Routing:** `eventName()` für type-safe dispatching
- ✅ **Versioning:** `eventVersion()` für Schema Evolution

**Event Naming Convention:**
- ✅ Past Tense: "EinsatzCreatedEvent", "ETBEntryAddedEvent"
- ❌ NOT Imperative: "CreateEinsatzEvent"

### 4. AggregateRoot<TId>

**Purpose:** DDD Aggregate Pattern mit Event Accumulation

```typescript
import { AggregateRoot } from '@domain/common/aggregate-root';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EinsatzCreatedEvent } from '@domain/events/einsatz-created.event';

// Example: Einsatz Aggregate
class Einsatz extends AggregateRoot<EinsatzId> {
  private constructor(
    id: EinsatzId,
    private _name: string,
    private _location: string,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(id, createdAt, updatedAt);
  }

  static create(name: string, location: string): Result<Einsatz> {
    if (!name || name.trim().length === 0) {
      return Result.fail('Einsatz name is required');
    }

    const idResult = EinsatzId.create();
    if (idResult.isFailure) {
      return Result.fail(idResult.error!);
    }

    const einsatz = new Einsatz(idResult.value!, name, location);
    einsatz.addDomainEvent(
      new EinsatzCreatedEvent(idResult.value!.value, name, location)
    );
    return Result.ok(einsatz);
  }

  updateName(name: string): void {
    this._name = name;
    this.addDomainEvent(
      new EinsatzUpdatedEvent(this.id.value, { name })
    );
  }

  get name(): string {
    return this._name;
  }
}

// Usage
const result = Einsatz.create('Wohnungsbrand', 'Location');
const einsatz = result.value!;

// Event Accumulation
einsatz.updateName('Großbrand');
const events = einsatz.getDomainEvents(); // 2 events (Created + Updated)

// Publish Events (Infrastructure Layer)
events.forEach(event => eventBus.publish(event));
einsatz.clearDomainEvents(); // Clear after publishing
```

**Key Features:**
- ✅ **Event Accumulation:** `addDomainEvent()`, `getDomainEvents()`, `clearDomainEvents()`
- ✅ **Shallow Copy:** `getDomainEvents()` returns `[..._domainEvents]` (mutation-safe!)
- ✅ **Identity Equality:** `equals()` compares ONLY by ID
- ✅ **Protected Constructor:** Erzwingt Result<T> Factory Methods
- ✅ **Generic Constraint:** `<TId extends EntityId<any>>` für type-safe IDs

**Critical Pattern: Shallow Copy**
```typescript
// ✅ CORRECT: Shallow copy prevents external mutations
getDomainEvents(): DomainEvent[] {
  return [...this._domainEvents];
}

// ❌ WRONG: Direct reference allows caller to mutate internal state!
getDomainEvents(): DomainEvent[] {
  return this._domainEvents; // Common DDD pitfall!
}
```

### Integration Example

Alle Base Classes arbeiten nahtlos zusammen:

```typescript
// 1. Create Aggregate (uses EntityId + DomainEvent internally)
const result = Einsatz.create('Wohnungsbrand', 'Location');

// 2. Result<T> Pattern
if (result.isFailure) {
  console.error(result.error);
  return;
}

const einsatz = result.value!;

// 3. Typed ID (EntityId<'Einsatz'>)
const id: EinsatzId = einsatz.id;
console.log(id.value); // cuid

// 4. ValueObject Equality
const sameId = EinsatzId.create(id.value).value!;
console.log(id.equals(sameId)); // true (structural equality)

// 5. Domain Events
const events = einsatz.getDomainEvents();
events.forEach(event => {
  console.log(event.eventId);     // cuid
  console.log(event.occurredAt);  // Date
  console.log(event.constructor.name); // "EinsatzCreatedEvent"
});

// 6. Aggregate Identity Equality
const einsatz2 = Einsatz.create('Other', 'Location').value!;
console.log(einsatz.equals(einsatz2)); // false (different IDs)
```

### Best Practices

1. **IMMER Result<T> Pattern nutzen**
   ```typescript
   // ✅ CORRECT
   static create(...): Result<Aggregate> {
     return Result.ok(new Aggregate(...));
   }

   // ❌ WRONG
   static create(...): Aggregate {
     return new Aggregate(...); // No error handling!
   }
   ```

2. **IMMER Protected Constructors**
   ```typescript
   // ✅ CORRECT: Forces factory methods
   private constructor(...) { ... }

   // ❌ WRONG: Allows direct instantiation without validation
   constructor(...) { ... }
   ```

3. **IMMER Cuid für IDs (NICHT UUID)**
   ```typescript
   // ✅ CORRECT (Project Standard)
   import { createId } from '@paralleldrive/cuid2';
   const id = createId();

   // ❌ WRONG
   import { randomUUID } from 'crypto';
   const id = randomUUID(); // 36 chars, NOT project standard!
   ```

4. **Events in Past Tense**
   ```typescript
   // ✅ CORRECT
   class EinsatzCreatedEvent extends DomainEvent { ... }

   // ❌ WRONG
   class CreateEinsatzEvent extends DomainEvent { ... }
   ```

### Test Coverage

Alle Base Classes haben **100% Test Coverage** (Story 1.2):

| Base Class | Statements | Branches | Functions | Lines |
|------------|------------|----------|-----------|-------|
| `aggregate-root.ts` | 100% | 100% | 100% | 100% |
| `domain-event.ts` | 100% | 100% | 100% | 100% |
| `entity-id.ts` | 100% | 100% | 100% | 100% |
| `value-object.ts` | 87.87% | 83.33% | 100% | 100% |
| `result.ts` | 100% | 100% | 100% | 100% |

**Tests Location:**
- `src/domain/common/*.spec.ts` (Unit Tests)
- `src/domain/common/__tests__/base-classes.integration.spec.ts` (Integration Tests)

---

## 📝 Coding Conventions

### 1. Aggregates

**Definition:**
Ein Aggregate ist eine transaktionale Konsistenz-Grenze, die mehrere Entities/VOs zu einer kohärenten Einheit
zusammenfasst. Änderungen am Aggregate emittieren **Domain Events**.

**Namenskonvention:** `{name}.aggregate.ts`

**Beispiel:**

```typescript
// domain/einsatz/aggregates/einsatz.aggregate.ts
import { AggregateRoot } from '@domain/shared/base/aggregate-root';
import { EinsatzId } from '../value-objects/einsatz-id.vo';
import { EinsatzStatus } from '../value-objects/einsatz-status.vo';
import { EinsatzCreatedEvent } from '../events/einsatz-created.event';
import { Result } from '@domain/common/result';

export class Einsatz extends AggregateRoot<EinsatzId> {
  private constructor(
    id: EinsatzId,
    private _nummer: string,
    private _status: EinsatzStatus,
    private _ort?: string,
  ) {
    super(id);
  }

  /**
   * Factory-Methode erstellt neuen Einsatz und emittiert EinsatzCreatedEvent.
   *
   * Nutzt Result<T> Pattern statt Exceptions für vorhersagbare Fehlerbehandlung.
   * Warum? Domain Layer hat keine Abhängigkeiten zu Exception-Handling-Frameworks.
   */
  static create(
    nummer: string,
    ort?: string,
  ): Result<Einsatz> {
    // Validierung
    if (!nummer || nummer.trim().length === 0) {
      return Result.fail('Einsatznummer darf nicht leer sein');
    }

    const id = EinsatzId.create();
    if (id.isFailure) {
      return Result.fail(id.error!);
    }

    const status = EinsatzStatus.create('AKTIV');
    if (status.isFailure) {
      return Result.fail(status.error!);
    }

    const einsatz = new Einsatz(id.value!, nummer, status.value!, ort);

    // Domain Event emittieren
    einsatz.addDomainEvent(new EinsatzCreatedEvent(einsatz.id, nummer, ort));

    return Result.ok(einsatz);
  }

  /**
   * Einsatz abschließen - Business-Logik mit Validierung.
   *
   * Warum hier statt in Service? Aggregate hat volle Kontrolle über eigenen State.
   */
  complete(): Result<void> {
    if (this._status.equals(EinsatzStatus.create('ABGESCHLOSSEN').value!)) {
      return Result.fail('Einsatz ist bereits abgeschlossen');
    }

    this._status = EinsatzStatus.create('ABGESCHLOSSEN').value!;
    this.addDomainEvent(new EinsatzCompletedEvent(this.id));

    return Result.ok(undefined);
  }

  // Getter (kein Setter - Immutability!)
  get nummer(): string { return this._nummer; }
  get status(): EinsatzStatus { return this._status; }
  get ort(): string | undefined { return this._ort; }
}
```

**Wichtig:**
- Extends `AggregateRoot<ID>` (Base-Class in `domain/shared/base/`)
- Private Constructor + Public Factory-Methode (`create()`)
- Business-Logik-Methoden (z.B. `complete()`) nutzen `Result<T>` Pattern
- Emittiert Domain Events via `addDomainEvent()`
- KEINE `@Injectable()` oder andere Framework-Decorators!

### 2. Einsatztagebuch (ETB) Aggregate - Spezialfall: Versioning & Soft-Delete

**Definition:**
Das **Einsatztagebuch (ETB) Aggregate** modelliert das digitale Logbuch für Einsatzdokumentation mit automatischer
Versionierung, unveränderlichen Sequenznummern und DRK-konformen Soft-Deletes.

### 3. LagekarteAggregate (Lagekarte + POI Management)

**Purpose:** Manages tactical map with Points of Interest (POIs) using MGRS coordinate system (DRK standard).

**Key Features:**
- MGRS coordinates as primary (Military Grid Reference System)
- Lat/Lng fallback for external APIs (Nominatim geocoding)
- POI management (add, remove, update position)
- German MGRS zones validation (32U, 33U, 33N)

**Aggregates:**
- `LagekarteAggregate` - Root aggregate managing POIs

**Entities:**
- `Poi` - Point of Interest (managed by LagekarteAggregate)

**Value Objects:**
- `LagekarteId` - Typed ID for Lagekarte
- `PoiId` - Typed ID for POI entities
- `MgrsCoordinate` - Primary coordinate system (MGRS)
- `GeoCoordinate` - Fallback coordinate system (Lat/Lng)
- `PoiCategory` - POI categorization (EINSATZSTELLE, BEREITSTELLUNGSRAUM, etc.)

**Domain Events:**
- `PoiAddedEvent` - POI added to Lagekarte
- `PoiRemovedEvent` - POI removed from Lagekarte
- `PoiPositionUpdatedEvent` - POI position changed (includes old + new coordinates)

**Repository Interface:**
- `ILagekarteRepository` - Persistence contract (Infrastructure implementation in Epic 2)

**Domain Service Port:**
- `IGeocodingPort` - Geocoding service contract (Nominatim adapter in Epic 2)

### 4. UserAggregate (RBAC User Management)

**Purpose:** RBAC User Management mit Permission Hierarchie und Unified Auth Strategy

**Value Objects:**
- `UserId` - Type-Safe User ID (extends EntityId<'User'>)
- `Username` - Case-insensitive username (3-50 chars, lowercase normalization)
- `UserRole` - Role enum (SUPER_ADMIN, ADMIN, USER)
- `Permission` - Resource:Action format mit Wildcard Matching

**Business Rules:**

1. **Min-1-SUPER_ADMIN Constraint:** System MUSS immer mindestens 1 SUPER_ADMIN haben
   - `updateRole()` prüft via `IUserRepository.countByRole()` BEVOR Downgrade
   - Verhindert "Lock-Out" durch versehentliche Entfernung aller Admins
   - Atomare Operation: Count + Update in einer Transaction (Infrastructure Layer)

2. **Role-Based Permission Defaults:** Jede Role hat unveränderliche Default Permissions
   - `SUPER_ADMIN`: `*:*` (Full System Access)
   - `ADMIN`: `user:*, einsatz:*, fahrzeug:*, dienst:*` (Management Access)
   - `USER`: `user:read_self` (Self-Service only)

3. **Custom Permissions:** Zusätzlich zu Role-Defaults können Custom Permissions gewährt werden
   - Beispiel: ADMIN mit zusätzlicher Permission `etb:lock` (ETB finalisieren)
   - Permissions sind additiv (Role Defaults + Custom Grants)
   - Prüfung via `hasPermission()` matcht gegen BEIDE Sets

4. **Account Locking ≠ Deletion:** Lock ist reversibel, Delete ist Soft Delete
   - `lockAccount()`: Setzt `isLocked=true`, User kann reaktiviert werden
   - Delete: Soft Delete via Repository (Infrastructure Layer)

**Code Example:**

```typescript
// Create User mit Role
const usernameResult = Username.create('johndoe');
if (usernameResult.isFailure) {
  throw new Error(usernameResult.error);
}

const user = UserAggregate.create(
  usernameResult.getValue(),
  UserRole.ADMIN(),
).getValue();

// Grant Custom Permission (zusätzlich zu ADMIN Defaults)
const permission = Permission.create('etb:lock').getValue();
user.grantPermission(permission, adminUserId);

// Check Permission (Role Defaults + Custom Grants)
user.hasPermission(Permission.CREATE_EINSATZ()); // true (ADMIN hat einsatz:*)
user.hasPermission(Permission.LOCK_ETB());       // true (Custom Grant)
user.hasPermission(Permission.DELETE_USER());    // false (keine Wildcard Match)

// Update Role (mit Min-1-SUPER_ADMIN Check im Application Layer)
const updateResult = await user.updateRole(
  UserRole.SUPER_ADMIN(),
  adminUserId,
  repository
);
if (updateResult.isFailure) {
  // Könnte fehlschlagen wenn letzter SUPER_ADMIN downgegraded würde
  console.error(updateResult.error);
}

// Lock Account (reversibel)
user.lockAccount(adminUserId);
console.log(user.isLocked); // true

// Check vor Login
if (user.isLocked) {
  throw new Error('Account ist gesperrt');
}
```

**Unified Auth Strategy (Password-Agnostic Domain Layer):**

Die Domain Layer hat KEINE Kenntnis von Passwörtern! Auth-Strategie wird in Infrastructure Layer implementiert:

- **USER Role:** Passwordless Auth (Magic Link via Email)
  - Token Generation: `ITokenServicePort.generateEmailVerificationToken()`
  - User klickt Link → Token verifiziert → Login
  - KEIN Password Hash im UserAggregate

- **ADMIN/SUPER_ADMIN:** Password-Based Auth
  - Token Generation: `ITokenServicePort.generatePasswordResetToken()`
  - Password Hash wird in Infrastructure Layer gespeichert (NICHT im Domain Layer)
  - Domain Layer validiert NUR Permissions, NICHT Passwörter

**Warum Password-Agnostic?**
- Domain Layer ist framework-agnostisch (keine bcrypt, JWT Dependencies)
- Auth-Strategie kann gewechselt werden ohne Domain Layer zu ändern
- Testbarkeit: Mock `ITokenServicePort` für Unit Tests

**Repository Interface:**
- `IUserRepository` - Persistence contract für User Management
  - `findById(id: UserId): Promise<Result<UserAggregate>>`
  - `save(user: UserAggregate): Promise<Result<void>>`
  - `countByRole(role: UserRole): Promise<number>` (für Min-1-SUPER_ADMIN Constraint)

**Domain Service Port:**
- `ITokenServicePort` - Token Generation für Auth (Infrastructure Adapter)
  - `generateEmailVerificationToken(userId: UserId): Promise<string>`
  - `generatePasswordResetToken(userId: UserId): Promise<string>`

**Domain Events:**
- `UserCreatedEvent` - User erstellt
- `UserRoleUpdatedEvent` - Role geändert (enthält old + new Role)
- `UserPermissionGrantedEvent` - Custom Permission gewährt
- `UserPermissionRevokedEvent` - Custom Permission entzogen
- `UserAccountLockedEvent` - Account gesperrt
- `UserAccountUnlockedEvent` - Account entsperrt

**Besonderheiten (unterscheidet sich vom Einsatz Aggregate):**

1. **Hierarchische Struktur:**
   - Aggregate Root: `EinsatztagebuchAggregate` (verwaltet Lebenszykl)
   - Child Entity: `EtbEintrag` (einzelne Log-Einträge, kein separates Repository!)
   - Foreign Aggregate Reference: `EinsatzId` (1:1 Beziehung zu Einsatz)

2. **Versioning mit Snapshots:**
   - Jede Änderung (add/update/delete) inkrementiert `_version`
   - Version enthält monoton steigende Nummer + Timestamp
   - Snapshots werden VOM REPOSITORY erstellt (NOT in Aggregate)
   - Optimistic Locking verhindert Concurrency Conflicts (Epic 4)

3. **State Machine (3 States):**
   ```
   DRAFT → ACTIVE → LOCKED (nur Vorwärts, LOCKED ist final)
   ```
   - **DRAFT:** Initial state, Bearbeitung erlaubt
   - **ACTIVE:** Im Einsatz, Bearbeitung erlaubt
   - **LOCKED:** Final state, KEINE Änderungen mehr möglich (DRK-Compliance)

4. **Soft-Delete für Audit-Trail:**
   - Gelöschte Einträge bleiben in `_eintraege[]` (mit `isDeleted=true`)
   - Sequenznummern sind stabil (keine Gaps nach Delete)
   - Garantiert 10-Jahres-Aufbewahrungspflicht (DRK)

5. **Auto-Increment Sequenznummern:**
   - Monoton steigend ab 1
   - Unveränderlich nach Assignment
   - Garantiert chronologische Sortierung

**Wichtig:**
- Extends `AggregateRoot<EtbId>` (Base-Class)
- Private Constructor + Factory-Methode (`create()`)
- Business-Logik-Methoden nutzen `Result<T>` Pattern
- Emittiert Domain Events: `EintragAddedEvent`, `EintragUpdatedEvent`, `EintragDeletedEvent`, `EtbLockedEvent`
- KEINE `@Injectable()` oder Framework-Decorators!

**Dateien:**
- Aggregate: `domain/aggregates/einsatztagebuch.aggregate.ts`
- Entity: `domain/entities/etb-eintrag.entity.ts`
- Value Objects: `domain/value-objects/etb-*.ts`
- Events: `domain/events/eintrag-*.event.ts`, `domain/events/etb-locked.event.ts`
- Repository: `domain/repositories/i-etb.repository.ts` (Epic 4)

---

### 3. Value Objects

**Definition:**
Value Objects sind **immutable**, self-validating Werte ohne Identität. Gleichheit wird über Wert-Vergleich
bestimmt (`equals()`), nicht Referenz.

**Namenskonvention:** `{name}.vo.ts`

**Beispiel:**

```typescript
// domain/einsatz/value-objects/einsatz-status.vo.ts
import { ValueObject } from '@domain/shared/base/value-object';
import { Result } from '@domain/common/result';

type EinsatzStatusValue = 'AKTIV' | 'ABGESCHLOSSEN' | 'ARCHIVIERT';

interface EinsatzStatusProps {
  value: EinsatzStatusValue;
}

export class EinsatzStatus extends ValueObject<EinsatzStatusProps> {
  private constructor(props: EinsatzStatusProps) {
    super(props);
  }

  /**
   * Factory-Methode mit Validierung.
   *
   * Warum Result<T>? Validierungs-Fehler sind vorhersagbar (User-Input),
   * keine Exceptions in Domain Layer nötig.
   */
  static create(value: string): Result<EinsatzStatus> {
    const validStatuses: EinsatzStatusValue[] = ['AKTIV', 'ABGESCHLOSSEN', 'ARCHIVIERT'];

    if (!validStatuses.includes(value as EinsatzStatusValue)) {
      return Result.fail(
        `Ungültiger Status: ${value}. Erlaubt: ${validStatuses.join(', ')}`
      );
    }

    return Result.ok(new EinsatzStatus({ value: value as EinsatzStatusValue }));
  }

  get value(): EinsatzStatusValue {
    return this.props.value;
  }

  /**
   * Business-Logik: Darf Status gewechselt werden?
   */
  canTransitionTo(newStatus: EinsatzStatus): boolean {
    const currentValue = this.value;
    const newValue = newStatus.value;

    // AKTIV → ABGESCHLOSSEN, ARCHIVIERT
    if (currentValue === 'AKTIV') {
      return newValue === 'ABGESCHLOSSEN' || newValue === 'ARCHIVIERT';
    }

    // ABGESCHLOSSEN → ARCHIVIERT
    if (currentValue === 'ABGESCHLOSSEN') {
      return newValue === 'ARCHIVIERT';
    }

    // ARCHIVIERT → keine Transitions
    return false;
  }
}
```

**Wichtig:**
- Extends `ValueObject<Props>` (Base-Class in `domain/shared/base/`)
- Private Constructor + Factory-Methode (`create()`)
- Factory gibt `Result<VO>` zurück (KEIN `throw`)
- Immutable (nur Getter, kein Setter)
- `equals()` Methode von Base-Class (Deep-Comparison über Props)

### 4. Domain Events

**Definition:**
Domain Events repräsentieren fachliche Ereignisse, die im System passiert sind (Past Tense!).
Events werden vom Aggregate emittiert und von Event Handlers konsumiert.

**Namenskonvention:** `{aggregate}-{action}.event.ts` (z.B. `einsatz-created.event.ts`)

**Beispiel:**

```typescript
// domain/einsatz/events/einsatz-created.event.ts
import { DomainEvent } from '@domain/shared/base/domain-event';
import { EinsatzId } from '../value-objects/einsatz-id.vo';

export class EinsatzCreatedEvent extends DomainEvent {
  constructor(
    public readonly einsatzId: EinsatzId,
    public readonly nummer: string,
    public readonly ort?: string,
  ) {
    super();
  }

  /**
   * Event-Name für Event-Routing (z.B. in Event Outbox).
   *
   * Warum statische Methode? Type-Safety bei Event-Subscription.
   */
  static eventName(): string {
    return 'einsatz.created';
  }
}
```

**Wichtig:**
- Extends `DomainEvent` (Base-Class in `domain/shared/base/`)
- Readonly Properties (Events sind immutable!)
- Past Tense Naming (`Created`, `Completed`, `Archived`, NICHT `Create`, `Complete`)
- Statische `eventName()` Methode für Event-Routing
- KEINE String-Events (`'einsatz.created'`), immer typed Classes!

### 5. Repository Interfaces (Ports)

**Definition:**
Repository Interfaces definieren **Persistence-Contracts** im Domain Layer.
Infrastructure Layer liefert Implementierung (z.B. `PrismaEinsatzRepository`).

**Namenskonvention:** `i{aggregate}.repository.ts`

**Beispiel:**

```typescript
// domain/einsatz/repositories/ieinsatz.repository.ts
import { Result } from '@domain/common/result';
import { Einsatz } from '../aggregates/einsatz.aggregate';
import { EinsatzId } from '../value-objects/einsatz-id.vo';

/**
 * Port für Einsatz Persistence.
 *
 * Warum Interface im Domain Layer? Dependency Inversion Principle:
 * Domain definiert Contract, Infrastructure liefert Adapter.
 */
export interface IEinsatzRepository {
  /**
   * Einsatz anhand ID abrufen.
   *
   * @returns Result<Einsatz> - Success wenn gefunden, Failure wenn nicht existent
   */
  findById(id: EinsatzId): Promise<Result<Einsatz>>;

  /**
   * Einsatz speichern (Create oder Update).
   *
   * Warum kein separates create() + update()? Aggregate entscheidet über
   * Persistence-Strategie (Event-Sourcing könnte nur append() haben).
   */
  save(einsatz: Einsatz): Promise<Result<void>>;

  /**
   * Einsatz löschen (Soft-Delete via archiviert Flag).
   *
   * Warum Result<void>? Fehler bei Constraint-Violations (z.B. FK-Constraints).
   */
  delete(id: EinsatzId): Promise<Result<void>>;

  /**
   * Alle aktiven Einsätze abrufen.
   */
  findAllActive(): Promise<Result<Einsatz[]>>;
}
```

**Wichtig:**
- Interface (KEINE Class!)
- Nutzt Domain Objects (Aggregate, Value Objects), NICHT Prisma Models
- Alle Methoden geben `Promise<Result<T>>` zurück
- KEINE Implementierung im Domain Layer!

### 6. Domain Services

**Definition:**
Domain Services kapseln **Cross-Aggregate Business-Logik**, die nicht zu einem einzelnen Aggregate gehört.

**Namenskonvention:** `{name}.service.ts` (Interface: `i{name}.service.ts`)

**Beispiel:**

```typescript
// domain/services/ieinsatz-naming.service.ts
import { Result } from '@domain/common/result';

/**
 * Port für Einsatz-Namensgenerierung.
 *
 * Warum Domain Service? Naming-Logik benötigt Input von mehreren Aggregates
 * (Einsatz + Lagekarte Koordinaten) und gehört nicht in ein einzelnes Aggregate.
 */
export interface IEinsatzNamingService {
  /**
   * Generiert Einsatz-Namen basierend auf Ort und Koordinaten.
   *
   * Format: "Einsatz {Ort} - {Straße} {Hausnummer}" (Reverse Geocoding)
   */
  generateName(ort: string, lat: number, lng: number): Promise<Result<string>>;
}
```

**Wichtig:**
- Interface im Domain Layer, Implementierung in Infrastructure
- Nutzt Domain Objects (Value Objects, Aggregates)
- Gibt `Result<T>` zurück

### Implemented Domain Services (Story 1.7)

In Story 1.7 wurden 3 Domain Services für Einsatz-Management implementiert:

| Service | Type | Purpose | Location |
|---------|------|---------|----------|
| **EinsatzNamingService** | Pure Function | Einsatznummern-Generierung (E{JAHR}-{LAUFNUMMER}) | `domain/services/einsatz-naming.service.ts` |
| **EinsatzCompletenessService** | Pure Function | Vollständigkeits-Validierung vor Abschluss | `domain/services/einsatz-completeness.service.ts` |
| **EinsatzArchivalPolicy** | Domain Policy | DRK 10-Jahres-Archivierungspflicht | `domain/services/einsatz-archival.policy.ts` |
| **IGeocodingPort** | Port Interface | Geocoding Contract (Nominatim Adapter) | `domain/services/ports/i-geocoding.port.ts` (Story 1.5) |

**Code Examples:**

```typescript
// 1. EinsatzNamingService - Pure Function
const namingService = new EinsatzNamingService();
const jahr = 2024;
const sequenznummer = 42; // From Repository.getNextSequenceNumber()
const nummer = namingService.generateEinsatzNummer(jahr, sequenznummer);
console.log(nummer); // "E2024-042"
```

```typescript
// 2. EinsatzCompletenessService - Validation
const completenessService = new EinsatzCompletenessService();
const einsatz = getEinsatzFromSomewhere();

// Check if Einsatz can be completed
const validationResult = completenessService.canBeCompleted(einsatz, true);
if (validationResult.isFailure) {
  const missing = completenessService.getMissingRequirements(einsatz);
  console.error(`Fehlende Felder: ${missing.join(', ')}`);
} else {
  // Abschluss ist erlaubt
  const userId = UserId.create().value!;
  einsatz.complete(userId);
}
```

```typescript
// 3. EinsatzArchivalPolicy - 10-Year Rule
const archivalPolicy = new EinsatzArchivalPolicy();
const now = new Date();
const einsatz = getCompletedEinsatz(); // Einsatz with ABGESCHLOSSEN status

// Check if 10-year retention period expired
if (archivalPolicy.canBeArchived(einsatz, now)) {
  const archivalDate = archivalPolicy.getArchivalDate(einsatz);
  console.log(`Einsatz kann archiviert werden (Frist seit ${archivalDate.toLocaleDateString('de-DE')} abgelaufen)`);
  einsatz.archive();
} else {
  console.log('Einsatz noch nicht archivierbar (10-Jahres-Frist nicht abgelaufen)');
}
```

**Framework-Agnostic Testing:**

Alle 3 Domain Services sind framework-unabhängig und werden OHNE NestJS TestingModule getestet:

```typescript
// ✅ CORRECT: Direct instantiation (NO NestJS)
describe('EinsatzNamingService', () => {
  let service: EinsatzNamingService;

  beforeEach(() => {
    service = new EinsatzNamingService(); // Pure TypeScript
  });

  it('should format number with zero-padding', () => {
    // Given
    const year = 2024;
    const sequence = 1;

    // When
    const result = service.generateEinsatzNummer(year, sequence);

    // Then
    expect(result).toBe('E2024-001');
  });
});
```

**Test Coverage (Story 1.7):**

| Service | Statements | Branches | Functions | Lines | Test File |
|---------|------------|----------|-----------|-------|-----------|
| `einsatz-naming.service.ts` | 100% | 100% | 100% | 100% | 10 tests |
| `einsatz-completeness.service.ts` | 94.44% | 95.45% | 100% | 94.44% | 14 tests |
| `einsatz-archival.policy.ts` | 92.3% | 83.33% | 100% | 92.3% | 12 tests |
| **Integration Tests** | - | - | - | - | 8 tests |
| **Total** | **94.11%** | **92.85%** | **100%** | **94.11%** | **44 tests** |

**Port Consolidation (AC3):**

`IGeocodingPort` wurde in Story 1.5 implementiert und wird hier nur referenziert (NO duplication):
- **Location:** `domain/services/ports/i-geocoding.port.ts`
- **Methods:** `geocodeAddress()`, `reverseGeocode()`
- **Implementation:** Nominatim Adapter (Infrastructure Layer, Epic 2)

**Weitere Details:** Siehe `domain/services/README.md` für vollständige Dokumentation aller Services.

---

## 📊 Versioning Pattern (ETB Aggregate)

**Problem:**
DRK verlangt lückenlose Audit-Trails mit Revisionsverlauf (10-Jahres-Aufbewahrungspflicht). Gleichzeitig müssen
Concurrency-Konflikte vermieden werden, wenn mehrere User gleichzeitig das ETB bearbeiten.

**Lösung:**
Optimistic Locking via Versionierung + Snapshot-Persistierung durch Repository.

**Architektur:**

1. **EtbVersion Value Object** (in Aggregate)
   - Monotone Versionsnummer (Version 1, 2, 3, ...)
   - Timestamp für zeitliche Nachvollziehbarkeit
   - Wird bei JEDER Änderung inkrementiert (add/update/delete)

2. **Snapshots im Repository** (NOT im Aggregate)
   - Repository erstellt VOR Änderung einen Snapshot der aktuellen Version
   - Snapshots werden persistent gespeichert (Datenbank)
   - Ermöglicht: `etb.getHistory()` → alle früheren Versionen

3. **Concurrency Control**
   - Application Layer lädt ETB (Version N)
   - User führt Änderung aus (Version N+1 im Speicher)
   - Repository.save() prüft: Ist DB-Version noch N?
   - Wenn DB-Version ≠ N → ConflictException (Retry)

**Warum NOT im Memory?**
- Unbegrenztes Memory-Wachstum (10.000 Changes = 10.000 Snapshots im RAM)
- Persistence ist Infrastructure-Responsibility (Hexagonal Architecture)
- Repository entscheidet über Snapshot-Strategie

**Implementierung:**

```typescript
// Domain Layer (Aggregate)
export class EinsatztagebuchAggregate extends AggregateRoot<EtbId> {
  private _version: EtbVersion; // Version: 1, 2, 3, ...

  // Business Operation (increment version)
  addEintrag(text: string, userId: UserId): Result<EtbEintrag> {
    if (this.isLocked()) {
      return Result.fail('ETB ist gesperrt...');
    }

    const eintrag = new EtbEintrag(
      EintragId.create().value!,
      EtbSequenceNumber.create(this._nextSequenceNumber).value!,
      text,
      userId
    );

    this._eintraege.push(eintrag);
    this._nextSequenceNumber++;

    // Version automatisch inkrementiert
    this._version = EtbVersion.increment(this._version);

    this.addDomainEvent(new EintragAddedEvent(this.id, eintrag.id, text));
    return Result.ok(eintrag);
  }

  get version(): EtbVersion {
    return this._version;
  }
}

// Application Layer (Handler)
async updateEintrag(command: UpdateEintragCommand) {
  // 1. Load mit aktuelle Version
  const loadResult = await this.repository.findById(command.etbId);
  if (loadResult.isFailure) throw new Error(loadResult.error);

  const etb = loadResult.value!;
  const versionBeforeMutation = etb.version.versionNumber; // e.g., 5

  // 2. Mutation im Speicher (inkrementiert Version zu 6)
  const updateResult = etb.updateEintrag(
    command.eintragId,
    command.newText,
    command.userId
  );
  if (updateResult.isFailure) throw new Error(updateResult.error);

  // 3. Save mit Optimistic Locking
  // Repository.save() macht:
  // - Prüfen: SELECT version FROM einsatztagebuch WHERE id = ? → Ist noch 5?
  // - Snapshot erstellen von Version 5
  // - Persist neue Daten mit Version 6
  // - Bei Version-Mismatch → throw ConflictException
  const saveResult = await this.repository.save(etb);
  if (saveResult.isFailure) {
    // Version mismatch - andere Änderung hat stattgefunden
    // Retry: Reload from DB und erneut versuchen
    throw new ConflictException('ETB version mismatch - please retry');
  }
}

// Future: Epic 4 - Repository Implementation
class PrismaEtbRepository implements IEtbRepository {
  async save(etb: EinsatztagebuchAggregate): Promise<Result<void>> {
    // 1. Snapshot of previous version
    const currentVersion = await this.prisma.etb.findUnique({
      where: { id: etb.id.value },
      select: { version: true }
    });

    if (currentVersion && currentVersion.version !== etb.version.versionNumber - 1) {
      // Version conflict
      return Result.fail('Concurrency conflict - ETB was modified by another user');
    }

    // 2. Create snapshot (for audit trail)
    if (currentVersion) {
      await this.prisma.etbSnapshot.create({
        data: {
          etbId: etb.id.value,
          version: currentVersion.version,
          data: JSON.stringify(etb),
          timestamp: new Date()
        }
      });
    }

    // 3. Persist updated ETB
    await this.prisma.etb.upsert({
      where: { id: etb.id.value },
      update: {
        version: etb.version.versionNumber,
        eintraege: JSON.stringify(etb.eintraege),
        status: etb.status.value,
        updatedAt: new Date()
      },
      create: { ... }
    });

    return Result.ok();
  }

  // Get complete history (all snapshots)
  async getHistory(id: EtbId): Promise<Result<EtbSnapshot[]>> {
    const snapshots = await this.prisma.etbSnapshot.findMany({
      where: { etbId: id.value },
      orderBy: { version: 'asc' }
    });
    return Result.ok(snapshots);
  }
}
```

---

## 🚀 Example - How to create a new Aggregate

### Schritt 1: Value Objects erstellen

Starte mit den kleinsten Bausteinen - Value Objects:

```typescript
// domain/lagekarte/value-objects/lagekarte-id.vo.ts
import { ValueObject } from '@domain/shared/base/value-object';
import { Result } from '@domain/common/result';
import { createId } from '@paralleldrive/cuid';

interface LagekarteIdProps {
  value: string;
}

export class LagekarteId extends ValueObject<LagekarteIdProps> {
  private constructor(props: LagekarteIdProps) {
    super(props);
  }

  static create(id?: string): Result<LagekarteId> {
    const value = id ?? createId();

    if (!isCuid(value)) {
      return Result.fail('Ungültige Cuid');
    }

    return Result.ok(new LagekarteId({ value }));
  }

  get value(): string {
    return this.props.value;
  }
}
```

```typescript
// domain/lagekarte/value-objects/coordinates.vo.ts
import { ValueObject } from '@domain/shared/base/value-object';
import { Result } from '@domain/common/result';

interface CoordinatesProps {
  latitude: number;
  longitude: number;
}

export class Coordinates extends ValueObject<CoordinatesProps> {
  private constructor(props: CoordinatesProps) {
    super(props);
  }

  static create(lat: number, lng: number): Result<Coordinates> {
    // Validierung
    if (lat < -90 || lat > 90) {
      return Result.fail('Latitude muss zwischen -90 und 90 liegen');
    }
    if (lng < -180 || lng > 180) {
      return Result.fail('Longitude muss zwischen -180 und 180 liegen');
    }

    return Result.ok(new Coordinates({ latitude: lat, longitude: lng }));
  }

  get latitude(): number { return this.props.latitude; }
  get longitude(): number { return this.props.longitude; }
}
```

### Schritt 2: Domain Events definieren

```typescript
// domain/lagekarte/events/lagekarte-created.event.ts
import { DomainEvent } from '@domain/shared/base/domain-event';
import { LagekarteId } from '../value-objects/lagekarte-id.vo';
import { Coordinates } from '../value-objects/coordinates.vo';

export class LagekarteCreatedEvent extends DomainEvent {
  constructor(
    public readonly lagekarteId: LagekarteId,
    public readonly center: Coordinates,
  ) {
    super();
  }

  static eventName(): string {
    return 'lagekarte.created';
  }
}
```

### Schritt 3: Aggregate implementieren

```typescript
// domain/lagekarte/aggregates/lagekarte.aggregate.ts
import { AggregateRoot } from '@domain/shared/base/aggregate-root';
import { LagekarteId } from '../value-objects/lagekarte-id.vo';
import { Coordinates } from '../value-objects/coordinates.vo';
import { LagekarteCreatedEvent } from '../events/lagekarte-created.event';
import { Result } from '@domain/common/result';

export class Lagekarte extends AggregateRoot<LagekarteId> {
  private constructor(
    id: LagekarteId,
    private _center: Coordinates,
    private _zoom: number,
  ) {
    super(id);
  }

  static create(center: Coordinates, zoom: number = 13): Result<Lagekarte> {
    // Validierung
    if (zoom < 1 || zoom > 18) {
      return Result.fail('Zoom muss zwischen 1 und 18 liegen');
    }

    const id = LagekarteId.create();
    if (id.isFailure) {
      return Result.fail(id.error!);
    }

    const lagekarte = new Lagekarte(id.value!, center, zoom);
    lagekarte.addDomainEvent(new LagekarteCreatedEvent(lagekarte.id, center));

    return Result.ok(lagekarte);
  }

  // Business-Logik
  updateCenter(newCenter: Coordinates): Result<void> {
    this._center = newCenter;
    return Result.ok(undefined);
  }

  get center(): Coordinates { return this._center; }
  get zoom(): number { return this._zoom; }
}
```

### Schritt 4: Repository Interface definieren

```typescript
// domain/lagekarte/repositories/ilagekarte.repository.ts
import { Result } from '@domain/common/result';
import { Lagekarte } from '../aggregates/lagekarte.aggregate';
import { LagekarteId } from '../value-objects/lagekarte-id.vo';

export interface ILagekarteRepository {
  findById(id: LagekarteId): Promise<Result<Lagekarte>>;
  save(lagekarte: Lagekarte): Promise<Result<void>>;
  delete(id: LagekarteId): Promise<Result<void>>;
}
```

### Schritt 5: Unit Tests schreiben

```typescript
// domain/lagekarte/aggregates/lagekarte.aggregate.spec.ts
import { Lagekarte } from './lagekarte.aggregate';
import { Coordinates } from '../value-objects/coordinates.vo';

describe('Lagekarte Aggregate', () => {
  describe('create', () => {
    it('should create lagekarte with valid coordinates', () => {
      // Given: Valid coordinates
      const center = Coordinates.create(48.1351, 11.5820).value!; // München
      const zoom = 13;

      // When: Creating lagekarte
      const result = Lagekarte.create(center, zoom);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.value?.center).toBe(center);
      expect(result.value?.zoom).toBe(zoom);
    });

    it('should fail with invalid zoom', () => {
      // Given: Invalid zoom
      const center = Coordinates.create(48.1351, 11.5820).value!;
      const invalidZoom = 25;

      // When: Creating lagekarte
      const result = Lagekarte.create(center, invalidZoom);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Zoom muss zwischen 1 und 18 liegen');
    });
  });

  describe('updateCenter', () => {
    it('should update center coordinates', () => {
      // Given: Existing lagekarte
      const oldCenter = Coordinates.create(48.1351, 11.5820).value!;
      const lagekarte = Lagekarte.create(oldCenter).value!;
      const newCenter = Coordinates.create(52.5200, 13.4050).value!; // Berlin

      // When: Updating center
      const result = lagekarte.updateCenter(newCenter);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(lagekarte.center).toBe(newCenter);
    });
  });
});
```

### Schritt 6: Repository Implementation (Infrastructure Layer)

**ACHTUNG:** Dies gehört NICHT in den Domain Layer, sondern in `infrastructure/persistence/prisma/repositories/`:

```typescript
// infrastructure/persistence/prisma/repositories/lagekarte.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ILagekarteRepository } from '@domain/lagekarte/repositories/ilagekarte.repository';
import { Lagekarte } from '@domain/lagekarte/aggregates/lagekarte.aggregate';
import { LagekarteId } from '@domain/lagekarte/value-objects/lagekarte-id.vo';
import { LagekarteMapper } from '../mappers/lagekarte.mapper';
import { Result } from '@domain/common/result';

@Injectable()
export class PrismaLagekarteRepository implements ILagekarteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: LagekarteId): Promise<Result<Lagekarte>> {
    const prismaLagekarte = await this.prisma.lagekarte.findUnique({
      where: { id: id.value },
    });

    if (!prismaLagekarte) {
      return Result.fail('Lagekarte nicht gefunden');
    }

    return LagekarteMapper.toDomain(prismaLagekarte);
  }

  async save(lagekarte: Lagekarte): Promise<Result<void>> {
    const prismaData = LagekarteMapper.toPrisma(lagekarte);

    await this.prisma.lagekarte.upsert({
      where: { id: lagekarte.id.value },
      update: prismaData,
      create: prismaData,
    });

    return Result.ok(undefined);
  }

  async delete(id: LagekarteId): Promise<Result<void>> {
    await this.prisma.lagekarte.update({
      where: { id: id.value },
      data: { archiviert: true, archiviertAt: new Date() },
    });

    return Result.ok(undefined);
  }
}
```

---

## 🚫 Dependency Rules

### ✅ ERLAUBT

**Domain Layer DARF importieren:**
- ✅ TypeScript Standard Library (`Date`, `Map`, `Set`, etc.)
- ✅ Andere Domain Objects (`import { EinsatzId } from '../value-objects/einsatz-id.vo'`)
- ✅ Shared Kernel (`import { Result } from '@domain/common/result'`)
- ✅ Cuid Library (`cuid` - NUR für ID-Generierung)

**Application Layer DARF importieren:**
- ✅ Domain Layer (`import { Einsatz } from '@domain/einsatz/aggregates/einsatz.aggregate'`)
- ✅ Andere Application Layer (`import { CreateEinsatzDto } from '../dto/create-einsatz.dto'`)

**Infrastructure Layer DARF importieren:**
- ✅ Domain Layer
- ✅ Application Layer
- ✅ NestJS (`@nestjs/common`, `@nestjs/core`)
- ✅ Prisma (`@prisma/client`)

### ❌ VERBOTEN

**Domain Layer DARF NIEMALS importieren:**
- ❌ Application Layer (`import { CreateEinsatzDto } from '@application/...'`)
- ❌ Infrastructure Layer (`import { PrismaService } from '@infrastructure/...'`)
- ❌ NestJS (`@nestjs/*`)
- ❌ Prisma (`@prisma/client`)
- ❌ External Libraries (außer `cuid`)

**Enforcement:**

1. **Biome Linter** (konfiguriert in `biome.json`):
   ```json
   {
     "linter": {
       "rules": {
         "noRestrictedImports": {
           "paths": {
             "src/domain/**": {
               "forbid": ["@application/*", "@infrastructure/*", "@nestjs/*", "@prisma/*"]
             }
           }
         }
       }
     }
   }
   ```

2. **Madge Circular Dependency Check** (Pre-Commit Hook):
   ```bash
   pnpm --filter @bluelight-hub/backend check:deps
   # Führt aus: madge --circular src/domain/
   ```

3. **Pre-Commit Hook** (`.husky/pre-commit`):
   ```bash
   #!/bin/sh
   pnpm --filter @bluelight-hub/backend test:domain
   pnpm --filter @bluelight-hub/backend check:deps
   pnpm lint
   ```

**Bei Verstoß:** Commit wird blockiert! 🚨

### Dependency Direction Diagram

```
┌──────────────────────────────────────┐
│     Infrastructure Layer             │
│  ✅ imports Domain + Application     │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│      Application Layer               │
│  ✅ imports Domain                   │
│  ❌ NEVER imports Infrastructure     │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│       Domain Layer (CORE)            │
│  ✅ imports ONLY TypeScript stdlib   │
│  ❌ NEVER imports Application        │
│  ❌ NEVER imports Infrastructure     │
│  ❌ NEVER imports @nestjs/*          │
│  ❌ NEVER imports @prisma/*          │
└──────────────────────────────────────┘
```

---

## 💻 ETB Aggregate - Code Examples

### 1. Create ETB (Factory Method)

```typescript
import { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';

// Create new ETB for an Einsatz
const einsatzId = EinsatzId.create().value!;
const result = EinsatztagebuchAggregate.create(einsatzId);

if (result.isSuccess) {
  const etb = result.value!;
  console.log(etb.status.value); // "DRAFT"
  console.log(etb.version.versionNumber); // 1
  console.log(etb.eintraege.length); // 0 (leer)
  console.log(etb.getDomainEvents().length); // 0 (noch nicht emittiert)
}
```

### 2. Add Entry (Sequence Numbers auto-increment)

```typescript
const userId = UserId.create().value!;
const result = etb.addEintrag('Einsatzbeginn: 14:30 Uhr', userId);

if (result.isSuccess) {
  const eintrag = result.value!;
  console.log(eintrag.sequenceNumber.value); // 1
  console.log(eintrag.text); // 'Einsatzbeginn: 14:30 Uhr'
  console.log(eintrag.createdBy.value); // userId.value
}

// Version automatically incremented
console.log(etb.version.versionNumber); // 2

// Event emitted (shallow copy!)
const events = etb.getDomainEvents();
console.log(events.length); // 1
console.log(events[0].constructor.name); // "EintragAddedEvent"
```

### 3. Add Multiple Entries

```typescript
// Entry 1
etb.addEintrag('Alarmierung: 14:30 Uhr', userId);
console.log(etb.version.versionNumber); // 2

// Entry 2
etb.addEintrag('Fahrzeug ausgerückt: 14:32 Uhr', userId);
console.log(etb.version.versionNumber); // 3

// Entry 3
etb.addEintrag('Ankunft Einsatzort: 14:40 Uhr', userId);
console.log(etb.version.versionNumber); // 4

// All entries with stable sequence numbers
console.log(etb.eintraege.map(e => e.sequenceNumber.value)); // [1, 2, 3]
console.log(etb.eintraege.length); // 3
```

### 4. Update Entry (Soft-Delete preserves sequence)

```typescript
const eintrag = etb.eintraege[0];
const oldText = eintrag.text;

// Update text
const updateResult = etb.updateEintrag(eintrag.id, 'Alarmierung: 14:30 Uhr (korrigiert)', userId);

if (updateResult.isSuccess) {
  console.log(eintrag.text); // 'Alarmierung: 14:30 Uhr (korrigiert)'
  console.log(eintrag.updatedAt); // Current timestamp
  console.log(eintrag.sequenceNumber.value); // Still 1 (immutable!)
}

// Version incremented
console.log(etb.version.versionNumber); // 5

// Event contains old + new for audit trail
const event = etb.getDomainEvents()[etb.getDomainEvents().length - 1];
console.log(event.constructor.name); // "EintragUpdatedEvent"
```

### 5. Delete Entry (Soft-Delete with audit trail)

```typescript
const eintrag = etb.eintraege[0];
const deleteResult = etb.deleteEintrag(eintrag.id, userId);

if (deleteResult.isSuccess) {
  // WICHTIG: Entry still in array!
  console.log(etb.eintraege.length); // Still 3 (NOT removed)
  console.log(eintrag.isDeleted); // true
  console.log(eintrag.sequenceNumber.value); // Still 1 (stable)

  // Soft-delete for DRK compliance (10-year audit trail)
  // getHistory() würde alle Versionen (auch gelöschte) zeigen
}

// Version incremented
console.log(etb.version.versionNumber); // 6

// Event emitted
const event = etb.getDomainEvents()[etb.getDomainEvents().length - 1];
console.log(event.constructor.name); // "EintragDeletedEvent"
```

### 6. Lock ETB (Finalize - no more changes)

```typescript
// Transition: DRAFT or ACTIVE → LOCKED
const lockResult = etb.lock(userId);

if (lockResult.isSuccess) {
  console.log(etb.status.value); // "LOCKED"
  console.log(etb.isLocked()); // true

  // All modifications now fail
  const failAddResult = etb.addEintrag('Should fail', userId);
  console.log(failAddResult.isFailure); // true
  console.log(failAddResult.error); // 'ETB ist gesperrt...'

  const failUpdateResult = etb.updateEintrag(etb.eintraege[0].id, 'Also fails', userId);
  console.log(failUpdateResult.isFailure); // true

  const failDeleteResult = etb.deleteEintrag(etb.eintraege[0].id, userId);
  console.log(failDeleteResult.isFailure); // true
}

// Version incremented once more
console.log(etb.version.versionNumber); // 7

// Event emitted
const event = etb.getDomainEvents()[etb.getDomainEvents().length - 1];
console.log(event.constructor.name); // "EtbLockedEvent"
```

### 7. Full Lifecycle Example

```typescript
// 1. Create ETB
const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
console.log(etb.status.value); // "DRAFT"
console.log(etb.version.versionNumber); // 1

// 2. Add entries during Einsatz
etb.addEintrag('Alarmierung: 14:30', userId);
etb.addEintrag('Ausrücken: 14:32', userId);
etb.addEintrag('Ankunft: 14:40', userId);
etb.addEintrag('Einsatz beendet: 15:20', userId);
console.log(etb.version.versionNumber); // 5

// 3. Update middle entry (typo)
const entry2 = etb.eintraege[1];
etb.updateEintrag(entry2.id, 'Ausrücken: 14:33 (korrigiert)', userId);
console.log(etb.version.versionNumber); // 6

// 4. Delete first entry (wrong entry)
etb.deleteEintrag(etb.eintraege[0].id, userId);
console.log(etb.version.versionNumber); // 7
console.log(etb.eintraege[0].isDeleted); // true
console.log(etb.eintraege[0].sequenceNumber.value); // Still 1

// 5. Lock ETB (finalize)
etb.lock(userId);
console.log(etb.status.value); // "LOCKED"
console.log(etb.version.versionNumber); // 8

// Final state:
console.log(etb.eintraege.length); // 4 (deleted entry still here)
console.log(etb.eintraege.filter(e => !e.isDeleted).length); // 3 (active entries)
console.log(etb.getDomainEvents().length); // 7 (all events)

// All sequences are stable
console.log(etb.eintraege.map(e => e.sequenceNumber.value)); // [1, 2, 3, 4]

// Version history would be (from Repository in Epic 4):
// Version 1: Initial creation
// Version 2: Entry 1 added (seq 1)
// Version 3: Entry 2 added (seq 2)
// Version 4: Entry 3 added (seq 3)
// Version 5: Entry 4 added (seq 4)
// Version 6: Entry 2 updated
// Version 7: Entry 1 deleted (soft)
// Version 8: ETB locked
```

### 8. Filter & Display (User-Facing)

```typescript
// Get only active entries (for UI display)
const activeEntries = etb.eintraege
  .filter(e => !e.isDeleted)
  .sort((a, b) => a.sequenceNumber.value - b.sequenceNumber.value);

// Display
activeEntries.forEach(e => {
  console.log(`[${e.sequenceNumber.value}] ${e.text}`);
  // [1] Ausrücken: 14:33 (korrigiert)
  // [2] Ankunft: 14:40
  // [3] Einsatz beendet: 15:20
});

// Deleted entries visible only in admin view or history
const deletedEntries = etb.eintraege.filter(e => e.isDeleted);
console.log(deletedEntries.length); // 1 (audit trail)
```

---

## 📍 MGRS Coordinate System (DRK Standard)

**Why MGRS?**
- NATO standard used by DRK for tactical positioning
- Higher precision than Lat/Lng (up to 1 meter)
- Grid-based system optimized for emergency response
- Avoids confusion with decimal degrees

**German MGRS Zones:**
- **Zone 32U:** Western/Northern Germany (Hamburg, Cologne)
- **Zone 33U:** Eastern Germany (Berlin, Leipzig, Dresden)
- **Zone 33N:** Central/Southern Germany (Frankfurt, Stuttgart, Munich)

**Conversion Strategy:**
```
External APIs (Nominatim) → Lat/Lng → MGRS → Storage
Storage → MGRS → Lat/Lng → External APIs
```

**Precision Levels:**
- 0 digits: 100km grid square
- 2 digits: 10km precision
- 4 digits: 1km precision
- 6 digits: 100m precision
- 8 digits: 10m precision
- 10 digits: 1m precision (used in Bluelight Hub)

**Example MGRS Format:**
```
33UUU8990317936
│││└─ Coordinates (10 digits = 1m precision)
││└── 100km Square ID (UU)
│└─── Latitude Band (U)
└──── Grid Zone (33)
```

---

## 📍 Lagekarte Aggregate - Code Examples

### Create Lagekarte with initial POI (Lazy Creation Pattern)

```typescript
const einsatzId = EinsatzId.create().getValue();
const userId = UserId.create().getValue();

// Option 1: Create empty Lagekarte
const lagekarteResult = LagekarteAggregate.create(einsatzId);
if (lagekarteResult.isFailure) {
  throw new Error(lagekarteResult.error);
}
const lagekarte = lagekarteResult.getValue();

// Option 2: Create with initial POI (atomic)
const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.40, 5).getValue();
const initialPoi = Poi.create('Einsatzstelle', berlinMgrs, PoiCategory.EINSATZSTELLE(), userId);
const lagekarteWithPoi = LagekarteAggregate.create(einsatzId, initialPoi).getValue();
```

### Add POI with MGRS coordinate

```typescript
const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.40, 5).getValue();
const poiResult = lagekarte.addPoi(
  'Einsatzstelle Brandenburger Tor',
  berlinMgrs,
  PoiCategory.EINSATZSTELLE(),
  userId
);

if (poiResult.isSuccess) {
  const poi = poiResult.getValue();
  console.log(`POI created with ID: ${poi.id.value}`);
}
```

### Add POI with Lat/Lng (auto-converts to MGRS)

```typescript
const hamburgGeo = GeoCoordinate.create(53.55, 10.00).getValue();
const poiResult = lagekarte.addPoi(
  'Bereitstellungsraum Hamburg',
  hamburgGeo, // Auto-converts to MGRS Zone 32U
  PoiCategory.BEREITSTELLUNGSRAUM(),
  userId
);
```

### Update POI position

```typescript
const hamburgMgrs = MgrsCoordinate.fromLatLng(53.55, 10.00, 5).getValue();
const updateResult = lagekarte.updatePoiPosition(poi.id, hamburgMgrs, userId);

if (updateResult.isSuccess) {
  // Event emitted with old + new coordinates for distance calculation
  const events = lagekarte.getDomainEvents();
  const positionEvent = events.find(e => e instanceof PoiPositionUpdatedEvent);
  const distanceKm = positionEvent.oldCoordinate.distanceTo(positionEvent.newCoordinate) / 1000;
  console.log(`POI moved ${distanceKm.toFixed(2)} km`);
}
```

### Remove POI

```typescript
const removeResult = lagekarte.removePoi(poi.id, userId);
if (removeResult.isSuccess) {
  console.log('POI removed successfully');
}
```

### Filter POIs by category

```typescript
const einsatzstellen = lagekarte.findPoisByCategory(PoiCategory.EINSATZSTELLE());
console.log(`Found ${einsatzstellen.length} Einsatzstellen`);
```

### MGRS ↔ Lat/Lng Conversion Examples

```typescript
// Convert Lat/Lng to MGRS
const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.40, 5).getValue();
console.log(berlinMgrs.value); // "33UUU8990317936" (Zone 33U, 1m precision)
console.log(berlinMgrs.gridZone); // "33U"

// Convert MGRS to Lat/Lng
const latLng = berlinMgrs.toLatLng();
console.log(`${latLng.latitude}, ${latLng.longitude}`); // 52.52, 13.40

// Calculate distance between two MGRS coordinates
const hamburgMgrs = MgrsCoordinate.fromLatLng(53.55, 10.00, 5).getValue();
const distanceMeters = berlinMgrs.distanceTo(hamburgMgrs);
console.log(`${(distanceMeters / 1000).toFixed(2)} km`); // ~255 km
```

---

## 📚 Weitere Ressourcen

- **PRD:** [docs/prds/276-hexagonale-architektur.md](../../../docs/prds/276-hexagonale-architektur.md)
- **Epics:** [docs/epics/276-hexagonale-architektur/](../../../docs/epics/276-hexagonale-architektur/)
- **Architecture Decisions:** [docs/architecture/9-architecture-decisions-adrs.md](../../../docs/architecture/9-architecture-decisions-adrs.md)
- **Hexagonal Architecture Guide:** [docs/hexagonal-architecture.md](../../../docs/hexagonal-architecture.md)

---

## 🛠️ Commands

```bash
# Domain Layer Tests (framework-agnostisch)
pnpm --filter @bluelight-hub/backend test:domain

# Circular Dependency Check
pnpm --filter @bluelight-hub/backend check:deps

# TypeScript Compilation (Domain Layer only)
tsc --noEmit --project tsconfig.json

# Linting (Biome)
pnpm lint

# Coverage
pnpm --filter @bluelight-hub/backend test:cov
```

---

**Fragen?** Siehe [CLAUDE.md](../../../../CLAUDE.md) für weitere Konventionen oder kontaktiere das Team.
