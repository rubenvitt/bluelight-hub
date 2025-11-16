# Einsatz Aggregate - Implementation Guide

**Story:** Epic 1 | Story 1-3
**Status:** ✅ Implemented
**Coverage:** 98.02% Line Coverage

---

## 📋 Overview

Das **Einsatz Aggregate** ist die zentrale Business-Entität für Emergency Response Management im Bluelight Hub.
Es implementiert die vollständige DDD Aggregate Pattern mit State Machine, NO-DELETE Policy und Event Sourcing.

**Komponenten:**
- **Aggregate Root:** `Einsatz` (packages/backend/src/domain/aggregates/einsatz.aggregate.ts:109-568)
- **Value Objects:** `EinsatzId`, `UserId`, `EinsatzStatus`, `Address`
- **Domain Events:** `EinsatzCreatedEvent`, `EinsatzCompletedEvent`, `EinsatzArchivedEvent`, `EinsatzStatusChangedEvent`
- **Repository Interface:** `IEinsatzRepository` (Port für Persistence)

---

## 🏗️ Architecture Pattern

### State Machine

```
┌──────────┐     complete()      ┌──────────────┐     archive()     ┌────────────┐
│ ANGELEGT │ ───────────────────→│ ABGESCHLOSSEN│ ─────────────────→│ ARCHIVIERT │
└──────────┘                     └──────────────┘                   └────────────┘
     │                                   │                                 │
     │ archive()                         │                                 │
     └───────────────────────────────────┴─────────────────────────────────┘
                                                                     (Final State)

Transitions:
✅ ANGELEGT → IN_BEARBEITUNG, ABGESCHLOSSEN, ARCHIVIERT
✅ IN_BEARBEITUNG → ABGESCHLOSSEN, ARCHIVIERT
✅ ABGESCHLOSSEN → ARCHIVIERT
❌ ARCHIVIERT → (keine Transitions - finale Immutability)
```

### Business Rules (Invarianten)

1. **Status-Transition nur vorwärts** - Keine Rückwärts-Transitions erlaubt
2. **NO-DELETE Policy** - Einsätze können NIEMALS gelöscht werden (DRK 10-Jahres-Aufbewahrungspflicht)
3. **Archival Immutability** - Archivierte Einsätze sind komplett immutable
4. **Event Emission** - Jede State-Änderung emittiert Domain Events
5. **Auto-Generated Nummer** - Format `E{YEAR}-{NANOID-6}` (z.B. "E2025-A1B2C3")

---

## 💻 Code Examples

### 1. Einsatz.create() Factory

```typescript
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { UserId } from '@domain/value-objects/user-id';
import { Address } from '@domain/value-objects/address';

// Minimales Beispiel (nur Pflichtfelder)
const createdBy = UserId.create().value!;
const result = Einsatz.create({
  alarmstichwort: 'Brand Gebäude',
  createdBy,
});

if (result.isSuccess) {
  const einsatz = result.value!;
  console.log(einsatz.nummer);        // "E2025-A1B2C3" (auto-generated)
  console.log(einsatz.alarmstichwort); // "Brand Gebäude"
  console.log(einsatz.status.value);   // "ANGELEGT"
  console.log(einsatz.getDomainEvents().length); // 1 (EinsatzCreatedEvent)
}

// Vollständiges Beispiel (mit optionalen Feldern)
const address = Address.create({
  strasse: 'Hauptstr.',
  hausnummer: '42',
  plz: '80331',
  ort: 'München',
}).value!;

const fullResult = Einsatz.create({
  alarmstichwort: 'Wohnungsbrand',
  createdBy,
  einsatzort: address,
  bemerkung: 'Mehrere Personen vermisst, Dachstuhl brennt',
});

if (fullResult.isSuccess) {
  const einsatz = fullResult.value!;
  console.log(einsatz.einsatzort?.toString()); // "Hauptstr. 42, 80331 München"
  console.log(einsatz.bemerkung);              // "Mehrere Personen vermisst..."
}

// Validation Fehler
const invalidResult = Einsatz.create({
  alarmstichwort: '',  // ❌ Empty string
  createdBy,
});
console.log(invalidResult.isFailure); // true
console.log(invalidResult.error);     // "Alarmstichwort ist erforderlich"
```

### 2. Status Transitions (complete/archive)

```typescript
// Given: Ein aktiver Einsatz
const createdBy = UserId.create().value!;
const einsatz = Einsatz.create({
  alarmstichwort: 'Verkehrsunfall',
  createdBy,
}).value!;

console.log(einsatz.status.value); // "ANGELEGT"

// When: Einsatz abschließen
const userId = UserId.create().value!;
const completeResult = einsatz.complete(userId);

if (completeResult.isSuccess) {
  console.log(einsatz.status.value);       // "ABGESCHLOSSEN"
  console.log(einsatz.abgeschlossenAt);    // Date (2025-11-14T14:23:45.678Z)
  console.log(einsatz.getDomainEvents().length); // 3 events
  // [EinsatzCreatedEvent, EinsatzCompletedEvent, EinsatzStatusChangedEvent]
}

// When: Einsatz archivieren (finale Transition)
const archiveResult = einsatz.archive(userId);

if (archiveResult.isSuccess) {
  console.log(einsatz.status.value);    // "ARCHIVIERT"
  console.log(einsatz.archivedAt);      // Date
  console.log(einsatz.getDomainEvents().length); // 5 events
  // [...previous events, EinsatzArchivedEvent, EinsatzStatusChangedEvent]
}

// Then: Archivierte Einsätze sind immutable
const failResult = einsatz.complete(userId);
console.log(failResult.isFailure); // true
console.log(failResult.error);     // "Archivierte Einsätze können nicht abgeschlossen werden"

const updateResult = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
console.log(updateResult.isFailure); // true
console.log(updateResult.error);     // "Archivierte Einsätze können nicht geändert werden"
```

### 3. Event Emission Pattern

```typescript
// Events werden automatisch beim create() emittiert
const einsatz = Einsatz.create({
  alarmstichwort: 'Großbrand',
  createdBy: UserId.create().value!,
}).value!;

// Event 1: EinsatzCreatedEvent
const events = einsatz.getDomainEvents();
console.log(events.length); // 1
console.log(events[0].constructor.name); // "EinsatzCreatedEvent"
console.log(events[0].eventId);          // "X1Y2Z3..." (Nanoid)
console.log(events[0].occurredAt);       // Date

// Business Operations emittieren weitere Events
einsatz.complete(UserId.create().value!);

// Event 2 + 3: EinsatzCompletedEvent + EinsatzStatusChangedEvent
const allEvents = einsatz.getDomainEvents();
console.log(allEvents.length); // 3
console.log(allEvents[1].constructor.name); // "EinsatzCompletedEvent"
console.log(allEvents[2].constructor.name); // "EinsatzStatusChangedEvent"

// Event Clearing (Infrastructure Layer nach Publishing)
const eventsToPublish = einsatz.getDomainEvents(); // Shallow copy!
einsatz.clearDomainEvents();
console.log(einsatz.getDomainEvents().length); // 0 (cleared)
console.log(eventsToPublish.length);            // 3 (original copy)
```

### 4. Repository Interface Usage

```typescript
import { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import { EinsatzId } from '@domain/value-objects/einsatz-id';

// Infrastructure Layer implementiert IEinsatzRepository
// Application Layer nutzt das Interface (Dependency Inversion!)

class CreateEinsatzCommandHandler {
  constructor(
    private readonly repository: IEinsatzRepository // Port injection!
  ) {}

  async execute(command: CreateEinsatzCommand): Promise<Result<void>> {
    // 1. Create Aggregate (Domain Logic)
    const einsatzResult = Einsatz.create({
      alarmstichwort: command.alarmstichwort,
      createdBy: command.userId,
      einsatzort: command.einsatzort,
      bemerkung: command.bemerkung,
    });

    if (einsatzResult.isFailure) {
      return Result.fail(einsatzResult.error);
    }

    const einsatz = einsatzResult.value!;

    // 2. Persist via Repository Port
    const saveResult = await this.repository.save(einsatz);
    if (saveResult.isFailure) {
      return Result.fail(saveResult.error);
    }

    // 3. Publish Events (Infrastructure Layer handles this)
    // Domain Layer ist framework-agnostisch!

    return Result.ok();
  }
}

// Repository Query Examples
class GetEinsatzQueryHandler {
  constructor(private readonly repository: IEinsatzRepository) {}

  // Find by ID
  async getById(id: EinsatzId): Promise<Result<Einsatz | null>> {
    return await this.repository.findById(id);
  }

  // Find active (Status !== ARCHIVIERT)
  async getActive(): Promise<Result<Einsatz[]>> {
    return await this.repository.findActive();
  }

  // Find by Business Key (Nummer)
  async getByNummer(nummer: string): Promise<Result<Einsatz | null>> {
    return await this.repository.findByNummer(nummer);
  }

  // Check existence
  async exists(id: EinsatzId): Promise<Result<boolean>> {
    return await this.repository.exists(id);
  }
}
```

---

## 🧪 Testing Examples

### Unit Tests (Story 1-3)

```typescript
describe('Einsatz Aggregate', () => {
  describe('create', () => {
    it('should create Einsatz with auto-generated nummer', () => {
      // Given
      const user = UserId.create().value!;

      // When
      const result = Einsatz.create({
        alarmstichwort: 'Test',
        createdBy: user,
      });

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.nummer).toMatch(/^E\d{4}-[A-Za-z0-9_-]{6}$/);
    });
  });

  describe('complete', () => {
    it('should transition to ABGESCHLOSSEN and emit events', () => {
      // Given
      const user = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Test', createdBy: user }).value!;

      // When
      const result = einsatz.complete(user);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(einsatz.status.value).toBe('ABGESCHLOSSEN');
      expect(einsatz.abgeschlossenAt).toBeDefined();
      expect(einsatz.getDomainEvents()).toHaveLength(3); // Created + Completed + StatusChanged
    });
  });

  describe('NO-DELETE Policy', () => {
    it('should NEVER allow deletion', () => {
      // Given
      const einsatz = Einsatz.create({
        alarmstichwort: 'Test',
        createdBy: UserId.create().value!
      }).value!;

      // Then: IMMER false, unabhängig von Status
      expect(einsatz.canBeDeleted()).toBe(false); // ANGELEGT

      einsatz.complete(UserId.create().value!);
      expect(einsatz.canBeDeleted()).toBe(false); // ABGESCHLOSSEN

      einsatz.archive(UserId.create().value!);
      expect(einsatz.canBeDeleted()).toBe(false); // ARCHIVIERT
    });
  });
});
```

### Integration Tests (Story 1-3)

```typescript
describe('Einsatz Integration Tests', () => {
  let repository: InMemoryEinsatzRepository;

  beforeEach(() => {
    repository = new InMemoryEinsatzRepository();
  });

  it('should execute full lifecycle: create → save → complete → archive → persist', async () => {
    // Given: Create Einsatz
    const user = UserId.create().value!;
    const einsatz = Einsatz.create({
      alarmstichwort: 'Integration Test',
      createdBy: user,
    }).value!;

    // When: Save to repository
    await repository.save(einsatz);

    // Then: Can retrieve by ID
    const findResult1 = await repository.findById(einsatz.id);
    expect(findResult1.value!.status.value).toBe('ANGELEGT');

    // When: Complete Einsatz
    findResult1.value!.complete(user);
    await repository.save(findResult1.value!);

    // Then: Status updated
    const findResult2 = await repository.findById(einsatz.id);
    expect(findResult2.value!.status.value).toBe('ABGESCHLOSSEN');

    // When: Archive Einsatz
    findResult2.value!.archive(user);
    await repository.save(findResult2.value!);

    // Then: Final state ARCHIVIERT
    const findResult3 = await repository.findById(einsatz.id);
    expect(findResult3.value!.status.value).toBe('ARCHIVIERT');
  });
});
```

---

## 📊 Test Coverage

**Gesamt Domain Layer Coverage (Story 1-3):**
- **Statements:** 96.31%
- **Branches:** 89.02%
- **Functions:** 97.22%
- **Lines:** 98.02% ✅

**Einsatz Aggregate Coverage:**
- **Lines:** 97.26% (2 uncovered defensive error paths)
- **Tests:** 79 Unit Tests + 19 Integration Tests = **98 Tests total** ✅

**Files:**
- `einsatz.aggregate.spec.ts` - 79 tests (0.162s)
- `einsatz.integration.spec.ts` - 19 tests (0.18s)
- `einsatz.events.spec.ts` - 39 tests (Event testing)
- `einsatz-status.spec.ts` - 53 tests (State Machine)
- `address.spec.ts` - 46 tests (Value Object)

---

## 🔗 Related Components

### Value Objects
- **EinsatzId** (packages/backend/src/domain/value-objects/einsatz-id.ts:1-84)
  - Type-safe Nanoid-based ID
  - 30 Unit Tests

- **UserId** (packages/backend/src/domain/value-objects/user-id.ts:1-84)
  - Type-safe User identifier
  - 32 Unit Tests

- **EinsatzStatus** (packages/backend/src/domain/value-objects/einsatz-status.ts:60-201)
  - State Machine Value Object
  - Transitions validation via `canTransitionTo()`
  - 53 Unit Tests

- **Address** (packages/backend/src/domain/value-objects/address.ts:49-166)
  - German address format with PLZ validation
  - 46 Unit Tests

### Domain Events
- **EinsatzCreatedEvent** (packages/backend/src/domain/events/einsatz-created.event.ts:1-67)
- **EinsatzCompletedEvent** (packages/backend/src/domain/events/einsatz-completed.event.ts:1-65)
- **EinsatzArchivedEvent** (packages/backend/src/domain/events/einsatz-archived.event.ts:1-65)
- **EinsatzStatusChangedEvent** (packages/backend/src/domain/events/einsatz-status-changed.event.ts:1-72)

### Repository Interface
- **IEinsatzRepository** (packages/backend/src/domain/repositories/ieinsatz.repository.ts:47-196)
  - Port für Persistence (Hexagonal Architecture)
  - Methods: `save()`, `findById()`, `findActive()`, `findByNummer()`, `exists()`
  - **NO** `delete()` method (NO-DELETE Policy enforcement)

---

## 🚀 Next Steps (Epic 4)

Die Infrastructure Layer Implementation (PrismaEinsatzRepository) erfolgt in **Epic 4**:

1. **Prisma Repository Adapter** - Implementiert `IEinsatzRepository`
2. **Domain ↔ Prisma Mapper** - Konvertierung zwischen Domain Aggregates und Prisma Models
3. **Event Outbox Pattern** - Transaktional konsistente Event Publishing
4. **Application Layer Use Cases** - Command/Query Handlers orchestrieren Aggregates + Repository

**Referenz:** Epic 4 | Story 4-1 "Infrastructure Layer - Repository Implementation"

---

## 📚 Documentation Links

- **Story:** [1-3-einsatz-aggregate-value-objects.md](.bmad-ephemeral/stories/1-3-einsatz-aggregate-value-objects.md)
- **Tech Spec:** [tech-spec-epic-1.md](.bmad-ephemeral/stories/tech-spec-epic-1.md)
- **Architecture:** [docs/architecture/9-architecture-decisions-adrs.md](../../../../docs/architecture/9-architecture-decisions-adrs.md)
- **PRD:** [docs/prds/276-hexagonale-architektur.md](../../../../docs/prds/276-hexagonale-architektur.md)

---

**Implementiert in:** Epic 1 | Story 1-3 (2025-01-13 bis 2025-01-14)
**Coverage:** 98.02% Line Coverage ✅
**Circular Dependencies:** 0 ✅
**TypeScript Compilation:** ✅ No Errors
