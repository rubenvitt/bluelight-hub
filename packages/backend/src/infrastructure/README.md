# Infrastructure Layer Testing Strategy

Dieses Dokument beschreibt die Test-Strategie für den Infrastructure Layer des Bluelight Hub Backends. Diese Richtlinien dienen als Referenz für Entwickler, die zukünftige Stories in Epic 2-5 (Infrastructure Layer) implementieren.

## Inhaltsverzeichnis

1. [Unit Tests vs. Integration Tests](#unit-tests-vs-integration-tests)
2. [Real Database Pattern](#real-database-pattern)
3. [Deterministische Testdaten](#deterministische-testdaten)
4. [Cleanup-Strategie](#cleanup-strategie)
5. [Epic 1 Testing Patterns (Referenz)](#epic-1-testing-patterns-referenz)

---

## Unit Tests vs. Integration Tests

### Wann Unit Tests verwenden

**Unit Tests** werden verwendet für:

- **Reine Funktionen** ohne externe Abhängigkeiten
- **Stateless Services** die keine externen Ressourcen nutzen
- **Domain Layer** Komponenten (Aggregates, Value Objects, Entities, Events)

**Charakteristika von Unit Tests:**

- Keine NestJS Test Module (`@nestjs/testing`)
- Keine Datenbankverbindungen
- Keine HTTP-Clients oder externe API-Calls
- Keine File System Operationen
- Schnell (<10ms pro Test)
- Isoliert und parallel ausführbar

**Beispiel (Domain Layer):**

```typescript
// ❌ KEIN NestJS Test Module
// ❌ KEINE Database
// ✅ Pure Domain Logic

describe('LagekarteAggregate', () => {
  it('should create Lagekarte with valid einsatzId', () => {
    // Given: Test data
    const einsatzId = EinsatzId.create().value;

    // When: Create Lagekarte
    const result = LagekarteAggregate.create(einsatzId);

    // Then: Success
    expect(result.isSuccess).toBe(true);
    expect(result.value.einsatzId).toBe(einsatzId);
  });
});
```

**Referenz:** [`packages/backend/src/domain/aggregates/lagekarte.aggregate.spec.ts`](/Users/rubeen/dev/personal/bluelight-hub/packages/backend/src/domain/aggregates/lagekarte.aggregate.spec.ts)

---

### Wann Integration Tests verwenden

**Integration Tests** werden verwendet für:

- **Repository-Implementierungen** (Datenbankzugriff)
- **Datenbank-Operationen** (Queries, Migrations, Triggers)
- **External APIs** (HTTP-Calls, OAuth, Third-Party Services)
- **Infrastructure Layer** Komponenten

**Charakteristika von Integration Tests:**

- **Echte PostgreSQL-Datenbank** (KEINE Mocks!)
- NestJS Test Module mit echten Dependencies
- Cleanup nach jedem Test (`afterEach`)
- Langsamer als Unit Tests (100-500ms pro Test)
- Validieren echtes Verhalten der Infrastruktur

**Beispiel (Infrastructure Layer):**

```typescript
// ✅ Echte Database
// ✅ Cleanup via afterEach
// ✅ Database Triggers validieren

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('NO-DELETE Triggers Integration Tests', () => {
  afterAll(async () => {
    // Cleanup via raw SQL mit disabled triggers
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      await prisma.$executeRawUnsafe('DELETE FROM ...');
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
      await prisma.$disconnect();
    }
  });

  it('should prevent direct DELETE on einsatz table', async () => {
    // Given: Einsatz exists in database
    const einsatz = await prisma.einsatz.create({ ... });

    // When: Try to delete via Prisma Client
    const deletePromise = prisma.einsatz.delete({
      where: { id: einsatz.id },
    });

    // Then: Expect DRK Compliance Violation exception
    await expect(deletePromise).rejects.toThrow(/DRK Compliance Violation/);
  });
});
```

**Referenz:** [`packages/backend/src/infrastructure/__tests__/no-delete-triggers.integration.spec.ts`](/Users/rubeen/dev/personal/bluelight-hub/packages/backend/src/infrastructure/__tests__/no-delete-triggers.integration.spec.ts)

---

## Real Database Pattern

### Warum KEINE Mocks für Datenbank-Tests?

**Epic 1 Story 1.8 Pattern:** NIEMALS Datenbank-Operationen mocken!

**Gründe:**

1. **Trigger-Tests erfordern echte DB:** PostgreSQL Triggers feuern NICHT in Mocks
2. **FK-Constraints validieren:** Foreign Key Violations können NUR mit echter DB getestet werden
3. **SQL-Syntax validieren:** Raw SQL Queries müssen gegen echte DB validiert werden
4. **Race Conditions erkennen:** Concurrency-Probleme zeigen sich nur bei echter DB
5. **Realistisches Verhalten:** Mocks simulieren NICHT das echte PostgreSQL-Verhalten

### Test Database Setup

**Verwende Prisma Test Database:**

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
// Verbindet automatisch zu TEST_DATABASE_URL (siehe .env.test)
```

**Environment Variable (`.env.test`):**

```bash
TEST_DATABASE_URL="postgresql://user:password@localhost:3092/bluelight_test"
```

### Cleanup Pattern

**IMMER Cleanup via `afterEach` oder `afterAll`:**

```typescript
afterAll(async () => {
  // Disable Triggers für Cleanup (SUPERUSER required!)
  await prisma.$executeRawUnsafe('SET session_replication_role = replica;');

  try {
    // Delete Test Data (FK-Reihenfolge beachten!)
    await prisma.$executeRawUnsafe('DELETE FROM lagekarte_poi WHERE ...');
    await prisma.$executeRawUnsafe('DELETE FROM lagekarte WHERE ...');
    await prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE ...');
  } finally {
    // Re-enable Triggers
    await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    await prisma.$disconnect();
  }
});
```

**Wichtig:** FK-Constraints Reihenfolge beachten (Child → Parent)!

---

## Deterministische Testdaten

### Warum Deterministische Daten?

**Epic 1 Retrospective Learning:** Flaky Tests durch Non-Deterministic Data verhindert durch:

1. **Fixed Dates:** Verhindert zeitabhängige Test-Failures
2. **Fixed IDs:** Macht Debugging einfacher (bekannte Werte)
3. **Reproduzierbarkeit:** Tests produzieren IMMER gleiche Ergebnisse
4. **Einfachere Fehlersuche:** Stack Traces zeigen bekannte IDs/Timestamps

### Fixed Dates Pattern

**IMMER feste Timestamps verwenden:**

```typescript
// ✅ RICHTIG: Fixed Date
const testDate = new Date('2024-11-17T10:00:00Z');

// ❌ FALSCH: Current Date (non-deterministic!)
const testDate = new Date(); // Ändert sich bei jedem Test Run!
```

**Beispiel (User Integration Tests):**

```typescript
beforeEach(() => {
  // Fixed Timestamps für deterministische Tests
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2024-11-17T10:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});
```

let idCounter = 0;

jest.mock('@paralleldrive/cuid2', () => ({
createId: jest.fn(() => {
idCounter++;
return `test-id-${idCounter.toString().padStart(21, '0')}`; // test-id-000000000000000000001
}),
}));

beforeEach(() => {
idCounter = 0; // Reset für jeden Test
});

**Referenz:** [`packages/backend/src/domain/aggregates/__tests__/user.integration.spec.ts`](/Users/rubeen/dev/personal/bluelight-hub/packages/backend/src/domain/aggregates/__tests__/user.integration.spec.ts) (Zeilen 29-39)

---

## Cleanup-Strategie

### Warum Cleanup nach jedem Test?

**Prevent Test Pollution:**

- Tests MÜSSEN isoliert laufen (kein Shared State!)
- Cleanup verhindert FK-Constraint Violations
- Cleanup verhindert Unique Constraint Violations (z.B. Username Duplikate)

### Cleanup via `afterEach` vs. `afterAll`

**`afterEach`** - Pro Test Cleanup:

```typescript
afterEach(async () => {
  // Cleanup nach JEDEM Test
  await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
  try {
    await prisma.user.deleteMany({}); // Alle User löschen
  } finally {
    await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
  }
});
```

**`afterAll`** - Test Suite Cleanup:

```typescript
afterAll(async () => {
  // Cleanup nach ALLEN Tests in Suite
  await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
  try {
    await prisma.$executeRawUnsafe('DELETE FROM lagekarte_poi WHERE "createdAt" >= NOW() - INTERVAL \'1 hour\'');
  } finally {
    await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    await prisma.$disconnect();
  }
});
```

**Wann was verwenden:**

- **`afterEach`:** Für Unit-ähnliche Tests (schnell, isoliert)
- **`afterAll`:** Für langsame Integration Tests (Setup-Heavy Tests)

### Trigger Bypass für Cleanup

**PostgreSQL Triggers MÜSSEN für Cleanup disabled werden:**

```typescript
// STEP 1: Disable Triggers (benötigt SUPERUSER Rechte!)
await prisma.$executeRawUnsafe('SET session_replication_role = replica;');

try {
  // STEP 2: Delete Test Data (Triggers feuern NICHT)
  await prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE ...');
} finally {
  // STEP 3: Re-enable Triggers (IMMER im finally Block!)
  await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
}
```

**Wichtig:**

- `session_replication_role = replica` disabled ALLE Triggers in dieser Session
- IMMER `DEFAULT` im `finally` Block setzen (auch bei Fehlern!)
- Nur für Test Cleanup verwenden (NIEMALS in Production Code!)

### FK-Constraints Reihenfolge

**Delete Order ist kritisch (Child → Parent):**

```typescript
// ✅ RICHTIG: Child zuerst, dann Parent
await prisma.$executeRawUnsafe('DELETE FROM lagekarte_poi WHERE ...'); // Child
await prisma.$executeRawUnsafe('DELETE FROM lagekarte WHERE ...'); // Parent
await prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE ...'); // Root

// ❌ FALSCH: Parent zuerst (FK Constraint Violation!)
await prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE ...'); // FK Violation: lagekarte.einsatzId → einsaetze.id
```

**Referenz:** [`packages/backend/src/infrastructure/__tests__/no-delete-triggers.integration.spec.ts`](/Users/rubeen/dev/personal/bluelight-hub/packages/backend/src/infrastructure/__tests__/no-delete-triggers.integration.spec.ts) (Zeilen 70-102)

---

## Epic 1 Testing Patterns (Referenz)

### Beispiel 1: Unit Test Pattern (Domain Layer)

**File:** [`packages/backend/src/domain/aggregates/lagekarte.aggregate.spec.ts`](/Users/rubeen/dev/personal/bluelight-hub/packages/backend/src/domain/aggregates/lagekarte.aggregate.spec.ts)

**Pattern:**

- **Given-When-Then BDD Style** für maximale Lesbarkeit
- **Pure Domain Logic** ohne externe Dependencies
- **Keine NestJS Test Module** (`@nestjs/testing`)
- **Keine Database** oder Mocks

**Beispiel-Code:**

```typescript
describe('LagekarteAggregate', () => {
  describe('addPoi Tests', () => {
    it('should add POI with MGRS coordinate', () => {
      // Given: Lagekarte exists
      const lagekarte = LagekarteAggregate.create(testEinsatzId).value;

      // When: Add POI with MGRS
      const result = lagekarte.addPoi('Einsatzstelle', berlinMgrs, testCategory, testUserId);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(lagekarte.pois).toHaveLength(1);
    });

    it('should reject duplicate POI name', () => {
      // Given: POI already exists
      lagekarte.addPoi('Einsatzstelle', berlinMgrs, testCategory, testUserId);

      // When: Add duplicate name
      const result = lagekarte.addPoi('Einsatzstelle', hamburgMgrs, testCategory, testUserId);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already exists');
    });
  });
});
```

**Learnings:**

- BDD Style (`Given-When-Then`) macht Tests selbst-dokumentierend
- Nested `describe` Blöcke gruppieren verwandte Tests
- Jeder Test ist isoliert und unabhängig

---

### Beispiel 2: Integration Test Pattern (Infrastructure Layer)

**File:** [`packages/backend/src/infrastructure/__tests__/no-delete-triggers.integration.spec.ts`](/Users/rubeen/dev/personal/bluelight-hub/packages/backend/src/infrastructure/__tests__/no-delete-triggers.integration.spec.ts)

**Pattern:**

- **Echte PostgreSQL Database** (KEINE Mocks!)
- **Cleanup via `afterAll`** mit disabled Triggers
- **Database Triggers getestet** (Infrastructure Layer Concern)

**Beispiel-Code:**

```typescript
describe('NO-DELETE Triggers Integration Tests', () => {
  let testUserId: string;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    // Setup: Create test user for FK references
    const result = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, 'test-system-user', 'dummy-hash', 'USER', true, NOW(), NOW())
      RETURNING id
    `;
    testUserId = result[0].id;
  });

  afterAll(async () => {
    // Cleanup: Delete test data with disabled triggers
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      await prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE ...');
      await prisma.$executeRawUnsafe('DELETE FROM "User" WHERE username LIKE \'test-%\'');
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
      await prisma.$disconnect();
    }
  });

  it('should prevent direct DELETE on einsatz table', async () => {
    // Given: Einsatz exists in database
    const einsatz = await prisma.einsatz.create({
      data: {
        alarmstichwort: 'B3 - Brand Wohnhaus',
        status: 'ANGELEGT',
        createdBy: testUserId,
        updatedBy: testUserId,
      },
    });

    // When: Try to delete via Prisma Client
    const deletePromise = prisma.einsatz.delete({
      where: { id: einsatz.id },
    });

    // Then: Expect DRK Compliance Violation exception
    await expect(deletePromise).rejects.toThrow(/DRK Compliance Violation/);

    // Verify: Einsatz still exists in database
    const stillExists = await prisma.einsatz.findUnique({
      where: { id: einsatz.id },
    });
    expect(stillExists).not.toBeNull();
  });
});
```

**Learnings:**

- Trigger-Tests erfordern echte Database (Triggers feuern NICHT in Mocks!)
- Cleanup via `afterAll` mit disabled Triggers
- `beforeAll` für Setup (System User für FK References)
- BDD Style auch für Integration Tests (Given-When-Then)

---

### Beispiel 3: Deterministische Testdaten

**File:** [`packages/backend/src/domain/aggregates/__tests__/user.integration.spec.ts`](/Users/rubeen/dev/personal/bluelight-hub/packages/backend/src/domain/aggregates/__tests__/user.integration.spec.ts)

**Pattern:**

- **Fixed Dates** via `jest.setSystemTime()`
- **cuid gemockt** für deterministische IDs
- **In-Memory Repository** für Domain Integration Tests (NO echte DB!)

**Beispiel-Code:**

// Mock für cuid2 (für deterministische Tests)
let idCounter = 0;

jest.mock('@paralleldrive/cuid2', () => ({
createId: jest.fn(() => {
idCounter++;
return `test-id-${idCounter.toString().padStart(21, '0')}`; // test-id-000000000000000000001
}),
}));

beforeEach(() => {
idCounter = 0; // Reset für jeden Test
});

describe('User Integration Tests', () => {
  let repository: InMemoryUserRepository;

  beforeEach(() => {
    repository = new InMemoryUserRepository();
  });

  afterEach(() => {
    repository.clear(); // In-Memory Cleanup (kein DB Cleanup nötig!)
  });

  it('should create user, grant permission, revoke permission with event accumulation', async () => {
    // Given: A new User is created
    const username = Username.create('testuser').value!;
    const user = UserAggregate.create(username, UserRole.USER()).value!;

    // Then: User is created successfully
    expect(user.username.equals(username)).toBe(true);
    expect(user.getDomainEvents()).toHaveLength(1); // UserCreatedEvent

    // When: Granting a custom permission
    const permission = Permission.CREATE_EINSATZ();
    const grantedBy = UserId.create().value!;
    user.grantPermission(permission, grantedBy);

    // Then: PermissionGrantedEvent is emitted
    expect(user.getDomainEvents()).toHaveLength(2); // Created + Granted

    // When: Revoking permission
    user.revokePermission(permission, grantedBy);

    // Then: PermissionRevokedEvent is emitted
    expect(user.getDomainEvents()).toHaveLength(3); // Created + Granted + Revoked
  });
});
```

**Learnings:**

- cuid Mock verhindert Flaky Tests (deterministische IDs)
- In-Memory Repository für Domain Integration Tests (NO Infrastructure Concern!)
- Event Accumulation Tracking (mehrere Events über Operations hinweg)

---

## Zusammenfassung

| Test Typ           | Verwendung                  | Database | NestJS Module | Cleanup       | Beispiel                        |
| ------------------ | --------------------------- | -------- | ------------- | ------------- | ------------------------------- |
| **Unit Test**      | Domain Layer (Pure Logic)   | ❌ NEIN  | ❌ NEIN       | ❌ NICHT nötig | `lagekarte.aggregate.spec.ts`   |
| **Integration Test (Domain)** | Aggregate + Repository      | ❌ In-Memory | ❌ NEIN       | ✅ In-Memory Clear | `user.integration.spec.ts`      |
| **Integration Test (Infra)**  | Infrastructure Layer (DB, Triggers) | ✅ ECHTE DB | ⚠️ Optional  | ✅ `afterAll` mit disabled Triggers | `no-delete-triggers.integration.spec.ts` |

**Best Practices:**

1. ✅ IMMER Given-When-Then BDD Style
2. ✅ IMMER echte Database für Infrastructure Tests (KEINE Mocks!)
3. ✅ IMMER Cleanup via `afterEach` oder `afterAll`
4. ✅ IMMER deterministische Testdaten (Fixed Dates, Fixed IDs)
5. ✅ IMMER Trigger Bypass für Cleanup (`session_replication_role = replica`)
6. ✅ IMMER FK-Constraints Reihenfolge beachten (Child → Parent)
7. ❌ NIEMALS Datenbank-Operationen mocken (Real DB Pattern!)
8. ❌ NIEMALS `new Date()` in Tests (Fixed Dates Pattern!)
9. ❌ NIEMALS Production Datenbank für Tests verwenden (TEST_DATABASE_URL!)

---

**Letzte Aktualisierung:** Epic 1 Story 2-0 Task 4 (Infrastructure Testing Strategy Documentation)

**Nächste Schritte:**

- Epic 2-5: Infrastructure Layer Implementation (Stories 2-1 bis 2-5)
- Repository Pattern Tests (siehe Epic 2 PRD für Details)
