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

### Commit Rules

- **NIEMALS** `--no-verify` verwenden
- **IMMER** nach jedem Subtask committen
- Format: `<emoji>(<context>): <title>`

## 📁 PROJECT STRUCTURE

```text
bluelight-hub/
├── packages/
│   ├── frontend/          # React 19 + Vite + Tauri Desktop App
│   │   ├── src/
│   │   │   ├── components/  # Atomic Design (atoms/molecules/organisms/pages/templates)
│   │   │   ├── hooks/       # TanStack Query Hooks
│   │   │   ├── stores/      # TanStack Store
│   │   │   └── routes/      # TanStack Router (File-based)
│   │   └── src-tauri/       # Tauri Rust Backend
│   ├── backend/           # NestJS + Prisma + PostgreSQL
│   │   ├── src/
│   │   │   ├── modules/     # Feature Modules (Controller/Service/Repository)
│   │   │   ├── prisma/      # Database Schema & Client
│   │   │   └── common/      # Shared Utilities
│   │   └── prisma/schema.prisma
│   └── shared/
│       └── client/        # Generierte API-Clients (NICHT manuell ändern!)
├── docs/                  # Modulare Projektdokumentation
│   ├── index/             # 16 modulare Dokumentationsdateien
│   ├── architecture/      # arc42 Template (12 Dateien)
│   ├── backend-api-contracts/
│   ├── frontend-components/
│   └── development-guide/
└── .bmad/                # BMad v6 Framework (Workflow Automation)
    ├── core/             # BMad Core Module
    └── _cfg/             # Manifests (tasks, workflows, agents)
```

## 🛠️ ESSENTIAL COMMANDS

### Development

```bash
# Projekt-weit
pnpm -r dev                                    # Alle Services starten (Backend + Tauri)
pnpm -r build                                  # Alles bauen
pnpm run generate-api                          # API-Client generieren (WICHTIG!)

# Package-spezifisch
pnpm --filter @bluelight-hub/backend dev      # Nur Backend (Port 3090)
pnpm --filter @bluelight-hub/frontend dev     # Tauri Desktop App (Port 3091)
pnpm --filter @bluelight-hub/frontend dev:vite # Nur Vite Dev Server (Port 3091)

# Database
pnpm --filter @bluelight-hub/backend prisma:migrate  # Migrations ausführen
pnpm --filter @bluelight-hub/backend prisma:studio   # Prisma Studio öffnen

# Code Quality
pnpm lint                                      # Biome lint + fix
pnpm lint:check                               # Biome check ohne fix

# Backend Documentation
pnpm --filter @bluelight-hub/backend docs:generate  # Compodoc generieren
```

### Environment

- **Backend:** `http://localhost:3090`
  - API: `http://localhost:3090/api`
  - Swagger UI: `http://localhost:3090/api`
  - API Spec: `http://localhost:3090/api-json`
- **Frontend:** `http://localhost:3091` (Vite Dev Server + Tauri Window)
- **Database:** PostgreSQL 17 (Port 3092 Docker Host, siehe `.env` für Connection String)
- **Prisma Studio:** `http://localhost:3093`

## 🏗️ CODE PATTERNS

### Frontend (Atomic Design + TanStack Ecosystem)

```typescript
// Component-Struktur
atoms/      # Basis-Komponenten (Buttons, Inputs, Icons)
molecules/  # Kombinierte Komponenten (Form Fields, Cards)
organisms/  # Komplexe Module (Forms, Tables, Modals)
templates/  # Seiten-Layouts
pages/      # Route-Komponenten

// API Integration (IMMER generierter Client!)
import { api } from '@bluelight-hub/shared/client';
import { useQuery, useMutation } from '@tanstack/react-query';

const useEinsaetze = () => {
  return useQuery({
    queryKey: ['einsaetze'],
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

// Styling (NUR Tailwind CSS)
<div className="flex items-center gap-4 rounded-lg bg-blue-100 p-4">
  <Button variant="primary">Action</Button>
</div>
```

### Backend (NestJS Modular + OpenAPI-First)

```typescript
// Module-Struktur
controller/ # REST Endpoints (IMMER @ApiTags, @ApiOperation decorators)
service/    # Business Logic
repository/ # Data Access (Prisma)
dto/        # Data Transfer Objects (class-validator + OpenAPI decorators)

// Controller (IMMER OpenAPI decorators für API-Generation!)
@Controller('einsatz')
@ApiTags('einsatz')
export class EinsatzController {
  @Post()
  @ApiOperation({ summary: 'Einsatz erstellen' })
  @ApiCreatedResponse({ type: EinsatzDto })
  async create(@Body() dto: CreateEinsatzDto) {
    return this.service.create(dto);
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
 * Erstellt einen neuen Einsatz und benachrichtigt alle aktiven Benutzer.
 *
 * Diese Methode löst ein Event aus, damit andere Module (z.B. Notifications)
 * reagieren können, ohne direkte Abhängigkeit zu schaffen.
 */
async create(dto: CreateEinsatzDto): Promise<Einsatz> { ... }
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

| Server | Verwendung | Tools |
|--------|------------|-------|
| **Task Master** | Task-Management & TDD Workflows | `initialize_project`, `get_tasks`, `next_task`, `expand_task`, `autopilot_*` |
| **Recall** | Session-Memory & Kontext-Persistenz | `store_memory`, `search_memories`, `get_time_window_context` |
| **Context7** | Aktuelle Library-Dokumentation | `resolve-library-id`, `get-library-docs` |
| **Chrome DevTools** | Browser-Automatisierung & E2E Testing | `navigate_page`, `take_snapshot`, `click`, `fill`, `evaluate_script` |
| **IDE** | Diagnostics & Workspace Info | `getDiagnostics` |

### Chrome DevTools für Testing

**WICHTIG:** Nutze Chrome DevTools MCP für manuelle UI-Tests:

```bash
# Frontend starten (läuft auf Port 3091)
pnpm --filter @bluelight-hub/frontend dev:vite

# In Claude Code:
# 1. Neue Seite öffnen
mcp__chrome-devtools__new_page(url: "http://localhost:3091")

# 2. Snapshot nehmen (zeigt interaktive Elemente mit UIDs)
mcp__chrome-devtools__take_snapshot()

# 3. Mit Elementen interagieren
mcp__chrome-devtools__click(uid: "element-uid-from-snapshot")
mcp__chrome-devtools__fill(uid: "input-uid", value: "Test")

# 4. Network Requests prüfen
mcp__chrome-devtools__list_network_requests()

# 5. Console Logs prüfen
mcp__chrome-devtools__list_console_messages()
```

## ⚠️ WICHTIGE HINWEISE

### Tests

- **Unit/Integration Tests:** AKTUELL ÜBERSPRUNGEN (temporär)
- **E2E Tests:** Wurden entfernt
- **Manuelle Tests:** Nutze Chrome DevTools MCP (siehe oben)

### API Development Workflow

1. Backend-Endpoint mit NestJS/Swagger erstellen
2. API-Client generieren: `pnpm run generate-api`
3. Frontend nutzt generierten Client aus `@bluelight-hub/shared/client`
4. TanStack Query Hook erstellen

### Tauri Desktop App

- Frontend ist eine **Desktop-App** (Tauri), kein reiner Web-Client
- Native Features: File System Access, System Tray, Native Notifications
- Development: `pnpm --filter @bluelight-hub/frontend dev` (öffnet natives Fenster)
- Web-Only: `pnpm --filter @bluelight-hub/frontend dev:vite` (Browser)

## 📚 DOKUMENTATION

Die Projektdokumentation ist modular aufgebaut:

- **Haupt-Index:** `/docs/index/` (16 Dateien)
- **Architektur:** `/docs/architecture/` (arc42 Template, 12 Dateien)
- **API:** `/docs/backend-api-contracts/` (OpenAPI, DTOs, Endpoints)
- **Frontend:** `/docs/frontend-components/` (Atomic Design Inventory)
- **Development:** `/docs/development-guide/` (Setup, Commands, Best Practices)

**Wichtig:** Bei Architektur-Änderungen IMMER arc42-Dokumente aktualisieren!

## 🔍 QUICK REFERENCE

| Was | Wo | Tool/Command |
|-----|-----|-------------|
| **API erstellen** | Backend | NestJS + Swagger Decorators → `pnpm run generate-api` |
| **API nutzen** | Frontend | `@bluelight-hub/shared/client` + TanStack Query |
| **UI Component** | Frontend | Tailwind CSS + Headless UI (TailwindUI nur auf Anfrage) |
| **Form erstellen** | Frontend | @tanstack/react-form + Zod |
| **State Management** | Frontend | @tanstack/react-store (global), @tanstack/react-query (server) |
| **Database Migration** | Backend | `pnpm --filter @bluelight-hub/backend prisma:migrate` |
| **Code Linting** | Überall | `pnpm lint` (Biome) |
| **API Docs** | Backend | Swagger UI: `http://localhost:3090/api` |
| **Code Docs** | Backend | `pnpm --filter @bluelight-hub/backend docs:generate` (Compodoc) |
| **Manual Testing** | Frontend | Chrome DevTools MCP + `http://localhost:3091` |

---

**Mandatory:** Spreche Deutsch mit mir, produziere englischen Code, aber deutsche Dokumentation (JSDoc, Kommentare)!

_Repository:_ github.com/rubenvitt/bluelight-hub
