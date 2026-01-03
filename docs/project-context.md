---
project_name: 'Bluelight Hub'
user_name: 'Ruben'
date: '2025-12-11'
sections_completed: ['technology_stack', 'architecture', 'backend_rules', 'frontend_rules', 'testing', 'workflow', 'anti_patterns']
---

# Project Context for AI Agents

_Kritische Regeln und Patterns für konsistente Code-Implementierung. Fokus auf unobvious Details._

---

## Technology Stack

**Monorepo:** pnpm Workspaces

| Package | Stack |
|---------|-------|
| `@bluelight-hub/backend` | NestJS + Prisma + PostgreSQL |
| `@bluelight-hub/frontend` | React + Vite + Tauri (Desktop) |
| `@bluelight-hub/shared` | Generierte API-Clients (NICHT manuell editieren!) |

**Key Tools:**
- **Linter/Formatter:** Biome (NICHT ESLint/Prettier!)
- **Package Manager:** pnpm
- **Compiler:** SWC (schneller als tsc)

---

## Architecture Patterns

### Backend: Hexagonal Architecture (in Migration)

```
packages/backend/src/
├── domain/          # Pure Business Logic (KEINE Framework-Deps!)
├── application/     # Use Cases/Handlers (nur @Injectable erlaubt)
├── infrastructure/  # Adapter (Prisma, NestJS)
└── modules/         # Controller + Legacy Services
```

### Frontend: Atomic Design + TanStack

```
packages/frontend/src/
├── components/
│   ├── atoms/       # Button, Input, Badge
│   ├── molecules/   # FormField, Card
│   ├── organisms/   # EinsatzForm, DataTable
│   ├── templates/   # Layouts
│   └── pages/       # Route-Komponenten
├── hooks/           # TanStack Query Hooks
├── stores/          # TanStack Store
└── routes/          # TanStack Router (file-based)
```

---

## Backend Rules (CRITICAL)

### AC1: DI Import Check

```typescript
// ✅ RICHTIG: Regular import für Injectable Classes
import { MyService } from './my.service';

// ❌ FALSCH: import type bricht NestJS DI zur Laufzeit!
import type { MyService } from './my.service';
```

**Warum:** `import type` wird zur Compile-Zeit entfernt. NestJS braucht das Runtime-Symbol.

### AC2: DI Token Constants

```typescript
// ✅ RICHTIG: Zentralisierte Tokens in di-tokens.ts
@Inject(DI_TOKENS.REPOSITORIES.EINSATZ)
private readonly repository: IEinsatzRepository

// ❌ FALSCH: String-Literals
@Inject('IEinsatzRepository')  // Typo-anfällig!
```

**Pfad:** `packages/backend/src/infrastructure/di-tokens.ts`

### AC3: Framework-Agnostizität

**Application Layer darf NICHT importieren:**
- `@Controller`, `@Get`, `@Post`, etc.
- `HttpException`, `BadRequestException`
- `Request`, `Response` von Express

**Erlaubt:** `@Injectable`, `@Inject`, `@Optional`

```typescript
// ✅ Application Layer
import { Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';

@Injectable()
export class CreateEinsatzHandler {
  async execute(command: CreateEinsatzCommand): Promise<Result<string>> {
    // Pure business logic
  }
}

// Controller übersetzt Result → HTTP
@Controller('einsatz')
export class EinsatzController {
  @Post()
  async create(@Body() dto: CreateEinsatzDto) {
    const result = await this.handler.execute(command);
    if (result.isFailure) {
      throw new BadRequestException(result.error);  // Hier OK!
    }
    return result.value;
  }
}
```

### AC4: Result Pattern

```typescript
// ✅ RICHTIG: Result<T> für erwartete Fehler
async execute(command: CreateEinsatzCommand): Promise<Result<string>> {
  if (validation.isFailure) {
    return Result.fail(validation.error);  // Kein throw!
  }
  return Result.ok(einsatz.id.value);
}

// ❌ FALSCH: Exceptions für Business-Fehler
throw new EinsatzValidationException('Invalid');
```

**Domain Exceptions nur für:** DB-Fehler, Netzwerk-Fehler, Programming Errors

### AC5: Outbox Pattern

```typescript
// ✅ RICHTIG: TransactionalCommandHandler
export class CreateEinsatzHandler extends TransactionalCommandHandler<
  CreateEinsatzCommand,
  string
> {
  protected async executeInTransaction(
    command: CreateEinsatzCommand,
    tx: TransactionContext
  ): Promise<{ result: string; events: DomainEvent[] }> {
    const einsatz = Einsatz.create(command);
    await this.repository.save(einsatz, tx);  // Gleiche TX

    const events = einsatz.getDomainEvents();
    einsatz.clearDomainEvents();

    return { result: einsatz.id.value, events };
  }
}

// ❌ FALSCH: Events direkt emittieren
await this.eventEmitter.emit('einsatz.created', event);  // Nicht atomar!
```

### OpenAPI Decorators (Pflicht!)

```typescript
@Controller('einsatz')
@ApiTags('einsatz')
export class EinsatzController {
  @Post()
  @ApiOperation({ summary: 'Einsatz erstellen' })
  @ApiCreatedResponse({ type: EinsatzDto })
  async create(@Body() dto: CreateEinsatzDto) { ... }
}
```

### DTO Pattern

```typescript
export class CreateEinsatzDto {
  @ApiProperty({ description: 'Einsatznummer' })
  @IsString()
  nummer: string;

  @ApiPropertyOptional({ description: 'Einsatzort' })
  @IsOptional()
  @IsString()
  ort?: string;
}
```

---

## Frontend Rules (CRITICAL)

### API Client: NIEMALS manuell!

```typescript
// ✅ RICHTIG: Generierter Client + TanStack Query
import { api } from '@bluelight-hub/shared/client';

const useEinsaetze = () => {
  return useQuery({
    queryKey: ['einsaetze'],
    queryFn: () => api.einsatz.findAll(),
  });
};

// ❌ FALSCH: Manueller fetch
const fetchEinsaetze = () => fetch('/api/einsatz');
```

**Workflow:** Backend-Änderung → `pnpm run generate-api` → Hook erstellen

### State Management

| Typ | Library | Verwendung |
|-----|---------|------------|
| Server State | @tanstack/react-query | API-Daten |
| Global State | @tanstack/react-store | UI-State |
| Forms | @tanstack/react-form + Zod | Formulare |
| Routing | @tanstack/react-router | File-based |
| Timing | @tanstack/pacer | Debounce/Throttle |

**NIEMALS:** Redux, HTML Forms, andere State-Libraries

### Forms

```typescript
import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';

const form = useForm({
  defaultValues: { name: '' },
  validatorAdapter: zodValidator(),
  validators: {
    onChange: z.object({ name: z.string().min(3) }),
  },
});
```

### Styling: NUR Tailwind CSS

```typescript
// ✅ RICHTIG
<div className="flex items-center gap-4 rounded-lg bg-blue-100 p-4">

// ❌ FALSCH: CSS-in-JS, styled-components, andere Frameworks
const StyledDiv = styled.div`...`;
```

**TailwindUI:** IMMER beim User anfragen! Nie selbst erfinden.

---

## Testing Rules (AC6)

### AAA Pattern mit Given-When-Then

```typescript
describe('CreateEinsatzHandler', () => {
  let handler: CreateEinsatzHandler;
  let mockRepository: jest.Mocked<IEinsatzRepository>;

  beforeEach(() => {
    jest.clearAllMocks();  // WICHTIG!
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

**Pflicht:**
- `jest.clearAllMocks()` in beforeEach
- `jest.Mocked<T>` für Service Mocks
- Given-When-Then Kommentare

---

## Development Workflow

### Commit Format

```
<emoji>(<scope>): <title>
```

| Emoji | Typ | Version |
|-------|-----|---------|
| 💥 | Breaking | Major |
| ✨ | Feature | Minor |
| 🐛 | Fix | Patch |
| 🚑 | Hotfix | Patch |
| 🔒 | Security | Patch |
| ♻️ | Refactor | Patch |
| 📝 | Docs | - |
| 🔧 | Config | - |

### Git Rules

- **NIEMALS** `--no-verify` verwenden
- **IMMER** nach jedem Subtask committen
- Pre-commit: Husky + lint-staged (Biome)

### Essential Commands

```bash
# Development
pnpm -r dev                                    # Alle Services
pnpm --filter @bluelight-hub/backend dev      # Backend (Port 3091)
pnpm --filter @bluelight-hub/frontend dev:vite # Frontend (Port 3090)

# API Client generieren (WICHTIG nach Backend-Änderungen!)
pnpm run generate-api

# Code Quality
pnpm lint                                      # Biome fix
pnpm lint:check                               # Biome check

# Database
pnpm --filter @bluelight-hub/backend prisma:migrate
pnpm --filter @bluelight-hub/backend prisma:studio  # Port 3093

# JSDoc Check (Backend public APIs)
pnpm --filter @bluelight-hub/backend check:jsdoc:public
```

### Ports

| Service | Port |
|---------|------|
| Backend API | 3091 |
| Swagger UI | 3091/api |
| Frontend | 3090 |
| PostgreSQL | 3092 |
| Prisma Studio | 3093 |

---

## Anti-Patterns (NIEMALS!)

### Backend

```typescript
// ❌ import type für DI Classes
import type { MyService } from './my.service';

// ❌ String-Literals für DI Tokens
@Inject('IRepository')

// ❌ HTTP-Konzepte in Application Layer
import { HttpException } from '@nestjs/common';

// ❌ throw statt Result für Business-Fehler
throw new ValidationException('Invalid');

// ❌ Events außerhalb Outbox
await this.eventEmitter.emit('event', data);
```

### Frontend

```typescript
// ❌ Manuelle API Calls
fetch('/api/einsatz')

// ❌ Andere State Libraries
import { useSelector } from 'react-redux';

// ❌ Andere CSS Frameworks
import 'bootstrap/dist/css/bootstrap.min.css';

// ❌ HTML Forms
<form onSubmit={handleSubmit}>
```

### Workflow

```bash
# ❌ Pre-commit Hooks umgehen
git commit --no-verify

# ❌ ESLint/Prettier verwenden
eslint --fix  # Nutze: pnpm lint
```

---

## File Naming Conventions

### Backend

```
{feature}.{layer}.{type}.ts

einsatz.entity.ts
create-einsatz.command.ts
create-einsatz.handler.ts
i-einsatz.repository.ts      # Interface (Port)
prisma-einsatz.repository.ts # Implementation (Adapter)
```

### Frontend

```
{ComponentName}.tsx          # PascalCase
use{Feature}.hook.ts         # camelCase
{feature}.store.ts
{component}.test.tsx
```

### Tests

```
*.spec.ts                    # Unit Tests
*.e2e.spec.ts               # E2E Tests
*.integration.spec.ts        # Integration Tests
```

---

## JSDoc (Backend)

**Sprache:** Deutsch
**Fokus:** "Warum", nicht "Was"

```typescript
/**
 * Erstellt einen neuen Einsatz und benachrichtigt alle aktiven Benutzer.
 *
 * Diese Methode löst ein Event aus, damit andere Module (z.B. Notifications)
 * reagieren können, ohne direkte Abhängigkeit zu schaffen.
 */
async create(dto: CreateEinsatzDto): Promise<Einsatz> { ... }
```

---

## Quick Reference

| Task | Command/Location |
|------|------------------|
| API erstellen | NestJS + Swagger → `pnpm run generate-api` |
| API nutzen | `@bluelight-hub/shared/client` + TanStack Query |
| UI Component | Tailwind CSS + Headless UI |
| Form erstellen | @tanstack/react-form + Zod |
| Database Migration | `pnpm --filter @bluelight-hub/backend prisma:migrate` |
| Code Linting | `pnpm lint` |
| DI Tokens | `packages/backend/src/infrastructure/di-tokens.ts` |
| Domain Entities | `packages/backend/src/domain/{context}/` |
| Handlers | `packages/backend/src/application/{context}/commands/` |

---

**Mandatory:** Spreche Deutsch mit dem User, produziere englischen Code, aber deutsche Dokumentation (JSDoc, Kommentare)!
