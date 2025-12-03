# ADR-024: Repository Interface Return-Type Pattern

**Status:** Accepted
**Datum:** 2025-12-03
**Autoren:** Ruben (via Architect Agent)
**Context:** Sprint 0 Tech Debt Remediation, Hexagonal Architecture Migration

## Kontext

Im Rahmen der Migration zu Hexagonaler Architektur (Epic 1-4) wurden Domain Repository Interfaces erstellt. Bei der Analyse dieser Interfaces wurde eine **Inkonsistenz bei den Return-Types** festgestellt:

### Aktuelle Situation

| Repository | Pattern | Status |
|------------|---------|--------|
| `IEinsatzRepository` | `Result<T>` | ✅ Konsistent |
| `IUserRepository` | `Result<T>` | ✅ Konsistent |
| `IEtbRepository` | `Promise<T>` | ❌ Inkonsistent |
| `ILagekarteRepository` | `Promise<T>` | ❌ Inkonsistent |
| `IOutboxRepository` | `Promise<T>` | ⚠️ Sonderfall |

### Konkrete Code-Referenzen

**Repositories mit `Result<T>` Pattern:**

```typescript
// packages/backend/src/domain/repositories/ieinsatz.repository.ts
save(aggregate: Einsatz, tx?: TransactionContext): Promise<Result<void>>           // Line 89
findById(id: EinsatzId): Promise<Result<Einsatz | null>>                           // Line 120
findActive(): Promise<Result<Einsatz[]>>                                           // Line 145
findByNummer(nummer: string): Promise<Result<Einsatz | null>>                      // Line 171
exists(id: EinsatzId): Promise<Result<boolean>>                                    // Line 197

// packages/backend/src/domain/repositories/i-user.repository.ts
findById(id: UserId, tx?: TransactionContext): Promise<Result<UserAggregate | null>>     // Line 66
findByUsername(username: Username, tx?: TransactionContext): Promise<Result<UserAggregate | null>>  // Line 88
save(user: UserAggregate, tx?: TransactionContext): Promise<Result<void>>                // Line 135
countSuperAdmins(tx?: TransactionContext): Promise<Result<number>>                       // Line 158
```

**Repositories OHNE `Result<T>` Pattern:**

```typescript
// packages/backend/src/domain/repositories/i-etb.repository.ts
save(aggregate: EinsatztagebuchAggregate, tx?: TransactionContext): Promise<void>           // Line 91
findById(id: EtbId, tx?: TransactionContext): Promise<EinsatztagebuchAggregate | null>     // Line 115
findByEinsatzId(einsatzId: EinsatzId, tx?: TransactionContext): Promise<EinsatztagebuchAggregate | null>  // Line 139

// packages/backend/src/domain/repositories/i-lagekarte.repository.ts
save(aggregate: LagekarteAggregate, tx?: TransactionContext): Promise<void>                // Line 91
findById(id: LagekarteId, tx?: TransactionContext): Promise<LagekarteAggregate | null>    // Line 125
findByEinsatzId(einsatzId: EinsatzId, tx?: TransactionContext): Promise<LagekarteAggregate | null>  // Line 168
```

### Warum ist diese Inkonsistenz problematisch?

1. **Uneinheitliches Error Handling:** Command Handler müssen je nach Repository unterschiedliche Error-Handling-Strategien verwenden (try/catch vs. Result.isFailure()).

2. **Vermischte Paradigmen:** Railway-Oriented Programming (Result<T>) und Exception-basiertes Handling werden im selben Codebase gemischt.

3. **Developer Experience:** Neue Entwickler müssen beide Patterns verstehen und wissen, wann welches anzuwenden ist.

4. **Testing-Komplexität:** Unit Tests müssen beide Error-Handling-Patterns mocken.

5. **Refactoring-Risiko:** Bei späteren Änderungen können Fehler durch inkonsistente Erwartungen entstehen.

### Historischer Kontext

- **Epic 1 (Story 1-6):** `IUserRepository` mit `Result<T>` Pattern erstellt
- **Epic 2 (Story 2-3):** `ILagekarteRepository` OHNE `Result<T>` implementiert
- **Epic 3 (Story 3-4):** `IEtbRepository` OHNE `Result<T>` implementiert
- **Epic 4 (Story 4-5):** `IEinsatzRepository` MIT `Result<T>` re-etabliert
- **Sprint 0:** Inkonsistenz dokumentiert, ADR erstellt

## Entscheidung

**Alle Domain Repository Interfaces MÜSSEN das `Result<T>` Pattern verwenden.**

### Begründung

1. **Railway-Oriented Programming:** Das `Result<T>` Pattern ermöglicht elegante Verkettung von Operationen ohne Exception-Handling im Application Layer.

2. **Type-Safe Error Handling:** Fehler werden als Typen repräsentiert, nicht als Exceptions. Der Compiler erzwingt Fehlerbehandlung.

3. **Konsistenz:** Ein einheitliches Pattern für alle Repositories reduziert kognitive Last und Fehlerquellen.

4. **Explizite Fehlerbehandlung:** Keine "vergessenen" try/catch-Blöcke möglich - der Return-Type macht Fehlerbehandlung sichtbar.

5. **Testbarkeit:** Einfacheres Mocking und Assertions auf Result-Objekte.

### Sonderfall: IOutboxRepository

`IOutboxRepository` (`packages/backend/src/domain/repositories/i-outbox.repository.ts`) ist ein **Infrastructure-internes Repository** und KEIN Domain-Repository:

- **Zweck:** Transactional Outbox Pattern für Event-Publishing
- **Consumer:** Nur `OutboxEventPublisher` Service (Infrastructure)
- **Location:** Logisch in `src/infrastructure/outbox/`, Interface in `src/domain/repositories/` für DI-Token
- **Pattern:** Bleibt bei `Promise<T>` da Infrastructure-Concern, keine Domain-Logik

### Ziel-Signaturen nach Migration

```typescript
// IEtbRepository (zu migrieren)
save(aggregate: EinsatztagebuchAggregate, tx?: TransactionContext): Promise<Result<void>>
findById(id: EtbId, tx?: TransactionContext): Promise<Result<EinsatztagebuchAggregate | null>>
findByEinsatzId(einsatzId: EinsatzId, tx?: TransactionContext): Promise<Result<EinsatztagebuchAggregate | null>>
getHistory(id: EtbId): Promise<Result<EtbSnapshot[]>>

// ILagekarteRepository (zu migrieren)
save(aggregate: LagekarteAggregate, tx?: TransactionContext): Promise<Result<void>>
findById(id: LagekarteId, tx?: TransactionContext): Promise<Result<LagekarteAggregate | null>>
findByEinsatzId(einsatzId: EinsatzId, tx?: TransactionContext): Promise<Result<LagekarteAggregate | null>>
exists(einsatzId: EinsatzId): Promise<Result<boolean>>
```

## Konsequenzen

### Positiv

1. **Einheitliches Error Handling:** Alle Command Handler können konsistent mit `Result<T>` arbeiten.

2. **Compile-Time Safety:** TypeScript erzwingt Fehlerbehandlung - vergessene Fehlerbehandlung wird zum Compile-Error.

3. **Bessere Testbarkeit:** Mock-Factories können einheitlich Result-Objekte zurückgeben.

4. **Dokumentation durch Code:** Return-Types dokumentieren explizit, welche Operationen fehlschlagen können.

5. **Einfacheres Onboarding:** Neue Entwickler lernen ein Pattern statt zwei.

6. **Railway-Oriented Chaining:**
   ```typescript
   // Elegante Verkettung ohne try/catch
   const einsatzResult = await einsatzRepo.findById(id);
   if (einsatzResult.isFailure) return Result.fail(einsatzResult.error);

   const etbResult = await etbRepo.findByEinsatzId(einsatzResult.value.id);
   if (etbResult.isFailure) return Result.fail(etbResult.error);
   ```

### Negativ

1. **Migration erforderlich:** 2 Repository Interfaces + Implementierungen müssen angepasst werden.

2. **Breaking Changes:** Alle Consumer der migrierten Repositories müssen aktualisiert werden.

3. **Mehr Boilerplate:** Result-Wrapping und -Unwrapping erfordert zusätzlichen Code.

4. **Lernkurve:** Entwickler ohne Railway-Oriented Programming Erfahrung benötigen Einarbeitung.

### Migration

Die Migration erfolgt in **Epic 5** (Story 5-2) nach Abschluss von Sprint 0:

#### Phase 1: Interface Migration

1. **IEtbRepository** (`i-etb.repository.ts`)
   - 4 Methoden anpassen
   - Betroffene Lines: 91, 115, 139, 171

2. **ILagekarteRepository** (`i-lagekarte.repository.ts`)
   - 4 Methoden anpassen
   - Betroffene Lines: 91, 125, 168, 208

#### Phase 2: Implementation Migration

1. **PrismaEtbRepository** anpassen
2. **PrismaLagekarteRepository** anpassen
3. Alle `return aggregate` → `return Result.ok(aggregate)`
4. Alle `throw` → `return Result.fail(error)`

#### Phase 3: Consumer Migration

1. **Etb Command Handlers:** Result-Handling hinzufügen
2. **Lagekarte Command Handlers:** Result-Handling hinzufügen
3. **Query Handlers:** Result-Handling hinzufügen

#### Phase 4: Test Migration

1. Mock-Factories aktualisieren
2. Unit Tests auf Result-Assertions umstellen
3. Integration Tests validieren

## Verwandte Entscheidungen

- **ADR-022:** Domain Layer als Backend Subfolder (Hexagonal Architecture)
- **Story 4-5:** IEinsatzRepository mit Result<T> Pattern (Reference Implementation)
- **Story 1-6:** IUserRepository mit Result<T> Pattern
- **Epic 5 (Story 5-2):** Domain Layer Unit Test Coverage (Migration-Umsetzung)

## Validierung

Diese ADR ist erfüllt, wenn:

1. ✅ Das Dokument existiert in `docs/adr/ADR-024-repository-interface-pattern.md`
2. ✅ Die Entscheidung "Result<T> für alle Domain-Repositories" ist dokumentiert
3. ✅ IOutboxRepository ist als Sonderfall definiert
4. ✅ Ein Migrationsplan für IEtbRepository und ILagekarteRepository existiert
5. ⏳ Die Migration ist in Epic 5 eingeplant
