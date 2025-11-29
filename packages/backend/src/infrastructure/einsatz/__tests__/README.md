# Einsatz E2E Integration Tests

Dieser Ordner enthält End-to-End Integration Tests für das Einsatz-Modul. Die Tests validieren das Zusammenspiel von Domain Layer, Application Layer und Infrastructure Layer gegen eine echte PostgreSQL Datenbank.

## 📋 Übersicht

**Test-Strategie:**
- **Real Database**: PostgreSQL 17 (KEINE Mocks!)
- **Direct Handler Invocation**: CQRS Handlers direkt aufrufen
- **Given-When-Then BDD**: Strukturierter Test-Stil
- **RBAC Testing**: 3 User-Rollen (USER, ADMIN, SUPER_ADMIN)
- **Outbox Pattern**: Event Publishing Verification
- **Performance Baselines**: Kritische Operationen monitoren

**Warum E2E Tests?**
- Validieren vollständige Persistierung über alle Layer hinweg
- Testen echte PostgreSQL Constraints und Triggers
- Verifizieren Domain Events und Event Handler Integration
- Prüfen RBAC-Constraints (Autorisierung)
- Performance Baselines für kritische Operationen
- Outbox Pattern Integration (Event Sourcing)

## 🎯 Test-Coverage

### Implementierte Test-Suites

| Test File | Acceptance Criteria | Beschreibung |
|-----------|-------------------|--------------|
| `outbox-integration.e2e.spec.ts` | AC1.1-1.7 | Outbox Pattern & Event Publishing |
| `no-delete-policy.e2e.spec.ts` | AC2.1-2.5 | NO-DELETE Policy Enforcement |
| `rbac-constraints.e2e.spec.ts` | AC3.1-3.4 | RBAC Authorization Tests |
| `einsatz-performance.e2e.spec.ts` | AC4.1-4.4 | Performance Baselines |
| `einsatz-controller.e2e.spec.ts` | AC5.1, 5.3, 5.4 | HTTP REST Integration |
| `auth-controller.e2e.spec.ts` | AC5.2 | Authentication HTTP Integration |

### Acceptance Criteria Mapping

**AC1 - Outbox Integration (1.1-1.7):**
- Einsatz-Events werden in Outbox persistiert
- PENDING Events werden korrekt tracked
- Event Publish Workflow funktioniert
- Retry Mechanism funktioniert
- Concurrent Publishing wird gehandelt
- Publishing Status wird aktualisiert
- Outbox Cleanup funktioniert

**AC2 - NO-DELETE Policy (2.1-2.5):**
- DELETE-Operationen werden blockiert
- Soft-Delete Flag wird verwendet
- isDeleted wird in Queries berücksichtigt
- Policy ist DRK-konform
- PostgreSQL Trigger enforcement

**AC3 - RBAC Constraints (3.1-3.4):**
- USER kann nur eigene Einsätze ändern
- ADMIN kann alle Einsätze ändern
- SUPER_ADMIN hat maximale Rechte
- Unauthorized Operationen werden blockiert

**AC4 - Performance (4.1-4.4):**
- List Active Einsätze: < 55ms
- Get Einsatz Details: < 88ms
- Create Einsatz: < 165ms
- Combined Query Overhead: < 50ms

**AC5 - HTTP Integration (5.1-5.4):**
- REST Endpoints funktionieren
- Authentication via JWT funktioniert
- Response Format ist konsistent
- Error Handling ist korrekt

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
NODE_ENV="test"
```

## 🚀 Tests Ausführen

```bash
# Alle E2E Tests ausführen
pnpm --filter @bluelight-hub/backend test:e2e

# Nur Einsatz E2E Tests
pnpm --filter @bluelight-hub/backend test:e2e einsatz

# Spezifischer Test File
pnpm --filter @bluelight-hub/backend test:e2e outbox-integration

# Mit Coverage
pnpm --filter @bluelight-hub/backend test:e2e --coverage

# Watch Mode (für Entwicklung)
pnpm --filter @bluelight-hub/backend test:e2e --watch einsatz
```

## 📦 Test Infrastructure (`einsatz.e2e-setup.ts`)

### Core Utilities

#### 1. `createEinsatzE2eModule()`

Factory-Funktion die vollständigen Test-Kontext erstellt:

```typescript
let ctx: EinsatzE2eTestContext;

beforeAll(async () => {
  ctx = await createEinsatzE2eModule();
  // ctx enthält:
  // - prisma: PrismaClient für direkte DB-Zugriffe
  // - repository: PrismaEinsatzRepository (real implementation)
  // - outboxRepository: PrismaOutboxRepository
  // - eventPublisher: SpyEventPublisher (Event Tracking)
  // - testUserIds: { user, admin, superAdmin } - CUID2 Format
  // - testRunId: Unique Timestamp für Test Isolation
});
```

**Was passiert intern:**
1. PrismaClient wird erstellt
2. Alte Test-Daten (> 1 Stunde) werden aufgeräumt
3. Drei Test User werden angelegt (USER, ADMIN, SUPER_ADMIN)
4. Repository und SpyEventPublisher werden instanziert
5. Outbox Repository wird initialized

#### 2. `cleanupTestData(ctx)`

Nach jedem Test aufrufen (afterEach):

```typescript
afterEach(async () => {
  await cleanupTestData(ctx);
  // - Löscht Einsatz-Daten (Lagekarten, ETB, Outbox, Einsätze)
  // - Behält Users für weitere Tests
  // - Cleared EventPublisher Spy
});
```

#### 3. `teardownE2eModule(ctx)`

Nach allen Tests aufrufen (afterAll):

```typescript
afterAll(async () => {
  await teardownE2eModule(ctx);
  // - Löscht ALLE Test-Daten (inkl. Users)
  // - Schließt DB-Verbindung
  // - Cleanup mit disabled Triggers
});
```

### Test Helpers

#### `generateTestId()`

Generiert CUID2-Format IDs für alle Entity Types:

```typescript
const einsatzId = generateTestId(); // "clocq1tpv0000..."
const userId = generateTestId(); // Gleiches Format!
const eventId = generateTestId(); // Gleiches Format!
```

#### `createTestEinsatz(ctx, options?)`

Erstellt einen separaten Test-Einsatz:

```typescript
it('should work with separate Einsatz', async () => {
  const einsatzId = await createTestEinsatz(ctx, {
    status: 'IN_BEARBEITUNG',
    createdBy: ctx.testUserIds.admin,
  });
  // Nutze einsatzId für Test
});
```

**Options Interface:**
```typescript
interface CreateTestEinsatzOptions {
  status?: 'ANGELEGT' | 'IN_BEARBEITUNG' | 'ABGESCHLOSSEN' | 'ARCHIVIERT';
  createdBy?: string;
  alarmstichwort?: string;
  archivedAt?: Date;
}
```

#### `createTestUser(ctx, role, username?)`

Erstellt einen Test-User mit spezifischer Rolle:

```typescript
it('should handle multiple users', async () => {
  const extraAdminId = await createTestUser(ctx, 'ADMIN');
  // ... test logic
});
```

#### `createTestOutboxEvent(ctx, options?)`

Erstellt ein Test-Outbox-Event:

```typescript
it('should publish pending outbox events', async () => {
  const eventId = await createTestOutboxEvent(ctx, {
    eventName: 'einsatz.created',
    status: 'PENDING',
  });
  // ... test logic
});
```

#### `waitFor(assertion, timeout?, interval?)`

Pollt asynchrone Assertions (für Event Handler):

```typescript
it('should emit event', async () => {
  await createHandler.execute(command);

  await waitFor(async () => {
    const events = ctx.eventPublisher.getEventsByName('einsatz.created');
    expect(events).toHaveLength(1);
  }, 500, 50); // 500ms timeout, 50ms interval
});
```

#### `cleanupEinsatzById(ctx, einsatzId)`

Cleanup für spezifischen Einsatz (inkl. Dependencies):

```typescript
it('should clean up after test', async () => {
  const einsatzId = await createTestEinsatz(ctx);
  // ... test logic
  await cleanupEinsatzById(ctx, einsatzId);
});
```

### SpyEventPublisher

Mock-Implementation von `IEventPublisher` für Event Verification:

```typescript
// Events publishen (automatisch durch Repository)
await ctx.repository.save(aggregate);

// Events abrufen und verifizieren
const events = ctx.eventPublisher.getEventsByName('einsatz.created');
expect(events).toHaveLength(1);
expect(events[0].payload.alarmstichwort).toBe('Brand');

// Events clearen (in afterEach)
ctx.eventPublisher.clear();
```

## 🔒 Test Isolation Pattern

### Problem: DRK Compliance Triggers

PostgreSQL Triggers blockieren physisches DELETE. Tests müssen aber Daten aufräumen.

### Lösung: Session Replication Role

```typescript
// Trigger temporär deaktivieren
await ctx.prisma.$executeRawUnsafe('SET session_replication_role = replica;');

try {
  // DELETE-Operationen ausführen
  await ctx.prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE ...');
} finally {
  // IMMER re-enablen!
  await ctx.prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
}
```

**Wichtig:**
- `cleanupTestData()` und `teardownE2eModule()` nutzen dieses Pattern automatisch
- In Produktion NIEMALS `session_replication_role` ändern!
- Pattern ist dokumentiert in `no-delete-policy.e2e.spec.ts`

### Constants

```typescript
import { DISABLE_TRIGGERS_SQL, ENABLE_TRIGGERS_SQL } from './einsatz.e2e-setup';

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
  createEinsatzE2eModule,
  teardownE2eModule,
  cleanupTestData,
  type EinsatzE2eTestContext,
} from './einsatz.e2e-setup';

describe('Einsatz Feature - E2E Tests', () => {
  let ctx: EinsatzE2eTestContext;

  beforeAll(async () => {
    ctx = await createEinsatzE2eModule();
  });

  afterEach(async () => {
    await cleanupTestData(ctx);
  });

  afterAll(async () => {
    await teardownE2eModule(ctx);
  });

  describe('Scenario: Create Einsatz', () => {
    it('should create Einsatz successfully', async () => {
      // Given: Command vorbereiten
      const command = CreateEinsatzCommand.create({
        alarmstichwort: 'Brand',
        einsatzort: 'Hauptstraße 1',
      }, ctx.testUserIds.user).value!;

      // When: Handler ausführen
      const result = await createHandler.execute(command);

      // Then: Assertions
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();

      // Verify: Persistierung prüfen
      const einsatz = await ctx.repository.findById(result.value!);
      expect(einsatz).not.toBeNull();
      expect(einsatz!.status.value).toBe('ANGELEGT');
    });

    it('should emit einsatz.created event', async () => {
      // Given
      const command = CreateEinsatzCommand.create({
        alarmstichwort: 'Brand',
      }, ctx.testUserIds.user).value!;

      // When
      await createHandler.execute(command);

      // Then: Event Verification mit waitFor
      await waitFor(async () => {
        const events = ctx.eventPublisher.getEventsByName('einsatz.created');
        expect(events).toHaveLength(1);
      });
    });
  });
});
```

### RBAC Test Pattern

```typescript
it('should allow ADMIN to update any Einsatz', async () => {
  // Given: Einsatz created by USER
  const einsatzId = await createTestEinsatz(ctx, {
    createdBy: ctx.testUserIds.user,
  });

  // When: ADMIN updates
  const command = UpdateEinsatzCommand.create({
    id: einsatzId,
    einsatzort: 'Neue Adresse',
  }, ctx.testUserIds.admin).value!;
  const result = await updateHandler.execute(command);

  // Then
  expect(result.isSuccess).toBe(true);
});

it('should deny USER to archive other users Einsatz', async () => {
  // Given: Einsatz created by ADMIN
  const einsatzId = await createTestEinsatz(ctx, {
    createdBy: ctx.testUserIds.admin,
  });

  // When: USER tries to archive
  const command = ArchiveEinsatzCommand.create(
    einsatzId,
    ctx.testUserIds.user
  ).value!;
  const result = await archiveHandler.execute(command);

  // Then
  expect(result.isFailure).toBe(true);
  expect(result.error).toContain('Unauthorized');
});
```

### Outbox Integration Test Pattern

```typescript
it('should store events in outbox', async () => {
  // Given
  const command = CreateEinsatzCommand.create({
    alarmstichwort: 'Brand',
  }, ctx.testUserIds.user).value!;

  // When
  const result = await createHandler.execute(command);

  // Then: Verify outbox persistence
  const outboxEvents = await ctx.outboxRepository.findPendingEvents(10);
  expect(outboxEvents.length).toBeGreaterThan(0);

  const einsatzCreatedEvent = outboxEvents.find(
    e => e.eventName === 'einsatz.created'
  );
  expect(einsatzCreatedEvent).toBeDefined();
  expect(einsatzCreatedEvent!.status).toBe('PENDING');
  expect(einsatzCreatedEvent!.aggregateId).toBe(result.value!);
});
```

## 📊 Performance Baselines

Aus `einsatz-performance.e2e.spec.ts`:

| Operation | Baseline | Tolerance | Test Threshold | Beschreibung |
|-----------|----------|-----------|----------------|--------------|
| List Active Einsätze | 50ms | ±10% | 55ms | Abfrage aller aktiven Einsätze |
| Get Einsatz Details | 80ms | ±10% | 88ms | Einzelne Einsatz mit Details laden |
| Create Einsatz | 150ms | ±10% | 165ms | Neuen Einsatz erstellen |
| Combined Query Overhead | - | - | <50ms | Overhead bei mehreren Queries |
| Outbox Publish Latency | - | - | <7000ms | Event Publishing im Outbox Pattern |

**Hinweis:** Baselines sind Guidelines, keine Hard Limits. CI/CD Pipeline kann langsamer sein als lokale Dev-Umgebung.

## 🧪 Best Practices

### ✅ DO

- **Given-When-Then** Struktur in allen Tests verwenden
- `ctx.eventPublisher.clear()` zwischen Test-Steps aufrufen
- `cleanupTestData()` in `afterEach()` aufrufen
- `teardownE2eModule()` in `afterAll()` aufrufen
- `waitFor()` für asynchrone Event Handler nutzen
- Descriptive Test-Namen mit "should ..." Format
- Database-Persistierung explizit verifizieren
- Verschiedene User-Rollen (USER, ADMIN, SUPER_ADMIN) testen
- Outbox Integration Tests durchführen
- Performance Baselines monitoren

### ❌ DON'T

- NICHT `session_replication_role` manuell ändern (nutze Setup-Utilities!)
- NICHT Test-Daten manuell löschen (nutze `cleanupTestData()`)
- NICHT Events zwischen Tests akkumulieren (clear() aufrufen!)
- NICHT direkt `ctx.prisma.$disconnect()` aufrufen (nutze `teardownE2eModule()`)
- NICHT mehrere Test Contexts gleichzeitig erstellen (Race Conditions!)
- NICHT Produktions-Daten in Tests verwenden

## 🔍 Debugging

### DB-Zustand inspizieren

```typescript
it('debug test', async () => {
  // Snapshot der DB-Daten
  const einsaetze = await ctx.prisma.einsatz.findMany({
    where: { createdBy: ctx.testUserIds.user },
    include: {
      lagekarte: true,
      etb: true,
    },
  });
  console.log(JSON.stringify(einsaetze, null, 2));
});
```

### Event Publisher State

```typescript
it('debug events', async () => {
  // Alle Events anzeigen
  console.log('Published Events:', ctx.eventPublisher.publishedEvents);

  // Events nach Namen
  const createdEvents = ctx.eventPublisher.getEventsByName('einsatz.created');
  console.log('Created Events:', createdEvents);
});
```

### Outbox State

```typescript
it('debug outbox', async () => {
  // Alle Outbox Events
  const allEvents = await ctx.outboxRepository.findPendingEvents(100);
  console.log('Outbox Events:', allEvents);

  // Spezifische Einsatz Events
  const einsatzEvents = allEvents.filter(
    e => e.aggregateId === 'some-einsatz-id'
  );
  console.log('Einsatz Events:', einsatzEvents);
});
```

### Prisma Studio

```bash
# Prisma Studio öffnen (läuft auf Port 3093)
pnpm --filter @bluelight-hub/backend prisma:studio

# DB-Daten live inspizieren während Tests laufen
```

## 🔗 Weitere Ressourcen

- **Story 4-10:** Architecture Migration - Hexagonale Architektur mit DDD
- **Domain Layer:** `/packages/backend/src/domain/`
- **Application Layer:** `/packages/backend/src/application/einsatz/`
- **Repository:** `/packages/backend/src/infrastructure/einsatz/repositories/`
- **Controllers:** `/packages/backend/src/modules/einsatz/controllers/`
- **Prisma Schema:** `/packages/backend/prisma/schema.prisma`
- **Migrations:** `/packages/backend/prisma/migrations/`
- **Arc42 Architektur:** `/docs/architecture/`
- **Development Guide:** `/docs/development-guide/`
- **Compodoc:** `pnpm --filter @bluelight-hub/backend docs:generate` → `http://localhost:8080`

---

**Maintainer:** Siehe `/docs/architecture/` für Architektur-Details (Hexagonale Architektur + DDD + CQRS)
