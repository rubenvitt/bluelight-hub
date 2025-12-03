# Senior Developer Review - Validation Checklist

## Story Context

- [ ] Story file loaded from `{{story_path}}`
- [ ] Story Status verified as one of: {{allow_status_values}}
- [ ] Epic and Story IDs resolved ({{epic_num}}.{{story_num}})
- [ ] Story Context located or warning recorded
- [ ] Epic Tech Spec located or warning recorded
- [ ] Architecture/standards docs loaded (as available)
- [ ] Tech stack detected and documented
- [ ] MCP doc search performed (or web fallback) and references captured

## Acceptance Criteria & Implementation

- [ ] Acceptance Criteria cross-checked against implementation
- [ ] File List reviewed and validated for completeness
- [ ] Tests identified and mapped to ACs; gaps noted

## Code Quality Review

- [ ] Code quality review performed on changed files
- [ ] Security review performed on changed files and dependencies

### Architecture & DI Checks (Sprint-0 Learnings)

#### DI Import Check (AC1)
- [ ] `import type` NUR für Typen verwendet, NICHT für Injectable Classes
  - ✅ `import { MyService } from './my.service'` (für DI)
  - ❌ `import type { MyService } from './my.service'` (bricht NestJS DI)

#### DI Token Constants Check (AC2)
- [ ] DI Token Strings als Constants definiert (nicht inline Strings)
  - ✅ `@Inject(DI_TOKENS.REPOSITORIES.EINSATZ)` mit zentralen Constants
  - ❌ `@Inject('IEinsatzRepository')` direkt als String-Literal

#### Framework-Agnostizität Check (AC3)
- [ ] Application Layer ist Framework-agnostisch (keine NestJS HTTP Decorators)
  - Erlaubt: `@Injectable`, `@Inject`, `@Optional`
  - Verboten: `@Controller`, `@Get/Post/...`, `HttpException`, `Response`
- [ ] Domain Layer hat keine Imports aus Infrastructure oder Application

#### Result Pattern Check (AC4)
- [ ] `Result<T>` Pattern im Domain/Application Layer (keine Exceptions für erwartete Fehler)
  - Domain Exceptions nur für unerwartete Fehler (DB-Fehler, Netzwerk-Fehler)

#### Outbox Integration Check (AC5)
- [ ] Command Handler erweitert `TransactionalCommandHandler` (wenn Events)
- [ ] `Repository.save()` und Events in gleicher Transaction (tx-Context)
- [ ] Keine direkten `eventEmitter.emit()` Calls in Command Handlers

#### Test Pattern Check (AC6)
- [ ] Unit Tests folgen AAA Pattern (Arrange-Act-Assert)
- [ ] Given-When-Then Kommentare für Lesbarkeit vorhanden
- [ ] `jest.Mocked<T>` für NestJS Service Mocks verwendet
- [ ] Mock-Reset in beforeEach (`jest.clearAllMocks()`)

## Review Completion

- [ ] Outcome decided (Approve/Changes Requested/Blocked)
- [ ] Review notes appended under "Senior Developer Review (AI)"
- [ ] Change Log updated with review entry
- [ ] Status updated according to settings (if enabled)
- [ ] Story saved successfully

_Reviewer: {{user_name}} on {{date}}_
