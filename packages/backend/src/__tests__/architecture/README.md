# Architecture Validation Tests

Diese Tests validieren die Clean/Hexagonal Architecture Dependency Rules automatisiert.

## Test Suite Übersicht

### Domain Layer Rules ✅ (5/5 passed)

- ✅ Kein Import von Infrastructure Layer
- ✅ Kein Import von Application Layer
- ✅ Kein Import von Modules/Presentation Layer
- ✅ Keine HTTP-spezifischen NestJS Decorators
- ✅ Kein direkter Prisma Import

**Status:** Alle Domain Layer Rules werden eingehalten.

### Application Layer Rules ⚠️ (2/4 passed)

- ✅ Kein Import von Modules/Presentation Layer
- ✅ Repository Interfaces kommen von `@domain/repositories`
- ⚠️ **Prisma Imports**: Erlaubt in DTOs, Queries, Commands (CQRS Read-Side Optimization)
- ⚠️ **NestJS Decorators**: Verboten sind `@Controller`, `@UseGuards`, etc. in Handlers

**Status:** Hauptregeln werden eingehalten. HTTP-Decorators sind nur in Query/Command Files erlaubt.

### Repository Interfaces ✅ (3/3 passed)

- ✅ Interfaces liegen in `domain/repositories/`
- ✅ KEINE Interfaces in `infrastructure/repositories/` (nur Implementations!)
- ✅ Implementations existieren in Infrastructure oder Modules

**Status:** Repository Pattern wird korrekt verwendet.

### DI Token Constants ❌ (0/2 passed)

- ❌ **Inline String Tokens**: Viele Handler verwenden `@Inject('IEtbRepository')` statt Symbol-Tokens
- ❌ **Missing Imports**: Einige Dateien importieren DI Tokens nicht von `@infrastructure/di-tokens`

**Status:** **MIGRATION TODO** - DI Tokens sollten zu Symbols migriert werden.

**Betroffene Dateien:**
```typescript
// ❌ AKTUELL (String-Literal):
@Inject('IEtbRepository')
private readonly repository: IEtbRepository

// ✅ ZIEL (Symbol-Token):
import { ETB_REPOSITORY } from '@infrastructure/di-tokens';
@Inject(ETB_REPOSITORY)
private readonly repository: IEtbRepository
```

**Warum wichtig:**
- Type Safety: TypeScript kann Symbol Types validieren
- Keine Namenskollisionen: Jedes Symbol ist einzigartig
- IDE-Unterstützung: Autocomplete und Refactoring
- Typo-Sicherheit: Compiler-validierte Token-Namen

### Result Pattern ⚠️ (1/2 passed)

- ⚠️ **Result<T> Return Type**: Einige Handler returnen noch nicht `Promise<Result<T>>`
- ✅ **Exception Handling**: Warning für Exceptions (graduelle Migration)

**Status:** **GRADUAL MIGRATION** - Handler werden schrittweise migriert.

**Betroffene Handlers:**
- `archive-einsatz.handler.ts`
- `complete-einsatz.handler.ts`
- `create-einsatz.handler.ts`
- `update-einsatz.handler.ts`
- `get-active-einsaetze-with-counts.handler.ts`
- `get-lagekarte-exists.handler.ts`

**Migration Pattern:**
```typescript
// ❌ AKTUELL (void/naked type):
async execute(command: CreateEinsatzCommand): Promise<string> {
  const einsatz = await this.repository.create(command);
  return einsatz.id;
}

// ✅ ZIEL (Result Pattern):
async execute(command: CreateEinsatzCommand): Promise<Result<string>> {
  const validation = command.validate();
  if (validation.isFailure) {
    return Result.fail(validation.error);
  }

  const einsatz = await this.repository.create(command);
  return Result.ok(einsatz.id);
}
```

## Test Execution

```bash
# Alle Architecture Tests ausführen
pnpm --filter @bluelight-hub/backend exec jest src/__tests__/architecture

# Mit Verbose Output
pnpm --filter @bluelight-hub/backend exec jest src/__tests__/architecture --verbose
```

## CI/CD Integration

Diese Tests sollten in CI/CD Pipelines integriert werden:

```yaml
# .github/workflows/ci.yml
- name: Architecture Validation
  run: pnpm --filter @bluelight-hub/backend exec jest src/__tests__/architecture
```

**Wichtig:** Aktuell schlagen 4/16 Tests fehl (DI Tokens, Result Pattern).
Diese sollten **schrittweise behoben** werden, aber **nicht** die CI Pipeline blocken.

## Migration Roadmap

### Phase 1: DI Token Migration (Prio: HIGH)

1. ✅ Alle Repository DI Tokens in `di-tokens.ts` definieren
2. ⏳ ETB Handler auf Symbol-Tokens migrieren
3. ⏳ Lagekarte Handler auf Symbol-Tokens migrieren
4. ⏳ Alte String-Token-Patterns entfernen

**Geschätzte Aufwand:** 2-3 Stunden (manuelles Refactoring)

### Phase 2: Result Pattern Migration (Prio: MEDIUM)

1. ⏳ Command Handlers auf `Result<T>` migrieren
2. ⏳ Query Handlers auf `Result<T>` migrieren (außer Event Handlers)
3. ⏳ Controller Error Handling vereinheitlichen

**Geschätzte Aufwand:** 4-6 Stunden (Handler-by-Handler Migration)

### Phase 3: Clean Architecture Hardening (Prio: LOW)

1. ✅ Domain Layer vollständig framework-agnostisch
2. ⏳ Application Layer nur erlaubte Decorators
3. ⏳ Prisma Imports auf DTOs/Queries beschränken

**Geschätzte Aufwand:** 1-2 Stunden (Code Review & Cleanup)

## Architecture Decision Records

### ADR-001: Prisma in Query Files erlaubt

**Kontext:** CQRS Read-Side Optimization
**Entscheidung:** Query Files dürfen direkten Prisma-Zugriff für Performance
**Rationale:** Vermeidet N+1 Queries, nutzt Prisma Aggregations
**Beispiel:** `GetActiveEinsaetzeWithCountsQuery`

### ADR-002: OpenAPI Decorators in Command/Query Files

**Kontext:** API Documentation via Swagger
**Entscheidung:** `@ApiProperty` etc. in Command/Query Files erlaubt
**Rationale:** Commands/Queries sind Input-DTOs für Controller
**Beispiel:** `CreateEinsatzCommand` mit `@ApiProperty()` Decorators

### ADR-003: Event Handlers returnen void (kein Result)

**Kontext:** NestJS Event Handler Pattern
**Entscheidung:** Event Handlers müssen `void`/`Promise<void>` returnen
**Rationale:** `@OnEvent` Decorator erwartet void Return Type
**Beispiel:** `EtbAutoCreationHandler`

## Debugging Failed Tests

### Test schlägt fehl: "imports from Infrastructure Layer"

**Problem:** Domain Layer importiert von `@infrastructure/...`
**Fix:** Import auf `@domain/...` ändern oder in Domain Layer verschieben

### Test schlägt fehl: "uses inline string tokens"

**Problem:** `@Inject('IEtbRepository')` statt Symbol-Token
**Fix:**
1. Token in `di-tokens.ts` definieren
2. Import hinzufügen: `import { ETB_REPOSITORY } from '@infrastructure/di-tokens'`
3. Inject ändern: `@Inject(ETB_REPOSITORY)`

### Test schlägt fehl: "should use Result<T>"

**Problem:** Handler returned naked Type statt `Result<T>`
**Fix:**
1. Result importieren: `import { Result } from '@domain/common/result'`
2. Return Type ändern: `Promise<Result<T>>`
3. Success: `return Result.ok(value)`
4. Failure: `return Result.fail(error)`

## Referenzen

- **Clean Architecture:** [Uncle Bob's Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- **Hexagonal Architecture:** [Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture/)
- **DDD Repository Pattern:** [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- **Result Pattern:** [Railway-Oriented Programming](https://fsharpforfunandprofit.com/rop/)
