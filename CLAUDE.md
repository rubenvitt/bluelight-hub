# CLAUDE.md - AI Agent Instructions

## 🚫 BREAKING RULES (NIEMALS brechen!)

### API-Client Generation

**NIEMALS manuelle API-Helper erstellen!**

Nutze IMMER TanStack Query Hooks mit generiertem API-Client:

```typescript
// ✅ RICHTIG:
const useSecurityAlerts = () => {
    return useQuery({
        queryKey: QUERY_KEYS.security.alerts,
        queryFn: () => api.security().getSecurityAlerts(),
    });
};

// ❌ FALSCH:
const fetchAlerts = async () => {
    return await fetch('/api/security/alerts');
};
```

**Workflow:** Backend-Endpunkt → `pnpm run generate-api` → TanStack Query Hook → Komponente

### UI Framework

**NUR Tailwind CSS + Headless UI** - keine anderen Frameworks!

- NIEMALS andere CSS-Frameworks oder CSS-in-JS mischen
- Bei UI-Änderungen IMMER Tailwind-Klassen und Headless UI-Komponenten verwenden
- **Tailwind Plus (TailwindUI):** Premium-Komponenten
    - IMMER beim User anfragen!
    - Der User muss die Komponenten manuell von TailwindUI kopieren und bereitstellen
    - NIEMALS selbst TailwindUI-Komponenten erfinden oder raten

### Forms & State

- **Forms:** NUR @tanstack/react-form mit Zod-Schemas
- **State:** @tanstack/react-store für globalen State
- **Server State:** @tanstack/react-query für API-Kommunikation
- **Timing:** @tanstack/pacer für Debouncing/Throttling
- **NIEMALS:** HTML Forms, Redux, oder andere Libraries

### Code Quality

- **Linter/Formatter:** NUR Biome (kein ESLint/Prettier!)
- **Pre-commit Hooks:** Husky + lint-staged (NIEMALS `--no-verify` verwenden)
- **JSDoc:** Deutsche Kommentare für public APIs (Backend)
  - Check: `pnpm --filter @bluelight-hub/backend check:jsdoc:public`
  - Erkläre "warum", nicht "was"

### Code Review Checklist (Backend Architecture)

**Diese Checks sind bei JEDEM Code Review zu prüfen:**

#### 1. DI Import Check (AC1)

`import type` NUR für Typen, NICHT für Injectable Classes:

```typescript
// ✅ RICHTIG: import für DI-Injectable Classes
import { MyService } from './my.service';
import { IRepository } from '../domain/repositories/i-repository';

// ❌ FALSCH: import type bricht NestJS DI zur Laufzeit!
import type { MyService } from './my.service';
```

**Warum:** TypeScript's `import type` wird zur Compile-Zeit entfernt. NestJS DI benötigt das Runtime-Symbol für Dependency Injection.

#### 2. DI Token Constants Check (AC2)

DI Token Strings als Constants definiert (nicht inline String-Literals):

```typescript
// ✅ RICHTIG: Zentralisierte Token Constants
// packages/backend/src/infrastructure/di-tokens.ts
export const DI_TOKENS = {
  REPOSITORIES: {
    EINSATZ: Symbol('IEinsatzRepository'),
    USER: Symbol('IUserRepository'),
  },
} as const;

// Verwendung im Handler
@Inject(DI_TOKENS.REPOSITORIES.EINSATZ)
private readonly repository: IEinsatzRepository

// ❌ FALSCH: Inline String-Literals
@Inject('IEinsatzRepository') // Typo-anfällig, keine IDE-Unterstützung
```

#### 3. Framework-Agnostizität Check (AC3)

Application Layer darf keine NestJS-spezifischen Decorators importieren (außer `@Injectable`):

```typescript
// ✅ RICHTIG: Application Layer (src/application/)
import { Injectable } from '@nestjs/common'; // OK: nur @Injectable
import { Result } from '@domain/common/result';

@Injectable()
export class CreateEinsatzHandler {
  async execute(command: CreateEinsatzCommand): Promise<Result<string>> {
    // Pure business logic, keine HTTP-Konzepte
  }
}

// ❌ FALSCH: Framework-spezifische Imports in Application Layer
import { HttpException, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
```

**Erlaubt in Application Layer:** `@Injectable`, `@Inject`, `@Optional`
**Verboten in Application Layer:** `@Controller`, `@Get/Post/...`, `HttpException`, `Response`, etc.

#### 4. Result Pattern Check (AC4)

`Result<T>` statt Exceptions im Domain/Application Layer:

```typescript
// ✅ RICHTIG: Result Pattern für erwartete Fehler
export class CreateEinsatzHandler {
  async execute(command: CreateEinsatzCommand): Promise<Result<string>> {
    const validation = command.validate();
    if (validation.isFailure) {
      return Result.fail(validation.error); // Kein throw!
    }

    const einsatz = Einsatz.create(command);
    if (einsatz.isFailure) {
      return Result.fail(einsatz.error);
    }

    return Result.ok(einsatz.value.id.value);
  }
}

// ❌ FALSCH: Exceptions für erwartete Business-Fehler
throw new EinsatzValidationException('Invalid nummer');
```

**Domain Exceptions nur für:** Unerwartete Fehler (DB-Fehler, Netzwerk-Fehler, Programming Errors)

#### 5. Outbox Integration Check (AC5)

Outbox-Events atomar mit Domain-Operationen gespeichert:

```typescript
// ✅ RICHTIG: TransactionalCommandHandler Pattern
export class CreateEinsatzHandler extends TransactionalCommandHandler<
  CreateEinsatzCommand,
  string
> {
  protected async executeInTransaction(
    command: CreateEinsatzCommand,
    tx: TransactionContext
  ): Promise<{ result: string; events: DomainEvent[] }> {
    const einsatz = Einsatz.create(command);
    await this.repository.save(einsatz, tx); // In gleicher TX

    const events = einsatz.getDomainEvents();
    einsatz.clearDomainEvents();

    return { result: einsatz.id.value, events }; // Base class speichert in Outbox
  }
}

// ❌ FALSCH: Events direkt emittieren
await this.eventEmitter.emit('einsatz.created', event); // Nicht atomar!
```

**Verweis:** `TransactionalCommandHandler` in `src/application/common/handlers/`

#### 6. Test Pattern Check (AC6)

Unit Tests folgen AAA Pattern mit Given-When-Then Kommentaren:

```typescript
// ✅ RICHTIG: AAA Pattern mit Given-When-Then
describe('CreateEinsatzHandler', () => {
  let handler: CreateEinsatzHandler;
  let mockRepository: jest.Mocked<IEinsatzRepository>;

  beforeEach(() => {
    jest.clearAllMocks(); // WICHTIG: Mock Reset
    mockRepository = createMockRepository();
    handler = new CreateEinsatzHandler(mockRepository);
  });

  it('should create einsatz successfully', async () => {
    // Given (Arrange)
    const command = CreateEinsatzCommand.create({
      nummer: 'E-2025-001',
      stichwort: 'Brand',
    }).value!;
    mockRepository.save.mockResolvedValue(undefined);

    // When (Act)
    const result = await handler.execute(command);

    // Then (Assert)
    expect(result.isSuccess).toBe(true);
    expect(mockRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ nummer: 'E-2025-001' }),
      expect.any(Object)
    );
  });
});
```

**Verweis:** `jest.Mocked<T>` für NestJS Service Mocks, `jest.clearAllMocks()` in beforeEach

#### 7. Controller Response Decorator Check (AC7)

IMMER `@ApiWrappedResponse` / `@ApiWrappedCreatedResponse` statt Standard-Swagger-Decorators:

```typescript
// ✅ RICHTIG: Custom Wrapper Decorator für korrekte OpenAPI-Generierung
import { ApiWrappedResponse, ApiWrappedCreatedResponse } from '@/modules/common/decorators/api-wrapped-response.decorator';

@Get()
@ApiWrappedResponse(EinsatzDto, { isArray: true, description: 'Liste aller Einsätze' })
async findAll(): Promise<PaginatedData<EinsatzDto>> { ... }

@Post()
@ApiWrappedCreatedResponse(EinsatzDto, { description: 'Einsatz erstellt' })
async create(@Body() dto: CreateEinsatzDto): Promise<EinsatzDto> { ... }

// ❌ FALSCH: Standard Swagger Decorators (generiert falsches Schema)
@ApiOkResponse({ type: EinsatzDto })  // Fehlt data/meta wrapper!
@ApiCreatedResponse({ type: EinsatzDto })
```

**Warum:** Der generierte API-Client erwartet `WrappedResponse<T>` mit `{ data, meta }` Struktur. Standard-Decorators generieren falsches OpenAPI-Schema.

**Verweis:** `@/modules/common/decorators/api-wrapped-response.decorator.ts`

### Commit Rules

- **NIEMALS** `--no-verify` verwenden
- **IMMER** nach jedem Subtask committen
- Format: `<emoji>(<context>): <title>`

## 📁 PROJECT STRUCTURE

```text
bluelight-hub/
├── packages/
│   ├── frontend/              # React 19 + Vite + Tauri Desktop App
│   │   ├── src/
│   │   │   ├── features/      # Feature-based Modules (NICHT components/)
│   │   │   │   ├── auth/      # Auth Feature
│   │   │   │   │   ├── api/       # TanStack Query Hooks
│   │   │   │   │   ├── guards/    # Route Guards
│   │   │   │   │   ├── schemas/   # Zod Schemas
│   │   │   │   │   ├── stores/    # TanStack Store
│   │   │   │   │   └── ui/        # Atomic Design (atoms/molecules/organisms/pages)
│   │   │   │   ├── einsatz/   # Einsatz Feature
│   │   │   │   ├── etb/       # ETB Feature
│   │   │   │   ├── lagekarte/ # Lagekarte Feature
│   │   │   │   └── admin/     # Admin Feature
│   │   │   ├── shared/        # Shared Components & Utilities
│   │   │   │   ├── ui/        # Global Atomic Design Components
│   │   │   │   │   ├── atoms/
│   │   │   │   │   ├── molecules/
│   │   │   │   │   ├── organisms/
│   │   │   │   │   ├── templates/
│   │   │   │   │   └── headless/  # Headless UI Wrappers
│   │   │   │   └── utils/
│   │   │   ├── routes/        # TanStack Router (File-based, AUTO-GENERATED)
│   │   │   ├── provider/      # App Providers (Query, Store, Auth)
│   │   │   ├── services/      # App Services
│   │   │   └── queryKeys.ts   # Zentrale Query Key Verwaltung
│   │   └── src-tauri/         # Tauri Rust Backend
│   │
│   ├── backend/               # NestJS + Prisma + PostgreSQL (Hexagonal Architecture)
│   │   ├── src/
│   │   │   ├── domain/        # Business Logic Layer (Framework-agnostic)
│   │   │   │   ├── aggregates/    # Business Aggregates
│   │   │   │   ├── entities/      # Domain Entities
│   │   │   │   ├── events/        # Domain Events
│   │   │   │   ├── exceptions/    # Domain Exceptions
│   │   │   │   ├── ports/         # Interface Contracts (Ports)
│   │   │   │   ├── repositories/  # Repository Interfaces
│   │   │   │   ├── services/      # Domain Services
│   │   │   │   ├── value-objects/ # Immutable Value Objects
│   │   │   │   └── common/        # Shared Domain Utilities (Result, etc.)
│   │   │   │
│   │   │   ├── application/   # Use Case Layer (Handlers, Commands, Queries)
│   │   │   │   ├── common/
│   │   │   │   │   └── handlers/  # TransactionalCommandHandler Base
│   │   │   │   ├── einsatz/
│   │   │   │   │   ├── commands/  # Command Handlers
│   │   │   │   │   ├── queries/   # Query Handlers
│   │   │   │   │   └── dto/       # DTOs
│   │   │   │   ├── etb/
│   │   │   │   │   └── event-handlers/  # Domain Event Handlers
│   │   │   │   ├── kraefte/
│   │   │   │   │   └── einsatz-fahrzeuge/
│   │   │   │   │       ├── commands/
│   │   │   │   │       ├── queries/
│   │   │   │   │       └── dto/
│   │   │   │   └── lagekarte/
│   │   │   │
│   │   │   ├── infrastructure/  # Technical Layer (Adapters, DB, Events)
│   │   │   │   ├── common/
│   │   │   │   │   └── adapters/  # Port Implementations (Logger, etc.)
│   │   │   │   ├── database/      # Prisma Client
│   │   │   │   ├── events/        # Event Bus & Adapters
│   │   │   │   │   └── adapters/  # Domain Event → Integration Event
│   │   │   │   ├── outbox/        # Outbox Pattern Implementation
│   │   │   │   ├── repositories/  # Prisma Repository Implementations
│   │   │   │   ├── di-tokens.ts   # Zentralisierte DI Token Constants
│   │   │   │   └── config/        # Configuration
│   │   │   │
│   │   │   └── modules/       # REST Controller Layer (NestJS Modules)
│   │   │       ├── auth/
│   │   │       │   └── controllers/
│   │   │       ├── einsatz/
│   │   │       │   └── controllers/
│   │   │       ├── etb/
│   │   │       │   └── controllers/
│   │   │       └── kraefte/
│   │   │           └── controllers/
│   │   │
│   │   └── prisma/schema.prisma
│   │
│   └── shared/
│       └── client/            # Generierte API-Clients (NICHT manuell ändern!)
│
├── docs/                      # Modulare Projektdokumentation
│   ├── index/                 # Modulare Index-Dateien
│   ├── architecture/          # arc42 Template (14+ Dateien)
│   ├── adr/                   # Architecture Decision Records
│   ├── sprint-artifacts/      # Sprint Status & Stories
│   ├── backend-api-contracts/ # OpenAPI, DTOs
│   ├── backend-data-models/   # Prisma Schema Dokumentation
│   ├── frontend-components/   # Atomic Design Inventory
│   └── development-guide/     # Setup, Commands, Best Practices
│
├── .bmad/                     # BMad v6 Framework (Workflow Automation)
│   ├── core/                  # BMad Core Module
│   ├── bmm/                   # BMad Main Module (Workflows)
│   ├── bmb/                   # BMad Builder Module
│   ├── cis/                   # Custom Innovation Suite
│   └── _cfg/                  # Manifests (tasks, workflows, agents)
│
└── .claude/                   # Claude Code Konfiguration
    ├── agents/                # Claude Agent Konfigurationen
    └── commands/              # Custom Slash Commands
```

## 🛠️ ESSENTIAL COMMANDS

### Development

```bash
# Projekt-weit
pnpm -r dev                                    # Alle Services starten (Backend + Tauri)
pnpm -r build                                  # Alles bauen
pnpm run generate-api                          # API-Client generieren (WICHTIG!)

# Package-spezifisch
pnpm --filter @bluelight-hub/backend dev      # Nur Backend (Port 3091)
pnpm --filter @bluelight-hub/frontend dev     # Tauri Desktop App (Port 3090)
pnpm --filter @bluelight-hub/frontend dev:vite # Nur Vite Dev Server (Port 3090)

# Database
pnpm --filter @bluelight-hub/backend prisma:migrate  # Migrations ausführen
pnpm --filter @bluelight-hub/backend prisma:studio   # Prisma Studio öffnen

# Code Quality
pnpm lint                                      # Biome lint + fix
pnpm lint:check                               # Biome check ohne fix

# Architecture Checks
pnpm --filter @bluelight-hub/backend check:arch     # Circular Dependencies prüfen
pnpm --filter @bluelight-hub/backend lint:arch      # Architecture Lint

# Backend Documentation
pnpm --filter @bluelight-hub/backend docs:generate  # Compodoc generieren
```

### Testing

```bash
# Unit Tests
pnpm --filter @bluelight-hub/backend test              # Alle Tests
pnpm --filter @bluelight-hub/backend test:unit         # Nur Unit Tests
pnpm --filter @bluelight-hub/backend test:domain       # Nur Domain Tests

# Integration Tests
pnpm --filter @bluelight-hub/backend test:e2e          # E2E Tests
pnpm --filter @bluelight-hub/backend test:integration  # Integration Tests
```

### Environment

- **Backend:** `http://localhost:3091`
  - API: `http://localhost:3091/api`
  - Swagger UI: `http://localhost:3091/api`
  - API Spec: `http://localhost:3091/api-json`
- **Frontend:** `http://localhost:3090` (Vite Dev Server + Tauri Window)
- **Database:** PostgreSQL 17 (Port 3092 Docker Host, siehe `.env` für Connection String)
- **Prisma Studio:** `http://localhost:3093`

## 🏗️ CODE PATTERNS

### Frontend (Feature-based + Atomic Design + TanStack Ecosystem)

```typescript
// Feature-Struktur
features/
└── einsatz/
    ├── api/           # TanStack Query Hooks
    │   ├── queries.ts     # useEinsaetze, useEinsatzById
    │   └── mutations.ts   # useCreateEinsatz, useUpdateEinsatz
    ├── constants/     # Feature-spezifische Konstanten
    ├── hooks/         # Custom Hooks
    ├── schemas/       # Zod Validation Schemas
    ├── stores/        # TanStack Store für Feature-State
    └── ui/            # Atomic Design Components
        ├── atoms/         # Basis (Buttons, Badges)
        ├── molecules/     # Kombiniert (Cards, Dropdowns)
        ├── organisms/     # Komplex (Forms, Tables)
        └── pages/         # Route-Komponenten

// Shared Components (global wiederverwendbar)
shared/
└── ui/
    ├── atoms/         # Button, Input, Badge, Icon
    ├── molecules/     # FormField, Card, Alert
    ├── organisms/     # Modal, Table, Form
    ├── templates/     # PageLayout, DashboardLayout
    └── headless/      # Headless UI Wrapper

// API Integration (IMMER generierter Client!)
import { api } from '@bluelight-hub/shared/client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/queryKeys';

const useEinsaetze = () => {
  return useQuery({
    queryKey: QUERY_KEYS.einsatz.list(),
    queryFn: () => api.einsatz.findAll(),
  });
};

// Forms (IMMER @tanstack/react-form)
import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';

const form = useForm({
  defaultValues: { name: '' },
  validatorAdapter: zodValidator(),
  validators: {
    onChange: z.object({ name: z.string().min(3) }),
  },
});

// Styling (NUR Tailwind CSS + cn() Helper)
import { cn } from '@/shared/ui/cn';

<div className={cn(
  "flex items-center gap-4 rounded-lg p-4",
  isActive && "bg-blue-100"
)}>
  <Button variant="primary">Action</Button>
</div>
```

### Backend (Hexagonal Architecture + CQRS)

```typescript
// Layer-Übersicht
domain/         # WAS (Business Rules) - Framework-agnostic
application/    # WANN (Use Cases) - Orchestriert Domain
infrastructure/ # WIE (Technical Details) - Implements Ports
modules/        # WO (HTTP Endpoints) - REST Controller

// Domain Layer (src/domain/)
// Aggregate mit Domain Events
export class Einsatz extends AggregateRoot {
  public updateStatus(newStatus: EinsatzStatus): Result<void> {
    const oldStatus = this._status;
    this._status = newStatus;

    this.addDomainEvent(
      new EinsatzStatusGeaendertEvent(this.id, oldStatus, newStatus)
    );

    return Result.ok();
  }
}

// Port Interface (src/domain/ports/)
export interface ILoggerPort {
  log(message: string, context?: string): void;
  error(message: string, trace?: string, context?: string): void;
}

// Application Layer (src/application/)
// Command Handler mit TransactionalCommandHandler
@Injectable()
export class UpdateEinsatzHandler extends TransactionalCommandHandler<
  UpdateEinsatzCommand,
  void
> {
  protected async executeInTransaction(
    command: UpdateEinsatzCommand,
    tx: TransactionContext
  ): Promise<{ result: void; events: DomainEvent[] }> {
    const einsatz = await this.repository.findById(command.id, tx);
    if (!einsatz) {
      return { result: undefined, events: [] };
    }

    einsatz.updateStatus(command.status);
    await this.repository.save(einsatz, tx);

    const events = einsatz.getDomainEvents();
    einsatz.clearDomainEvents();

    return { result: undefined, events };
  }
}

// Event Handler (src/application/*/event-handlers/)
@Injectable()
export class EinsatzCreatedHandler implements IEventHandler<EinsatzCreatedEvent> {
  async handle(event: EinsatzCreatedEvent): Promise<void> {
    // Side effects: ETB Eintrag erstellen, Notifications, etc.
  }
}

// Infrastructure Layer (src/infrastructure/)
// Port Adapter Implementation
@Injectable()
export class NestLoggerAdapter implements ILoggerPort {
  constructor(private readonly logger: Logger) {}

  log(message: string, context?: string): void {
    this.logger.log(message, context);
  }
}

// Repository Implementation
@Injectable()
export class PrismaEinsatzRepository implements IEinsatzRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: EinsatzId, tx?: TransactionContext): Promise<Einsatz | null> {
    const client = tx ?? this.prisma;
    const data = await client.einsatz.findUnique({ where: { id: id.value } });
    return data ? EinsatzMapper.toDomain(data) : null;
  }
}

// Module Layer (src/modules/)
// Controller (IMMER OpenAPI decorators!)
@Controller('einsatz')
@ApiTags('einsatz')
export class EinsatzController {
  constructor(
    private readonly createHandler: CreateEinsatzHandler,
    private readonly queryHandler: GetEinsatzQueryHandler,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Einsatz erstellen' })
  @ApiCreatedResponse({ type: EinsatzDto })
  async create(@Body() dto: CreateEinsatzDto): Promise<WrappedResponse<EinsatzDto>> {
    const result = await this.createHandler.execute(dto);
    if (result.isFailure) {
      throw new BadRequestException(result.error);
    }
    return { data: result.value };
  }
}

// DTO (IMMER class-validator + @ApiProperty)
export class CreateEinsatzDto {
  @ApiProperty({ description: 'Einsatznummer' })
  @IsString()
  nummer: string;

  @ApiProperty({ description: 'Einsatzort', required: false })
  @IsOptional()
  @IsString()
  ort?: string;
}

// JSDoc (Deutsch, "warum" nicht "was")
/**
 * Erstellt einen neuen Einsatz und speichert Domain Events in Outbox.
 *
 * Nutzt TransactionalCommandHandler um atomare Konsistenz zwischen
 * Aggregate-Änderung und Event-Publikation zu garantieren.
 */
async execute(command: CreateEinsatzCommand): Promise<Result<string>> { ... }
```

## 🎯 COMMIT EMOJIS

### Semantic Release Triggers

| Emoji | Typ      | Version | Verwendung           | Beispiel                                    |
|-------|----------|---------|----------------------|---------------------------------------------|
| 💥    | Breaking | Major   | Breaking Changes     | `💥(api): Change endpoint structure`        |
| ✨     | Feature  | Minor   | Neue Features        | `✨(einsatz): Add status filter`            |
| 🐛    | Fix      | Patch   | Bug Fixes            | `🐛(auth): Fix token expiration`            |
| 🚑    | Hotfix   | Patch   | Kritische Fixes      | `🚑(db): Fix connection pool leak`          |
| 🔒    | Security | Patch   | Security Fixes       | `🔒(auth): Patch XSS vulnerability`         |
| ♻️    | Refactor | Patch   | Code Refactoring     | `♻️(service): Extract validation logic`     |
| 📝    | Docs     | -       | Dokumentation        | `📝(readme): Update setup instructions`     |
| 🔧    | Config   | -       | Konfiguration        | `🔧(ci): Add coverage reporting`            |
| 🎨    | Style    | -       | Code Style           | `🎨(components): Apply consistent spacing`  |
| ⚡     | Perf     | Patch   | Performance          | `⚡(query): Add database index`             |
| 🔖    | Release  | -       | Version Tag          | `🔖(release): 1.2.3`                        |
| 🧪    | Test     | -       | Tests hinzufügen     | `🧪(kraefte): Add handler tests`            |

## 🤖 Subagent-Nutzung

**Nutze Subagents (Task Tool) proaktiv für komplexe Aufgaben!**

| Aufgabentyp | Subagent | Wann nutzen |
|-------------|----------|-------------|
| **Codebase Exploration** | `Explore` | Struktur verstehen, Dateien finden, Patterns identifizieren |
| **Implementation** | `general-purpose` | Multi-Step Implementierungen, komplexe Refactorings |
| **Planung** | `Plan` | Architektur-Design, Implementierungs-Strategien |
| **Marktforschung** | `bmm-market-researcher` | Wettbewerbs-Analyse, Markt-Insights |
| **Anforderungsanalyse** | `bmm-requirements-analyst` | Requirements extrahieren, validieren |
| **Codebase-Analyse** | `bmm-codebase-analyzer` | Projekt-Struktur, Tech-Stack Dokumentation |
| **Pattern-Erkennung** | `bmm-pattern-detector` | Code-Patterns, Konventionen identifizieren |
| **API-Dokumentation** | `bmm-api-documenter` | REST Endpoints, Schemas dokumentieren |
| **Tech Debt** | `bmm-tech-debt-auditor` | Refactoring-Bedarf, Code Smells |
| **Test Coverage** | `bmm-test-coverage-analyzer` | Test-Gaps, Coverage-Metriken |
| **Document Review** | `bmm-document-reviewer` | PRDs, Architektur-Docs validieren |

**Best Practices:**
- Für **Recherche-Aufgaben** IMMER `Explore` Agent nutzen (statt direkte Grep/Glob)
- **Parallele Agents** starten wenn Tasks unabhängig sind
- Bei **komplexen Implementierungen** erst `Plan` Agent, dann `general-purpose`
- **BMM-Agents** proaktiv für Dokumentation und Analyse nutzen

```typescript
// Beispiel: Exploration statt direkter Suche
// ✅ RICHTIG: Explore Agent für offene Fragen
Task(subagent_type='Explore', prompt='Finde alle Event Handler im Backend')

// ❌ FALSCH: Direkte Grep/Glob für komplexe Exploration
Grep(pattern='EventHandler')
```

## 🤖 BMad v6 Framework Integration

Dieses Projekt nutzt BMad v6 für Workflow-Automation und Multi-Agent-Orchestration.

### BMad Master Agent

Der zentrale Orchestrator für BMad-Workflows:

```bash
# Aktivierung in Claude Code
/bmad:core:agents:bmad-master

# Verfügbare Optionen (im Agent-Menü):
1. Liste verfügbare Tasks (*list-tasks)
2. Liste Workflows (*list-workflows)
3. Gruppen-Chat mit allen Agents (*party-mode)
4. Exit (*exit)
```

### Wichtige BMad Workflows

| Workflow | Command | Verwendung |
|----------|---------|------------|
| **Workflow Status** | `/bmad:bmm:workflows:workflow-status` | Projekt-Status abfragen |
| **Product Brief** | `/bmad:bmm:workflows:product-brief` | Produkt-Vision definieren |
| **Architecture** | `/bmad:bmm:workflows:architecture` | Architektur-Entscheidungen |
| **PRD** | `/bmad:bmm:workflows:prd` | Product Requirements Document |
| **Story Creation** | `/bmad:bmm:workflows:create-story` | User Stories generieren |
| **Brainstorming** | `/bmad:core:workflows:brainstorming` | Kreative Ideation |

**Hinweis:** BMad-Workflows sind OPTIONAL. Für reguläre Entwicklungsaufgaben sind sie NICHT erforderlich.

## 🔧 MCP SERVER INTEGRATION

Dieses Projekt nutzt mehrere MCP Server für erweiterte Funktionalität:

### Verfügbare MCP Server

| Server | Verwendung |
|--------|------------|
| **context7** | Aktuelle Library-Dokumentation |
| **claude-in-chrome** | Chrome Steuerung |

Nutze Context7 für aktuelle Library-Dokumentation.
Nutze Claude-in-chrome für Chrome Steuerung, z.B. um Frontend-Implementierung zu testen.
Login: rubeen / (optionales PW: MyPass123*)

## ⚠️ WICHTIGE HINWEISE

### Tests

- **Unit Tests:** `pnpm --filter @bluelight-hub/backend test`
- **Integration Tests:** `pnpm --filter @bluelight-hub/backend test:e2e`
- **Domain Tests:** `pnpm --filter @bluelight-hub/backend test:domain`
- **Manuelle Tests:** claude-in-chrome

### API Development Workflow

1. Backend-Endpoint mit NestJS/Swagger erstellen (siehe AC7: `@ApiWrappedResponse`)
2. API-Client generieren: `pnpm run generate-api`
3. Frontend nutzt generierten Client aus `@bluelight-hub/shared/client`
4. TanStack Query Hook erstellen

### Hexagonal Architecture Layers

| Layer | Verantwortung | Abhängigkeiten |
|-------|---------------|----------------|
| **Domain** | Business Rules, Aggregates, Events | Keine (Framework-agnostic) |
| **Application** | Use Cases, Handlers, DTOs | Domain |
| **Infrastructure** | DB, Events, External Services | Domain, Application |
| **Modules** | HTTP Controller, REST API | Application |

**Wichtig:** Abhängigkeiten fließen IMMER nach innen (Modules → Infrastructure → Application → Domain).

### Tauri Desktop App

- Frontend ist eine **Desktop-App** (Tauri), kein reiner Web-Client
- Native Features: File System Access, System Tray, Native Notifications
- Development: `pnpm --filter @bluelight-hub/frontend dev` (öffnet natives Fenster + Browser)
- Web-Only: `pnpm --filter @bluelight-hub/frontend dev:vite` (Browser only)

## 📚 DOKUMENTATION

Die Projektdokumentation ist modular aufgebaut:

- **Haupt-Index:** `/docs/index/`
- **Architektur:** `/docs/architecture/` (arc42 Template, 14+ Dateien)
- **ADRs:** `/docs/adr/` (Architecture Decision Records)
- **Sprint Artifacts:** `/docs/sprint-artifacts/` (Status, Stories, Dailies)
- **API:** `/docs/backend-api-contracts/` (OpenAPI, DTOs, Endpoints)
- **Data Models:** `/docs/backend-data-models/` (Prisma Schema)
- **Frontend:** `/docs/frontend-components/` (Atomic Design Inventory)
- **Development:** `/docs/development-guide/` (Setup, Commands, Best Practices)

**Wichtig:** Bei Architektur-Änderungen IMMER arc42-Dokumente und ADRs aktualisieren!

## 🔍 QUICK REFERENCE

| Was | Wo | Tool/Command |
|-----|-----|-------------|
| **API erstellen** | Backend | NestJS + Swagger Decorators → `pnpm run generate-api` |
| **API nutzen** | Frontend | `@bluelight-hub/shared/client` + TanStack Query |
| **UI Component** | Frontend | Tailwind CSS + Headless UI (TailwindUI nur auf Anfrage) |
| **Form erstellen** | Frontend | @tanstack/react-form + Zod |
| **State Management** | Frontend | @tanstack/react-store (global), @tanstack/react-query (server) |
| **Feature erstellen** | Frontend | `features/<name>/` mit api/, ui/, stores/, schemas/ |
| **Command Handler** | Backend | `application/<feature>/commands/` + TransactionalCommandHandler |
| **Event Handler** | Backend | `application/<feature>/event-handlers/` |
| **Repository** | Backend | `domain/repositories/` (Interface) + `infrastructure/repositories/` (Impl) |
| **Database Migration** | Backend | `pnpm --filter @bluelight-hub/backend prisma:migrate` |
| **Code Linting** | Überall | `pnpm lint` (Biome) |
| **Architecture Check** | Backend | `pnpm --filter @bluelight-hub/backend check:arch` |
| **API Docs** | Backend | Swagger UI: `http://localhost:3091/api` |
| **Code Docs** | Backend | `pnpm --filter @bluelight-hub/backend docs:generate` (Compodoc) |
| **Manual Testing** | Frontend | Chrome DevTools MCP + `http://localhost:3090` |

---

**Mandatory:** Spreche Deutsch mit mir, produziere englischen Code, aber deutsche Dokumentation (JSDoc, Kommentare)!

_Repository:_ github.com/rubenvitt/bluelight-hub
