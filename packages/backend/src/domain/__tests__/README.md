# Domain Layer Test Infrastructure

Diese Dokumentation beschreibt die Test-Infrastruktur für den Domain Layer.

## Überblick

Der Domain Layer wird mit **puren Unit-Tests** getestet - **ohne Framework-Dependencies** (Prisma, NestJS).

### Test-Standards (AC 5 & AC 7)

- ✅ **Pure TypeScript Tests**: Keine Framework-Dependencies
- ✅ **Jest 30.x mit SWC**: Schnelle Transformation ohne Babel
- ✅ **AAA Pattern**: Arrange-Act-Assert mit deutschen Kommentaren
- ✅ **Co-located Tests**: Tests in `__tests__/` Ordnern neben dem Code
- ✅ **Domain Events**: Test der Event-Emission bei State-Änderungen

## Verzeichnisstruktur

```
src/domain/
├── __tests__/                    # Zentrale Test-Helpers
│   ├── test-helpers.ts          # Shared utilities für alle Domain Tests
│   ├── README.md                # Diese Datei
│   └── baseline.spec.ts         # Baseline-Test für Setup-Validierung
│
├── aggregates/
│   ├── __tests__/
│   │   ├── fixtures/            # Test-Fixtures für Aggregates
│   │   │   └── etb.fixtures.ts
│   │   ├── einsatz.integration.spec.ts
│   │   ├── lagekarte.integration.spec.ts
│   │   └── ...
│   ├── einsatz.aggregate.ts
│   ├── einsatz.aggregate.spec.ts  # Co-located unit test
│   └── ...
│
├── value-objects/
│   ├── __tests__/               # Optional: Complex value object tests
│   ├── einsatz-status.ts
│   ├── einsatz-status.spec.ts   # Co-located unit test
│   └── ...
│
├── entities/
│   ├── __tests__/
│   ├── poi.entity.ts
│   ├── poi.entity.spec.ts       # Co-located unit test
│   └── ...
│
├── services/
│   ├── __tests__/
│   ├── einsatz-naming.service.ts
│   ├── einsatz-naming.service.spec.ts
│   └── ...
│
├── events/
│   ├── __tests__/
│   ├── einsatz.events.ts
│   ├── einsatz.events.spec.ts
│   └── ...
│
├── common/
│   ├── __tests__/
│   ├── result.ts
│   ├── result.spec.ts
│   └── ...
│
├── exceptions/
│   └── __tests__/               # Neu für Exception Tests
│
├── repositories/
│   └── __tests__/               # Neu für Repository Interface Tests
│
├── ports/
│   └── __tests__/               # Neu für Port Tests
│
└── types/
    └── __tests__/               # Neu für Type Tests
```

## Test-Patterns

### 1. AAA Pattern mit deutschen Kommentaren

```typescript
describe('EinsatzAggregate', () => {
  it('should create Einsatz with valid props', () => {
    // Given: Valid props
    const props = {
      alarmstichwort: 'Wohnungsbrand',
      createdBy: UserId.create().value!,
    };

    // When: Creating Einsatz
    const result = Einsatz.create(props);

    // Then: Success
    expect(result.isSuccess).toBe(true);
    expect(result.value).toBeDefined();
    expect(result.value?.alarmstichwort).toBe('Wohnungsbrand');
  });
});
```

### 2. Test-Helpers für Deterministische Daten

```typescript
import { generateTestCuid, createTestDate, mockCuid2ForJest } from '@domain/__tests__/test-helpers';

// In Test-File Setup:
mockCuid2ForJest();

describe('MyTest', () => {
  it('should use deterministic ID', () => {
    // Given: Deterministic test ID
    const testId = generateTestCuid('user1');

    // When: Creating value object
    const userId = UserId.create(testId);

    // Then: ID is predictable
    expect(userId.value?.value).toBe('clw3h8x9y0000qwertyuuser1');
  });
});
```

### 3. Result Pattern Assertions

```typescript
import { isSuccess, isFailure } from '@domain/__tests__/test-helpers';

describe('ValueObject', () => {
  it('should validate input', () => {
    // Given: Invalid input
    const result = EinsatzStatus.create('INVALID');

    // When: Checking result
    // Then: Should fail
    expect(isFailure(result)).toBe(true);
    if (isFailure(result)) {
      expect(result.error).toContain('Ungültiger Status');
    }
  });
});
```

### 4. Fixtures für komplexe Aggregates

```typescript
import { createTestEtb, createTestEintrag } from '@domain/aggregates/__tests__/fixtures/etb.fixtures';

describe('EinsatztagebuchAggregate', () => {
  it('should handle multiple entries', () => {
    // Given: ETB with 5 entries
    const etb = createTestEtb({ entriesCount: 5 });

    // When: Accessing entries
    const entries = etb.getAllEintraege();

    // Then: 5 entries exist
    expect(entries).toHaveLength(5);
  });
});
```

## Jest-Konfiguration

### Test-Matching Patterns

```javascript
testMatch: [
  '**/domain/**/*.spec.ts',
  '**/infrastructure/**/*.spec.ts',
  '**/application/**/*.spec.ts',
  '**/common/**/*.spec.ts',
]
```

### Module Path Aliases

```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/src/$1',
  '^@domain/(.*)$': '<rootDir>/src/domain/$1',
  '^@application/(.*)$': '<rootDir>/src/application/$1',
  '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
}
```

### Coverage-Anforderungen

```javascript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
}
```

## Test-Commands

```bash
# Alle Domain Tests ausführen
pnpm test:domain

# Mit Watch Mode
pnpm test:watch -- --testPathPattern=domain

# Mit Coverage
pnpm test:cov -- --testPathPattern=domain

# Spezifischer Test-File
pnpm test -- einsatz.aggregate.spec.ts

# Baseline-Test für Setup-Validierung
pnpm test -- baseline.spec.ts
```

## Best Practices

### ✅ DO

- **Co-locate Tests**: Tests direkt neben dem Code oder in `__tests__/`
- **Deterministische Daten**: Nutze Test-Helpers für vorhersagbare IDs/Timestamps
- **AAA Pattern**: Klare Given-When-Then Struktur
- **Deutsche Kommentare**: Given/When/Then auf Deutsch
- **Result Pattern**: Prüfe `isSuccess`/`isFailure` explizit
- **Event Testing**: Validiere emittierte Domain Events
- **Type Safety**: Nutze TypeScript type-guards (isSuccess, isFailure)

### ❌ DON'T

- **Framework Dependencies**: KEINE Prisma, NestJS in Domain Tests
- **Mocking von Domain Logik**: Domain Objects sollten pure sein
- **Hardcoded Timestamps**: Nutze `createTestDate()` oder `mockDateNow()`
- **Unklare Test-Namen**: `it('should work')` → `it('should create Einsatz with valid props')`
- **Test-Interdependenzen**: Jeder Test sollte isoliert laufen

## Troubleshooting

### CUID2 ESM Module Issues

**Problem:** `SyntaxError: Unexpected token 'export'` bei CUID2 Import

**Lösung:** Nutze `mockCuid2ForJest()` in deinem Test-File:

```typescript
import { mockCuid2ForJest } from '@domain/__tests__/test-helpers';

mockCuid2ForJest();

describe('MyTest', () => {
  // Tests hier
});
```

### TypeScript Path Alias Resolution

**Problem:** `Cannot find module '@domain/...'`

**Lösung:** Jest ist bereits konfiguriert für Path Aliases. Prüfe `jest.config.js` → `moduleNameMapper`.

### Test Isolation

**Problem:** Tests beeinflussen sich gegenseitig

**Lösung:** Nutze `beforeEach()` für Setup und `resetTestIdCounter()`:

```typescript
beforeEach(() => {
  resetTestIdCounter();
});
```

## Referenzen

- **Beispiel-Tests:**
  - `/src/domain/aggregates/einsatz.aggregate.spec.ts` - Comprehensive Aggregate Tests
  - `/src/domain/value-objects/einsatz-status.spec.ts` - Value Object Tests
  - `/src/domain/aggregates/__tests__/fixtures/etb.fixtures.ts` - Test Fixtures

- **Test-Helpers:**
  - `/src/domain/__tests__/test-helpers.ts` - Zentrale Utilities

- **Jest Config:**
  - `/jest.config.js` - Test-Konfiguration
