# ETB E2E Integration Tests

Dieser Ordner enthält End-to-End Integration Tests für das ETB (Einsatztagebuch) Modul. Die Tests validieren das Zusammenspiel von Domain Layer, Application Layer und Infrastructure Layer gegen eine echte PostgreSQL Datenbank.

## 📋 Übersicht

**Test-Strategie:**
- **Real Database**: PostgreSQL 17 (KEINE Mocks!)
- **Direct Handler Invocation**: CQRS Handlers direkt aufrufen
- **Given-When-Then BDD**: Strukturierter Test-Stil
- **DRK Compliance**: NO-DELETE Trigger-Enforcement

**Warum E2E Tests?**
- Validieren vollständige Persistierung über alle Layer hinweg
- Testen echte PostgreSQL Trigger (NO-DELETE Compliance)
- Verifizieren Domain Events und Event Handler Integration
- Prüfen Concurrency (Optimistic Locking)
- Performance Baselines für kritische Operationen

## 🎯 Test-Coverage

### Implementierte Test-Suites

| Test File | Acceptance Criteria | Beschreibung |
|-----------|-------------------|--------------|
| `etb-auto-creation.e2e.spec.ts` | AC1 | ETB Auto-Creation via `EinsatzCreatedEvent` |
| `etb-versioning.e2e.spec.ts` | AC2, AC3 | Versioning & Snapshot-Erstellung |
| `etb-locking.e2e.spec.ts` | AC4 | Lock-Mechanismus & Mutation Prevention |
| `etb-soft-delete.e2e.spec.ts` | AC5 | Soft-Delete Behavior (isDeleted Flag) |
| `etb-drk-compliance.e2e.spec.ts` | AC6, AC7 | NO-DELETE Trigger Enforcement |
| `etb-concurrency.e2e.spec.ts` | AC8 | Optimistic Locking (version-based) |
| `etb-performance.e2e.spec.ts` | AC9 | Performance Baselines |

### Acceptance Criteria Mapping

**AC1 - Auto-Creation:**
- ETB wird automatisch bei Einsatz-Erstellung angelegt
- Event Handler `EtbAutoCreationHandler` wird getestet

**AC2 - Versioning:**
- Jede Mutation erhöht ETB Version
- Snapshots werden bei Änderungen erstellt

**AC3 - Snapshot History:**
- Snapshot-Speicherung in `etb_snapshots` Tabelle
- Historical Queries funktionieren

**AC4 - Lock Prevention:**
- Locked ETB verhindert Mutations (add/update/delete Eintrag)
- Lock-Status wird persistiert

**AC5 - Soft Delete:**
- `isDeleted` Flag statt physischem DELETE
- Soft-deleted Einträge werden in Queries ausgeschlossen

**AC6/AC7 - DRK Compliance:**
- PostgreSQL Trigger `etb_eintrag_no_delete` blockiert DELETE
- PostgreSQL Trigger `einsatz_no_delete` blockiert DELETE
- Exception Message: "DRK Compliance Violation"

**AC8 - Concurrency:**
- Optimistic Locking via `version` Field
- Concurrent Updates werfen Exception

**AC9 - Performance:**
- Baseline: < 100ms für Create ETB
- Baseline: < 50ms für Add Eintrag
- Baseline: < 200ms für 100 Einträge laden

## 🛠️ Voraussetzungen

### 1. PostgreSQL Running

```bash
# Docker Compose starten (inkl. PostgreSQL)
docker-compose up -d

# PostgreSQL läuft auf Port 3092 (Host-Port)
# Connection String in .env:
DATABASE_URL="postgresql://postgres:postgres@localhost:3092/bluelight"
```

### 2. Database Migrations

```bash
# Migrations ausführen (falls noch nicht geschehen)
pnpm --filter @bluelight-hub/backend prisma:migrate

# Prisma Client generieren
pnpm --filter @bluelight-hub/backend prisma:generate
```

### 3. Environment Variables

```bash
# .env im packages/backend/ Verzeichnis:
DATABASE_URL="postgresql://postgres:postgres@localhost:3092/bluelight"
JWT_SECRET="test-secret"
JWT_EXPIRES_IN="1h"
```

## 🚀 Tests Ausführen

```bash
# Alle E2E Tests ausführen
pnpm --filter @bluelight-hub/backend test:e2e

# Nur ETB E2E Tests
pnpm --filter @bluelight-hub/backend test:e2e etb

# Spezifischer Test File
pnpm --filter @bluelight-hub/backend test:e2e etb-drk-compliance

# Mit Coverage
pnpm --filter @bluelight-hub/backend test:e2e --coverage

# Watch Mode (für Entwicklung)
pnpm --filter @bluelight-hub/backend test:e2e --watch etb
```

## 📦 Test Infrastructure (`etb.e2e-setup.ts`)

### Core Utilities

#### 1. `createEtbE2eModule()`

Factory-Funktion die vollständigen Test-Kontext erstellt:

```typescript
let ctx: EtbE2eTestContext;

beforeAll(async () => {
  ctx = await createEtbE2eModule();
  // ctx enthält:
  // - prisma: PrismaClient für direkte DB-Zugriffe
  // - repository: PrismaEtbRepository (real implementation)
  // - eventPublisher: SpyEventPublisher (Event Tracking)
  // - testUserId: CUID2 Format User ID
  // - testEinsatzId: CUID2 Format Einsatz ID
  // - testRunId: Unique Timestamp für Test Isolation
});
```

**Was passiert intern:**
1. PrismaClient wird erstellt
2. Alte Test-Daten (> 1 Stunde) werden aufgeräumt
3. Test User wird angelegt (CUID2 ID)
4. Test Einsatz wird angelegt (CUID2 ID)
5. Repository und SpyEventPublisher werden instanziert

#### 2. `cleanupTestData(ctx)`

Nach jedem Test aufrufen (afterEach):

```typescript
afterEach(async () => {
  await cleanupTestData(ctx);
  // - Löscht ETB-Daten (Snapshots, Einträge, ETBs)
  // - Behält User/Einsatz für weitere Tests
  // - Cleared EventPublisher Spy
});
```

#### 3. `teardownE2eModule(ctx)`

Nach allen Tests aufrufen (afterAll):

```typescript
afterAll(async () => {
  await teardownE2eModule(ctx);
  // - Löscht ALLE Test-Daten (inkl. User/Einsatz)
  // - Schließt DB-Verbindung
  // - Cleanup mit disabled Triggers
});
```

### Test Helpers

#### `generateTestId()`

Generiert CUID2-Format IDs für alle Entity Types:

```typescript
const etbId = generateTestId(); // "clocq1tpv0000..."
const eintragId = generateTestId(); // Gleiches Format!
```

#### `createTestEinsatz(ctx)`

Erstellt einen separaten Test-Einsatz:

```typescript
it('should work with separate Einsatz', async () => {
  const separateEinsatzId = await createTestEinsatz(ctx);
  // Nutze separateEinsatzId für Test
});
```

#### `waitFor(assertion, timeout, interval)`

Pollt asynchrone Assertions (für Event Handler):

```typescript
it('should emit event', async () => {
  await createHandler.execute(command);

  await waitFor(async () => {
    const events = ctx.eventPublisher.getEventsByName('etb.created');
    expect(events).toHaveLength(1);
  }, 500, 50); // 500ms timeout, 50ms interval
});
```

### SpyEventPublisher

Mock-Implementation von `IEventPublisher` für Event Verification:

```typescript
// Events publishen (automatisch durch Repository)
await ctx.repository.save(aggregate);

// Events abrufen und verifizieren
const events = ctx.eventPublisher.getEventsByName('eintrag.added');
expect(events).toHaveLength(1);
expect(events[0].payload.text).toBe('Test Eintrag');

// Events clearen (in afterEach)
ctx.eventPublisher.clear();
```

## 🔒 Test Isolation Pattern

### Problem: DRK Compliance Triggers

PostgreSQL Triggers (`etb_eintrag_no_delete`, `einsatz_no_delete`) blockieren physisches DELETE. Tests müssen aber Daten aufräumen.

### Lösung: Session Replication Role

```typescript
// Trigger temporär deaktivieren
await ctx.prisma.$executeRawUnsafe('SET session_replication_role = replica;');

try {
  // DELETE-Operationen ausführen
  await ctx.prisma.$executeRawUnsafe('DELETE FROM etb_eintraege WHERE ...');
} finally {
  // IMMER re-enablen!
  await ctx.prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
}
```

**Wichtig:**
- `cleanupTestData()` und `teardownE2eModule()` nutzen dieses Pattern automatisch
- In Produktion NIEMALS `session_replication_role` ändern!
- Pattern ist dokumentiert in `etb-drk-compliance.e2e.spec.ts`

### Constants

```typescript
import { DISABLE_TRIGGERS_SQL, ENABLE_TRIGGERS_SQL } from './etb.e2e-setup';

await ctx.prisma.$executeRawUnsafe(DISABLE_TRIGGERS_SQL);
try {
  // Cleanup
} finally {
  await ctx.prisma.$executeRawUnsafe(ENABLE_TRIGGERS_SQL);
}
```

## 📝 Test Template (BDD Style)

### Basis-Struktur

```typescript
import {
  createEtbE2eModule,
  teardownE2eModule,
  cleanupTestData,
  type EtbE2eTestContext,
} from './etb.e2e-setup';

describe('ETB Feature - E2E Tests', () => {
  let ctx: EtbE2eTestContext;

  beforeAll(async () => {
    ctx = await createEtbE2eModule();
  });

  afterEach(async () => {
    await cleanupTestData(ctx);
  });

  afterAll(async () => {
    await teardownE2eModule(ctx);
  });

  describe('Scenario: Create ETB', () => {
    it('should create ETB successfully', async () => {
      // Given: Command vorbereiten
      const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
      const command = CreateEtbCommand.create(einsatzId).value!;

      // When: Handler ausführen
      const result = await createHandler.execute(command);

      // Then: Assertions
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();

      // Verify: Persistierung prüfen
      const etb = await ctx.repository.findByEinsatzId(einsatzId);
      expect(etb).not.toBeNull();
      expect(etb!.status.value).toBe('DRAFT');
    });

    it('should emit etb.created event', async () => {
      // Given
      const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
      const command = CreateEtbCommand.create(einsatzId).value!;

      // When
      await createHandler.execute(command);

      // Then: Event Verification mit waitFor
      await waitFor(async () => {
        const events = ctx.eventPublisher.getEventsByName('etb.created');
        expect(events).toHaveLength(1);
        expect(events[0].payload.einsatzId).toBe(ctx.testEinsatzId);
      });
    });
  });
});
```

### Multi-Step Test (Mit Cleanup zwischen Steps)

```typescript
it('should prevent mutations after lock', async () => {
  // Given: ETB erstellen und Eintrag hinzufügen
  const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
  const userId = UserId.create(ctx.testUserId).value!;

  const createCmd = CreateEtbCommand.create(einsatzId).value!;
  const createResult = await createHandler.execute(createCmd);
  const etbId = createResult.value!;

  const addCmd = AddEintragCommand.create(etbId, 'Initial Entry', userId).value!;
  await addEintragHandler.execute(addCmd);

  // Clear events from setup phase
  ctx.eventPublisher.clear();

  // When: ETB locken
  const lockCmd = LockEtbCommand.create(etbId, userId).value!;
  const lockResult = await lockHandler.execute(lockCmd);
  expect(lockResult.isSuccess).toBe(true);

  // Then: Weitere Mutations schlagen fehl
  const mutateCmd = AddEintragCommand.create(etbId, 'Should Fail', userId).value!;
  const mutateResult = await addEintragHandler.execute(mutateCmd);

  expect(mutateResult.isFailure).toBe(true);
  expect(mutateResult.error).toContain('locked');
});
```

## 🧪 Best Practices

### ✅ DO

- **Given-When-Then** Struktur in allen Tests verwenden
- `ctx.eventPublisher.clear()` zwischen Test-Steps aufrufen
- `cleanupTestData()` in `afterEach()` aufrufen
- `teardownE2eModule()` in `afterAll()` aufrufen
- `waitFor()` für asynchrone Event Handler nutzen
- Descriptive Test-Namen mit "should ..." Format
- Database-Persistierung explizit verifizieren

### ❌ DON'T

- NICHT `session_replication_role` manuell ändern (nutze Setup-Utilities!)
- NICHT Test-Daten manuell löschen (nutze `cleanupTestData()`)
- NICHT Events zwischen Tests akkumulieren (clear() aufrufen!)
- NICHT `testEinsatzId` oder `testUserId` löschen (behalte für weitere Tests)
- NICHT direkt `ctx.prisma.$disconnect()` aufrufen (nutze `teardownE2eModule()`)

## 🔍 Debugging

### DB-Zustand inspizieren

```typescript
it('debug test', async () => {
  // Snapshot der DB-Daten
  const etbs = await ctx.prisma.einsatztagebuch.findMany({
    where: { einsatzId: ctx.testEinsatzId },
    include: {
      eintraege: true,
      snapshots: true,
    },
  });
  console.log(JSON.stringify(etbs, null, 2));
});
```

### Event Publisher State

```typescript
it('debug events', async () => {
  // Alle Events anzeigen
  console.log('Published Events:', ctx.eventPublisher.publishedEvents);

  // Events nach Namen
  const createdEvents = ctx.eventPublisher.getEventsByName('etb.created');
  console.log('Created Events:', createdEvents);
});
```

### Prisma Studio

```bash
# Prisma Studio öffnen (läuft auf Port 3093)
pnpm --filter @bluelight-hub/backend prisma:studio

# DB-Daten live inspizieren während Tests laufen
```

## 📊 Performance Baselines

Aus `etb-performance.e2e.spec.ts`:

| Operation | Baseline | Actual (Beispiel) |
|-----------|----------|-------------------|
| Create ETB | < 100ms | ~30ms |
| Add Eintrag | < 50ms | ~20ms |
| Load 100 Einträge | < 200ms | ~80ms |
| Lock ETB | < 50ms | ~25ms |
| Create Snapshot | < 100ms | ~40ms |

**Hinweis:** Baselines sind Guidelines, keine Hard Limits. CI/CD Pipeline kann langsamer sein als lokale Dev-Umgebung.

## 🔗 Weitere Ressourcen

- **Domain Layer:** `/packages/backend/src/domain/`
- **Application Layer:** `/packages/backend/src/application/etb/`
- **Repository:** `/packages/backend/src/infrastructure/etb/repositories/`
- **Prisma Schema:** `/packages/backend/prisma/schema.prisma`
- **Migrations:** `/packages/backend/prisma/migrations/`
- **Compodoc:** `pnpm --filter @bluelight-hub/backend docs:generate` → `http://localhost:8080`

---

**Maintainer:** Siehe `/docs/architecture/` für Architektur-Details (Hexagonale Architektur + DDD)
