# 3. Backend Architecture

## Hexagonale Architektur (Aktuelle Architektur)

Das Backend nutzt seit der Migration **Hexagonale Architektur** (Ports & Adapters) mit **Domain-Driven Design (DDD)** und **CQRS**-Pattern. Die Architektur basiert auf strikter Dependency-Direction und Framework-Agnostizität im Domain Layer.

### Layer-Diagramm

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Infrastructure Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Controllers │  │   Prisma    │  │   Outbox    │  │  External   │ │
│  │  (REST API) │  │ Repositories│  │  Publisher  │  │  Services   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
│         │                │                │                │         │
└─────────┼────────────────┼────────────────┼────────────────┼─────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Application Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Commands   │  │   Queries   │  │   Event     │  │    DTOs     │ │
│  │  Handlers   │  │   Handlers  │  │  Handlers   │  │             │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────┘ │
│         │                │                │                          │
└─────────┼────────────────┼────────────────┼──────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Domain Layer                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Aggregates  │  │   Value     │  │  Domain     │  │ Repository  │ │
│  │   (Roots)   │  │  Objects    │  │   Events    │  │   Ports     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                                      │
│                    ▲ NO OUTGOING DEPENDENCIES ▲                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Domain Layer (Framework-Agnostic Core)

Der Domain Layer ist das **Herz der Anwendung** und enthält die gesamte Business-Logik. Er ist vollständig framework-agnostisch und hat **keine ausgehenden Abhängigkeiten**.

**Location:** `packages/backend/src/domain/`

**4 Aggregate Roots:**

| Aggregate | Verantwortlichkeit | Entities | Value Objects |
|-----------|-------------------|----------|---------------|
| **Einsatz** | Einsatzmanagement | - | EinsatzId, EinsatzStatus, Alarmstichwort, Einsatzort, Fahrzeuge |
| **Einsatztagebuch** | Tagebuch-Logik | EtbEintrag | EtbId, EtbKategorie, EtbAutor, EtbInhalt |
| **User** | Benutzerverwaltung | - | UserId, Username, Role |
| **Lagekarte** | Karten-Management | LagekartePoi | LagekarteId, PoiId, Koordinaten |

**Komponenten:**

```
domain/
├── aggregates/           # Aggregate Roots (Consistency Boundaries)
│   ├── einsatz/         # Einsatz Aggregate mit Business Rules
│   ├── etb/             # Einsatztagebuch Aggregate
│   ├── user/            # User Aggregate
│   └── lagekarte/       # Lagekarte Aggregate
├── value-objects/       # Value Objects (Immutable)
│   ├── einsatz-id.value-object.ts
│   ├── einsatz-status.value-object.ts
│   └── ...
├── events/              # Domain Events (Aggregate State Changes)
│   ├── einsatz-created.event.ts
│   ├── einsatz-archived.event.ts
│   └── ...
└── repositories/        # Repository Ports (Interfaces)
    ├── i-einsatz-repository.ts
    ├── i-etb-repository.ts
    └── ...
```

**Framework-Agnostizität:**

- ✅ **Erlaubt:** `@Injectable` (NestJS DI nur für Dependency Injection)
- ❌ **Verboten:** Alle anderen Framework-spezifischen Decorators
  - `@Controller`, `@Get`, `@Post`, `@UseGuards`
  - `HttpException`, `Response`, `Request`
  - Express/Fastify Typen
  - Prisma Typen

**Domain-Invarianten:**

- Aggregate Roots erzwingen Business-Regeln (z.B. NO-DELETE Policy)
- Value Objects garantieren Validierung (z.B. EinsatzStatus nur gültige Werte)
- Domain Events dokumentieren State-Changes
- Repository Ports definieren Persistierungs-Contracts

### Application Layer (CQRS Orchestration)

Der Application Layer orchestriert die Business-Logik via **CQRS** (Command Query Responsibility Segregation).

**Location:** `packages/backend/src/application/`

**CQRS Pattern:**

| Pattern | Verwendung | Return Type | Side Effects |
|---------|------------|-------------|--------------|
| **Commands** | State-Changing Operations (Create, Update, Delete) | `Result<T>` | Writes to DB, emits Domain Events |
| **Queries** | Read Operations (optimiert, kein Domain-Modell) | `Result<T>` | Read-Only, darf Domain umgehen |

**Struktur:**

```
application/
├── einsatz/
│   ├── commands/                     # Command Handlers
│   │   ├── create-einsatz.handler.ts
│   │   ├── update-einsatz.handler.ts
│   │   └── archive-einsatz.handler.ts
│   ├── queries/                      # Query Handlers
│   │   ├── get-active-einsaetze.handler.ts
│   │   └── get-einsatz-details.handler.ts
│   └── events/                       # Domain Event Handlers
│       └── einsatz-created.event-handler.ts
├── etb/
│   ├── commands/
│   ├── queries/
│   └── events/
├── lagekarte/
│   ├── commands/
│   └── queries/
└── common/
    ├── handlers/
    │   └── transactional-command-handler.ts  # Base Class mit Outbox
    ├── result.ts                              # Result<T> Pattern
    └── transaction-context.ts                 # Prisma Transaction Type
```

**TransactionalCommandHandler Pattern:**

Alle Command Handler erben von `TransactionalCommandHandler<TCommand, TResult>` für atomare Event-Persistierung:

```typescript
@Injectable()
export class CreateEinsatzHandler extends TransactionalCommandHandler<
  CreateEinsatzCommand,
  string
> {
  protected async executeInTransaction(
    command: CreateEinsatzCommand,
    tx: TransactionContext
  ): Promise<{ result: string; events: DomainEvent[] }> {
    // 1. Aggregate erstellen
    const einsatz = Einsatz.create(command);

    // 2. In Transaction speichern
    await this.repository.save(einsatz, tx);

    // 3. Domain Events extrahieren
    const events = einsatz.getDomainEvents();
    einsatz.clearDomainEvents();

    // 4. Base Handler speichert Events atomar in Outbox
    return { result: einsatz.id.value, events };
  }
}
```

**Framework-Agnostizität:**

- ✅ **Erlaubt:** `@Injectable`, `@Inject`, `@Optional`
- ❌ **Verboten:** HTTP-spezifische Decorators, Response/Request Typen
- **Result<T> Pattern:** Keine Exceptions für erwartete Fehler

### Infrastructure Layer (Adapters)

Der Infrastructure Layer implementiert die **Adapters** für externe Systeme und Frameworks.

**Location:** `packages/backend/src/infrastructure/`

**Komponenten:**

```
infrastructure/
├── einsatz/                         # Einsatz Adapters
│   ├── controllers/                # REST API Endpoints
│   │   └── einsatz.controller.ts  # @Controller, @ApiTags
│   ├── repositories/               # Prisma Implementations
│   │   └── prisma-einsatz.repository.ts
│   └── __tests__/                  # E2E Integration Tests
├── etb/                            # ETB Adapters
│   ├── controllers/
│   ├── repositories/
│   └── __tests__/
├── lagekarte/                      # Lagekarte Adapters
│   ├── controllers/
│   ├── repositories/
│   └── __tests__/
├── user/                           # User Adapters
│   ├── controllers/
│   ├── repositories/
│   └── __tests__/
├── outbox/                         # Transactional Outbox
│   ├── outbox-event-publisher.service.ts
│   └── prisma-outbox.repository.ts
└── common/
    └── prisma.service.ts           # Prisma Client Wrapper
```

**Controller (HTTP Adapter):**

Hier sind **alle NestJS Decorators erlaubt**:

```typescript
@Controller('api/alpha/einsaetze')
@ApiTags('einsatz')
export class EinsatzController {
  constructor(
    @Inject('CreateEinsatzHandler')
    private readonly createHandler: CreateEinsatzHandler
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Einsatz erstellen' })
  async create(@Body() dto: CreateEinsatzDto, @CurrentUser() user: User) {
    const command = CreateEinsatzCommand.create(dto, user.id);
    const result = await this.createHandler.execute(command);

    if (result.isFailure) {
      throw new BadRequestException(result.error);
    }

    return result.value;
  }
}
```

**Prisma Repository (Persistence Adapter):**

Implementiert Domain Repository Ports:

```typescript
@Injectable()
export class PrismaEinsatzRepository implements IEinsatzRepository {
  async save(
    aggregate: Einsatz,
    tx?: TransactionContext
  ): Promise<Result<void>> {
    const client = tx ?? this.prisma;

    await client.einsatz.upsert({
      where: { id: aggregate.id.value },
      create: this.toPrismaCreate(aggregate),
      update: this.toPrismaUpdate(aggregate),
    });

    return Result.ok();
  }

  // Mapping: Domain ↔ Prisma
  private toPrismaCreate(aggregate: Einsatz): Prisma.EinsatzCreateInput { ... }
  private toDomain(prismaEinsatz: PrismaEinsatz): Einsatz { ... }
}
```

**Outbox Publisher (Event Adapter):**

Pollt Outbox Table und publiziert Events:

```typescript
@Injectable()
export class OutboxEventPublisher implements OnModuleInit {
  @Cron(CronExpression.EVERY_5_SECONDS)
  async publishPendingEvents() {
    await this.prisma.$transaction(async (tx) => {
      // FOR UPDATE SKIP LOCKED für Race-Condition-Prevention
      const events = await this.outboxRepository.findAndLockPending(100, tx);

      for (const event of events) {
        try {
          await this.eventBus.publish(event.eventName, event.payload);
          await this.outboxRepository.markAsPublished(event.id, tx);
        } catch (error) {
          await this.outboxRepository.markAsFailed(event.id, error.message, tx);
        }
      }
    });
  }
}
```

### Dependency Direction Rules

Die Hexagonale Architektur erzwingt strikte Dependency-Richtung:

```
Domain ← Application ← Infrastructure
  ↑          ↑              ↑
  └──────────┴──────────────┘
     NO OUTGOING DEPENDENCIES
```

**Erlaubte Abhängigkeiten:**

| Layer | Darf importieren | Darf NICHT importieren |
|-------|------------------|------------------------|
| **Domain** | - (keine!) | Application, Infrastructure, NestJS (außer @Injectable) |
| **Application** | Domain, @nestjs/common (nur @Injectable, @Inject) | Infrastructure, HTTP-Decorators |
| **Infrastructure** | Domain, Application, NestJS (alle), Prisma, Express | - (darf alles) |

**DI Token Constants (AC2):**

DI Token Strings als Constants definiert (nicht inline String-Literals):

```typescript
// packages/backend/src/infrastructure/di-tokens.ts
export const DI_TOKENS = {
  REPOSITORIES: {
    EINSATZ: Symbol('IEinsatzRepository'),
    ETB: Symbol('IEtbRepository'),
    USER: Symbol('IUserRepository'),
    LAGEKARTE: Symbol('ILagekarteRepository'),
  },
  HANDLERS: {
    CREATE_EINSATZ: Symbol('CreateEinsatzHandler'),
    UPDATE_EINSATZ: Symbol('UpdateEinsatzHandler'),
  },
} as const;

// Verwendung in Modules
providers: [
  {
    provide: DI_TOKENS.REPOSITORIES.EINSATZ,
    useClass: PrismaEinsatzRepository,
  },
]

// Verwendung in Constructors
constructor(
  @Inject(DI_TOKENS.REPOSITORIES.EINSATZ)
  private readonly repository: IEinsatzRepository,
) {}
```

**Import Check (AC1):**

```typescript
// ✅ RICHTIG: import für DI-Injectable Classes
import { MyService } from './my.service';
import { IRepository } from '../domain/repositories/i-repository';

// ❌ FALSCH: import type bricht NestJS DI zur Laufzeit!
import type { MyService } from './my.service';
```

**Warum:** TypeScript's `import type` wird zur Compile-Zeit entfernt. NestJS DI benötigt das Runtime-Symbol für Dependency Injection.

### Module Structure (Hexagonal Architecture)

Aktualisierte Verzeichnisstruktur:

```
packages/backend/src/
├── domain/                    # Domain Layer (Framework-Agnostic)
│   ├── aggregates/           # Aggregate Roots
│   │   ├── einsatz/
│   │   ├── etb/
│   │   ├── user/
│   │   └── lagekarte/
│   ├── value-objects/        # Value Objects
│   │   ├── einsatz-id.value-object.ts
│   │   ├── einsatz-status.value-object.ts
│   │   └── ...
│   ├── events/               # Domain Events
│   │   ├── einsatz-created.event.ts
│   │   ├── einsatz-archived.event.ts
│   │   └── ...
│   └── repositories/         # Repository Ports (Interfaces)
│       ├── i-einsatz-repository.ts
│       ├── i-etb-repository.ts
│       ├── i-user-repository.ts
│       └── i-lagekarte-repository.ts
├── application/              # Application Layer (CQRS)
│   ├── einsatz/
│   │   ├── commands/         # Command Handlers
│   │   │   ├── create-einsatz.handler.ts
│   │   │   ├── update-einsatz.handler.ts
│   │   │   └── archive-einsatz.handler.ts
│   │   ├── queries/          # Query Handlers
│   │   │   ├── get-active-einsaetze.handler.ts
│   │   │   └── get-einsatz-details.handler.ts
│   │   └── events/           # Domain Event Handlers
│   │       └── einsatz-created.event-handler.ts
│   ├── etb/
│   │   ├── commands/
│   │   ├── queries/
│   │   └── events/
│   ├── lagekarte/
│   │   ├── commands/
│   │   └── queries/
│   ├── user/
│   │   ├── commands/
│   │   └── queries/
│   └── common/               # Shared (TransactionalCommandHandler)
│       ├── handlers/
│       │   └── transactional-command-handler.ts
│       ├── result.ts
│       └── transaction-context.ts
├── infrastructure/           # Infrastructure Layer
│   ├── einsatz/              # Einsatz Adapters
│   │   ├── controllers/      # REST API Endpoints
│   │   │   └── einsatz.controller.ts
│   │   ├── repositories/     # Prisma Implementations
│   │   │   └── prisma-einsatz.repository.ts
│   │   └── __tests__/        # E2E Integration Tests
│   ├── etb/                  # ETB Adapters
│   │   ├── controllers/
│   │   ├── repositories/
│   │   └── __tests__/
│   ├── lagekarte/            # Lagekarte Adapters
│   │   ├── controllers/
│   │   ├── repositories/
│   │   └── __tests__/
│   ├── user/                 # User Adapters
│   │   ├── controllers/
│   │   ├── repositories/
│   │   └── __tests__/
│   ├── outbox/               # Transactional Outbox
│   │   ├── outbox-event-publisher.service.ts
│   │   ├── prisma-outbox.repository.ts
│   │   └── __tests__/
│   ├── common/
│   │   └── prisma.service.ts
│   └── di-tokens.ts          # DI Token Constants
└── modules/                  # NestJS Module Definitions
    ├── einsatz.module.ts
    ├── etb.module.ts
    ├── lagekarte.module.ts
    ├── user.module.ts
    └── outbox.module.ts
```

### Vorteile der Hexagonalen Architektur

| Aspekt | Vorteil |
|--------|---------|
| **Testbarkeit** | Domain-Logik isoliert testbar ohne Framework-Abhängigkeiten |
| **Framework-Wechsel** | NestJS austauschbar (nur Infrastructure Layer ändern) |
| **Database-Wechsel** | Prisma austauschbar (nur Repositories ändern) |
| **Business-Logik-Fokus** | Domain-Experten können Domain Layer verstehen (kein Framework-Overhead) |
| **Dependency Injection** | Klare Contracts via Repository Ports |
| **Event-Driven** | Domain Events dokumentieren State-Changes |
| **CQRS** | Read/Write-Separation für Performance-Optimierung |
| **Transactional Outbox** | Atomare Event-Persistierung, Retry-Safe |

---

## Legacy 3-Tier Architecture (Vor Migration)

**HINWEIS:** Die folgenden Abschnitte beschreiben die alte 3-Tier Architektur, die vor der Hexagonal Architecture Migration genutzt wurde. Sie sind als Referenz und für historischen Kontext dokumentiert.

## Module Structure (ACTUAL)

Das Backend besteht aus **7 funktionalen Modulen** (nicht die 8+ in arc42 beschriebenen):

```
packages/backend/src/
├── auth/                    # Authentifizierung (Unified Auth)
├── einsatz/                 # Einsatzmanagement
├── etb/                     # Einsatztagebuch
├── user-management/         # Benutzerverwaltung
├── modules/
│   └── lagekarte/          # Lagekarten-Management
├── health/                  # Health Checks
├── config/                  # Konfiguration
├── common/                  # Shared utilities
├── prisma/                  # Prisma client
├── cli/                     # CLI-Tools
├── utils/                   # Helper functions
└── websocket/              # WebSocket (leer, nicht implementiert)
```

**Fehlende Module aus arc42:**
- ❌ Ressource Module (Personal, Fahrzeuge, Material)
- ❌ Dashboard Module (nur Frontend)
- ❌ Digitalfunk Integration
- ❌ Kommunikation Module

## API Design

### Versioning Strategy

- **VERSION_NEUTRAL:** `/api/{endpoint}` für Auth, Health, Root
- **Alpha Version:** `/api/alpha/{resource}` für Domain-Endpunkte

### Authentication Pattern

**3-Token Cookie-basiertes JWT System:**

1. **Access Token:** Short-lived, für API-Zugriff
2. **Refresh Token:** Long-lived, für Token-Erneuerung
3. **Admin Token:** Für administrative Operationen

**Cookie Settings:**
- `httpOnly: true` (XSS-Schutz)
- `secure: true` (nur HTTPS in Production)
- `sameSite: 'strict'` (CSRF-Schutz)

**Guards:**
- `@UseGuards(JwtAuthGuard)` - Standard-Auth
- `@UseGuards(AdminJwtAuthGuard)` - Admin-Auth
- `@UseGuards(JwtRefreshGuard)` - Refresh-Auth

### Rate Limiting

**Throttle Guards auf kritischen Endpunkten:**
- `/api/auth/unified`: 5 Requests / Minute
- Controller-Level: Konfigurierbar via `@Throttle()`
- Service-Level: Zusätzliche Limits

### Response Format

**Automatic Response Wrapping via Interceptor:**

```typescript
// Original Service Response
{ id: '123', name: 'Test' }

// Wrapped API Response
{
  data: { id: '123', name: 'Test' },
  statusCode: 200,
  timestamp: '2025-01-11T...'
}
```

## API Endpoints (54 Total)

### Authentication (VERSION_NEUTRAL)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/unified` | Unified login & auto-register | No |
| POST | `/api/auth/logout` | Logout (clear cookies) | Yes |
| POST | `/api/auth/refresh` | Refresh access token | Refresh |
| GET | `/api/auth/validate` | Validate current token | Yes |

### User Management (/api/alpha/users)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/users` | List all users | Admin |
| GET | `/api/alpha/users/:id` | Get user by ID | Admin |
| POST | `/api/alpha/users` | Create user | Admin |
| PATCH | `/api/alpha/users/:id` | Update user | Admin |
| DELETE | `/api/alpha/users/:id` | Soft-delete user | Admin |
| POST | `/api/alpha/users/:id/lock` | Lock user | Admin |
| POST | `/api/alpha/users/:id/unlock` | Unlock user | Admin |

### Einsatz Management (/api/alpha/einsaetze)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/einsaetze` | List all missions | Yes |
| GET | `/api/alpha/einsaetze/:id` | Get mission by ID | Yes |
| POST | `/api/alpha/einsaetze` | Create mission (minimal) | Yes |
| PATCH | `/api/alpha/einsaetze/:id` | Update mission | Yes |
| DELETE | `/api/alpha/einsaetze/:id` | Archive mission (no delete) | Yes |
| POST | `/api/alpha/einsaetze/:id/archive` | Explicit archive | Yes |

### Einsatztagebuch (/api/alpha/einsatztagebuch)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/einsatztagebuch` | List all ETBs | Yes |
| GET | `/api/alpha/einsatztagebuch/:id` | Get ETB by ID | Yes |
| POST | `/api/alpha/einsatztagebuch` | Create ETB | Yes |
| PATCH | `/api/alpha/einsatztagebuch/:id` | Update ETB | Yes |
| POST | `/api/alpha/einsatztagebuch/:id/lock` | Lock ETB | Yes |

### ETB Einträge (/api/alpha/etb-eintraege)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/etb-eintraege` | List entries | Yes |
| GET | `/api/alpha/etb-eintraege/:id` | Get entry by ID | Yes |
| POST | `/api/alpha/etb-eintraege` | Create entry | Yes |
| PATCH | `/api/alpha/etb-eintraege/:id` | Update entry (creates version) | Yes |
| DELETE | `/api/alpha/etb-eintraege/:id` | Soft-delete entry | Yes |
| GET | `/api/alpha/etb-eintraege/:id/historie` | Get version history | Yes |

### ETB Textbausteine (/api/alpha/textbausteine)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/textbausteine` | List templates | Yes |
| GET | `/api/alpha/textbausteine/:id` | Get template by ID | Yes |
| POST | `/api/alpha/textbausteine` | Create template | Yes |
| PATCH | `/api/alpha/textbausteine/:id` | Update template | Yes |
| DELETE | `/api/alpha/textbausteine/:id` | Soft-delete template | Yes |

### Lagekarte (/api/alpha/lagekarten)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/lagekarten` | List all maps | Yes |
| GET | `/api/alpha/lagekarten/:id` | Get map by ID | Yes |
| POST | `/api/alpha/lagekarten` | Create map | Yes |
| PATCH | `/api/alpha/lagekarten/:id` | Update map | Yes |
| DELETE | `/api/alpha/lagekarten/:id` | Delete map | Yes |

### Lagekarte POIs (/api/alpha/lagekarten/:id/pois)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/lagekarten/:id/pois` | List POIs | Yes |
| POST | `/api/alpha/lagekarten/:id/pois` | Create POI | Yes |
| PATCH | `/api/alpha/lagekarten/:id/pois/:poiId` | Update POI | Yes |
| DELETE | `/api/alpha/lagekarten/:id/pois/:poiId` | Delete POI | Yes |

### Geocoding (/api/alpha/geocoding)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/geocoding/search` | Search by address | Yes |
| GET | `/api/alpha/geocoding/reverse` | Reverse geocode | Yes |

### Health Checks (VERSION_NEUTRAL)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Overall health | No |
| GET | `/api/health/liveness` | Liveness probe | No |
| GET | `/api/health/readiness` | Readiness probe | No |

### Root Meta (VERSION_NEUTRAL)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | API metadata | No |

## Data Layer

### ORM & Database

- **ORM:** Prisma 6.19.0
- **Database:** PostgreSQL 17
- **Migration Strategy:** Prisma Migrate with SQL migrations
- **ID Generation:** `cuid()` (primary)

### Data Models (9 Models)

1. **User** - Benutzerverwaltung mit Soft-Delete und Lock
2. **Einsatz** - Einsätze mit No-Delete Policy
3. **Einsatztagebuch** - 1:1 Beziehung zu Einsatz
4. **EtbEintrag** - Versionierte Einträge
5. **EtbEintragHistorie** - Vollständige Versionshistorie
6. **EtbTextbaustein** - Wiederverwendbare Textbausteine
7. **EtbArchiv** - 10-Jahre-Archivierung mit SHA-256
8. **Lagekarte** - 1:1 Beziehung zu Einsatz
9. **LagekartePoi** - Geografische POIs

### Key Patterns

**No-Delete Policy (Einsätze):**
- Einsätze werden NIEMALS physisch gelöscht
- Stattdessen: Archivierung mit `archivedAt`, `archivedBy`
- Status-Transition: `ANGELEGT` → `IN_BEARBEITUNG` → `ABGESCHLOSSEN` → `ARCHIVIERT`

**Soft-Delete (Users, ETB Entries):**
- `isDeleted: boolean`, `deletedAt: DateTime`, `deletedBy: String`
- Queries filtern automatisch gelöschte Einträge

**Full Audit Logging:**
- **Created:** `createdAt`, `createdBy` (auf allen Entitäten)
- **Updated:** `updatedAt`, `updatedBy` (auf allen Entitäten)
- **Deleted:** `deletedAt`, `deletedBy` (Soft-Delete)
- **Archived:** `archivedAt`, `archivedBy` (Einsätze)
- **Locked:** `lockedAt`, `lockedBy` (ETB)

**Version History (ETB Entries):**
- Jede Änderung erstellt einen neuen `EtbEintragHistorie`-Eintrag
- Historie enthält: `modifiedAt`, `modifiedBy`, `changes` (JSON)
- Vollständige Nachvollziehbarkeit aller Änderungen

**10-Year Archival (ETB):**
- `EtbArchiv` speichert vollständigen ETB-Snapshot
- SHA-256 Checksum für Integrität
- Compliance-konform für DRK-Anforderungen

## Transactional Outbox Pattern

### Overview

Das Backend nutzt das **Transactional Outbox Pattern** für garantiert atomare Persistierung von Aggregates und Domain Events. Dieses Pattern verhindert "lost events" bei Datenbank-Fehlern und ermöglicht Retry-Logic für fehlgeschlagene Event-Publishes.

**Kernproblem:**
- Aggregate speichern und Events publishen sind zwei separate Operationen
- Bei Fehler nach Aggregate-Save gehen Events verloren
- Keine Transaktionsgarantie über Datenbank und Event Bus hinweg

**Lösung:**
- Aggregate **und** Events werden in einer Datenbank-Transaktion gespeichert
- Outbox Table als "Event Queue" in derselben DB
- OutboxEventPublisher pollt Outbox und publiziert Events asynchron
- Retry-Mechanismus für fehlgeschlagene Publishes

### Architecture Components

#### 1. TransactionalCommandHandler Base Class

Abstrakte Base Class für alle Command Handler mit Outbox-Support:

```typescript
@Injectable()
export abstract class TransactionalCommandHandler<TCommand, TResult> {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly outboxRepository: IOutboxRepository,
  ) {}

  /**
   * Template Method Pattern:
   * 1. Start Transaction
   * 2. Call executeInTransaction() (implementiert von Child)
   * 3. Save Events to Outbox (atomar)
   * 4. Commit Transaction
   * 5. Wrap Result in Result<T>
   */
  async execute(command: TCommand): Promise<Result<TResult>> {
    try {
      const { result, events } = await this.prisma.$transaction(async (tx) => {
        // Child Handler implementiert Business Logic
        const handlerResult = await this.executeInTransaction(command, tx);

        // Save Events to Outbox (atomically in same TX)
        if (handlerResult.events.length > 0) {
          await this.outboxRepository.saveEvents(handlerResult.events, tx);
        }

        return handlerResult;
      });

      return Result.ok(result);
    } catch (error) {
      // Transaction Rollback (automatic)
      return Result.fail(error.message);
    }
  }

  /**
   * Child Handler implementiert diese Methode.
   * WICHTIG: Nutze `tx` Parameter für alle DB-Operationen!
   */
  protected abstract executeInTransaction(
    command: TCommand,
    tx: PrismaTransaction,
  ): Promise<{ result: TResult; events: DomainEvent[] }>;
}
```

**Verwendung in Command Handlers:**

```typescript
@Injectable()
export class CreateEinsatzHandler extends TransactionalCommandHandler<CreateEinsatzCommand, string> {
  constructor(
    prisma: PrismaService,
    outboxRepository: IOutboxRepository,
    @Inject('IEinsatzRepository') private repository: IEinsatzRepository,
  ) {
    super(prisma, outboxRepository);
  }

  protected async executeInTransaction(
    command: CreateEinsatzCommand,
    tx: PrismaTransaction,
  ): Promise<{ result: string; events: DomainEvent[] }> {
    // 1. Create Aggregate
    const einsatz = Einsatz.create({ ... });

    // 2. Save Aggregate in Transaction (WICHTIG: Nutze tx!)
    await this.repository.save(einsatz, tx);

    // 3. Extract Domain Events
    const events = einsatz.getDomainEvents();
    einsatz.clearDomainEvents();

    // 4. Return result + events für Base Handler
    return { result: einsatz.id.value, events };
  }
}
```

#### 2. Outbox Repository

Verwaltet Event-Persistierung und Polling:

```typescript
export interface IOutboxRepository {
  /**
   * Speichert Domain Events in Outbox Table (atomar in Transaction).
   */
  saveEvents(events: DomainEvent[], tx: PrismaTransaction): Promise<void>;

  /**
   * Lädt PENDING Events für Publishing (max limit).
   */
  findPendingEvents(limit: number): Promise<OutboxEvent[]>;

  /**
   * Markiert Event als PUBLISHED nach erfolgreichem Publish.
   */
  markAsPublished(eventId: string): Promise<void>;

  /**
   * Markiert Event als FAILED bei Publish-Fehler (inkl. Retry-Count).
   */
  markAsFailed(eventId: string, error: string): Promise<void>;
}
```

**Outbox Table Schema:**

```prisma
model OutboxEvent {
  id           String   @id @default(cuid())
  eventName    String   // z.B. "einsatz.created"
  aggregateId  String   // Reference zu Aggregate
  payload      Json     // Event Data (serialisiert)
  status       String   // PENDING | PUBLISHED | FAILED
  retryCount   Int      @default(0)
  lastError    String?
  createdAt    DateTime @default(now())
  publishedAt  DateTime?

  @@index([status, createdAt])
}
```

#### 3. OutboxEventPublisher

Pollt Outbox Table und publiziert Events zum Event Bus:

```typescript
@Injectable()
export class OutboxEventPublisher implements OnModuleInit {
  private readonly POLL_INTERVAL_MS = 5000; // 5 Sekunden
  private readonly BATCH_SIZE = 100;

  constructor(
    private readonly outboxRepository: IOutboxRepository,
    private readonly eventBus: EventBus,
  ) {}

  async onModuleInit() {
    // Start Polling Loop
    setInterval(() => this.publishPendingEvents(), this.POLL_INTERVAL_MS);
  }

  private async publishPendingEvents() {
    const events = await this.outboxRepository.findPendingEvents(this.BATCH_SIZE);

    for (const event of events) {
      try {
        // Publish to Event Bus
        await this.eventBus.publish(event.eventName, event.payload);

        // Mark as Published
        await this.outboxRepository.markAsPublished(event.id);
      } catch (error) {
        // Mark as Failed (mit Retry-Count)
        await this.outboxRepository.markAsFailed(event.id, error.message);
      }
    }
  }
}
```

### Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. HTTP Request → Controller → Command Handler                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. TransactionalCommandHandler.execute()                       │
│    ├─ Start Transaction ($transaction)                         │
│    ├─ executeInTransaction() (Child implementiert)             │
│    │  ├─ Aggregate.create() / Aggregate.update()               │
│    │  ├─ Repository.save(aggregate, tx) → DB WRITE             │
│    │  └─ Extract Domain Events                                 │
│    ├─ OutboxRepository.saveEvents(events, tx) → DB WRITE       │
│    └─ Commit Transaction (atomar!)                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. OutboxEventPublisher (Background Job, 5s Interval)          │
│    ├─ Poll OutboxRepository.findPendingEvents(100)             │
│    ├─ For each event:                                          │
│    │  ├─ EventBus.publish(eventName, payload)                  │
│    │  ├─ SUCCESS → markAsPublished(eventId)                    │
│    │  └─ ERROR → markAsFailed(eventId, error) + retryCount++   │
│    └─ Repeat every 5s                                          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. EventBus → Domain Event Handlers (z.B. EtbAutoCreation)     │
└─────────────────────────────────────────────────────────────────┘
```

### Transaction Configuration

Die Transaktionsgrenzen für Command Handler sind wie folgt konfiguriert:

| Parameter | Wert | Beschreibung |
|-----------|------|--------------|
| `maxWait` | 5000ms | Maximale Wartezeit für Transaction Lock Acquisition (DB-Lock bei Concurrent Writes) |
| `timeout` | 10000ms | Maximale Transaktionsdauer (Deadlock Prevention + Resource Cleanup) |

**Warum diese Werte:**
- **`maxWait` (5s):** Verhindert Deadlocks bei hoher Last durch concurrent writes
  - Wenn DB-Lock nicht innerhalb 5s verfügbar → Transaction wird abgebrochen
  - Trade-off: Höhere Werte = mehr Toleranz für Contention, aber höheres Deadlock-Risiko
- **`timeout` (10s):** Schützt vor Long-Running Transactions die DB-Ressourcen blockieren
  - Erzwingt schnelle Command Handler Execution
  - Trade-off: Niedrigere Werte = schnellere Fehler-Erkennung, aber höhere Retry-Rate

**Bei Überschreitung:**
- Transaction wird automatisch zurückgerollt (Aggregate **UND** Outbox Events)
- Prisma wirft `TransactionTimeoutError` oder `TransactionLockTimeoutError`
- Retry über Outbox-Pattern möglich (Command erneut ausführen)
- HTTP Response: `500 Internal Server Error` mit Error-Details

**Konfiguration:**
Werte sind in `TransactionalCommandHandler.execute()` hardcoded:
```typescript
await this.prisma.$transaction(async (tx) => { ... }, {
  maxWait: 5000,   // Lock Acquisition Timeout
  timeout: 10000,  // Transaction Duration Timeout
});
```

### Transactional Guarantees

**Atomare Persistierung:**
- Aggregate Save **UND** Outbox Save in einer DB-Transaktion
- Bei Fehler: Rollback von beiden Operationen
- **Garantie:** Kein Aggregate ohne Events, keine Events ohne Aggregate

**Retry-Mechanismus:**
- Events in Outbox haben `retryCount` Feld
- OutboxEventPublisher erhöht `retryCount` bei Fehler
- Max Retries konfigurierbar (z.B. 5x, dann Dead Letter Queue)

**Event Latenz:**
- Max 5-7 Sekunden zwischen Aggregate-Save und Event-Publish
- Trade-off: Eventual Consistency für Transactional Integrity
- Akzeptabel für ETB Auto-Creation (nicht kritisch)

### Migrated Handlers

Folgende Command Handlers nutzen TransactionalCommandHandler:

| Handler | Command | Events | Status |
|---------|---------|--------|--------|
| `CreateEinsatzHandler` | CreateEinsatzCommand | EinsatzCreatedEvent | ✅ Migriert |
| `UpdateEinsatzHandler` | UpdateEinsatzCommand | EinsatzUpdatedEvent | ✅ Migriert |
| `ArchiveEinsatzHandler` | ArchiveEinsatzCommand | EinsatzArchivedEvent, EinsatzStatusChangedEvent | ✅ Migriert |
| `CompleteEinsatzHandler` | CompleteEinsatzCommand | EinsatzCompletedEvent, EinsatzStatusChangedEvent | ✅ Migriert |
| `UpdateEinsatzStatusHandler` | UpdateEinsatzStatusCommand | EinsatzStatusChangedEvent | ✅ Migriert |

**Vorteile:**
- Keine direkten `eventEmitter.emit()` oder `eventBus.publish()` Calls in Handlern
- Vollständige Test-Coverage für Outbox Integration
- Retry-Safe bei Event Bus Failures
- Audit-Trail in Outbox Table

### Testing Strategy

**Outbox Integration Tests:**

```typescript
// AC1.1: Events werden in Outbox persistiert
const result = await createHandler.execute(command);
const outboxEvents = await outboxRepository.findPendingEvents(10);
expect(outboxEvents).toContainEqual(
  expect.objectContaining({
    eventName: 'einsatz.created',
    status: 'PENDING',
    aggregateId: result.value!,
  })
);

// AC1.4: Retry Mechanism
await outboxRepository.markAsFailed(eventId, 'Network Error');
const failedEvent = await outboxRepository.findById(eventId);
expect(failedEvent!.retryCount).toBe(1);
```

**Event Emission Verification:**

Keine duplicate Event-Emissions:
- ❌ Kein `eventEmitter.emit()` in Command Handlers
- ❌ Kein `this.eventBus.publish()` in Command Handlers
- ✅ Nur `return { result, events }` in `executeInTransaction()`
- ✅ Base Handler koordiniert Outbox-Persistierung

**Siehe:** `/packages/backend/src/infrastructure/einsatz/__tests__/outbox-integration.e2e.spec.ts`

### Scheduler Concurrency Control (Story 0-2)

#### Problem: Race Conditions bei parallelen Scheduler-Instanzen

Wenn mehrere OutboxEventPublisher-Instanzen parallel laufen (z.B. bei horizontaler Skalierung oder nach Pod-Restart), können Race Conditions auftreten:

```
❌ RACE CONDITION (ohne Locking):
┌─────────────────┐     ┌─────────────────┐
│ Scheduler A     │     │ Scheduler B     │
├─────────────────┤     ├─────────────────┤
│ 1. SELECT *     │     │ 1. SELECT *     │
│    WHERE status │     │    WHERE status │
│    = 'PENDING'  │     │    = 'PENDING'  │
│    → Event X    │     │    → Event X    │ ← BEIDE bekommen Event X!
│                 │     │                 │
│ 2. Publish X    │     │ 2. Publish X    │ ← Event X wird ZWEIMAL publiziert!
│ 3. Mark DONE    │     │ 3. Mark DONE    │
└─────────────────┘     └─────────────────┘
```

**Ergebnis:** Duplicate Events im Event Bus → Inkonsistente Zustände möglich.

#### Lösung: PostgreSQL FOR UPDATE SKIP LOCKED

```
✅ MIT FOR UPDATE SKIP LOCKED:
┌─────────────────┐     ┌─────────────────┐
│ Scheduler A     │     │ Scheduler B     │
├─────────────────┤     ├─────────────────┤
│ 1. SELECT *     │     │ 1. SELECT *     │
│    FOR UPDATE   │     │    FOR UPDATE   │
│    SKIP LOCKED  │     │    SKIP LOCKED  │
│    → Event X 🔒 │     │    → (empty)    │ ← B überspringt gelockte Rows!
│                 │     │                 │
│ 2. Publish X    │     │ 2. (nothing)    │
│ 3. Mark DONE    │     │                 │
│ 4. COMMIT 🔓    │     │                 │
└─────────────────┘     └─────────────────┘
```

**Ergebnis:** Jedes Event wird exakt einmal verarbeitet, keine Duplikate.

#### Implementierung

**Repository Interface:**
```typescript
interface IOutboxRepository {
  /**
   * Findet und sperrt PENDING Events für exklusive Verarbeitung.
   * Nutzt PostgreSQL FOR UPDATE SKIP LOCKED für Race Condition Prevention.
   */
  findAndLockPending(limit?: number, tx?: TransactionContext): Promise<OutboxEventDto[]>;

  // Aktualisierte Signaturen mit Transaction Support:
  markAsPublished(eventId: string, tx?: TransactionContext): Promise<void>;
  markAsFailed(eventId: string, error: string, tx?: TransactionContext): Promise<void>;
}
```

**Raw SQL Query:**
```sql
SELECT * FROM outbox_events
WHERE status = 'PENDING'
ORDER BY "createdAt" ASC
LIMIT ${limit}
FOR UPDATE SKIP LOCKED
```

| Klausel | Bedeutung |
|---------|-----------|
| `FOR UPDATE` | Exklusiver Row-Level Lock (andere Transactions warten oder überspringen) |
| `SKIP LOCKED` | Bereits gesperrte Rows überspringen (nicht blockieren) |
| `ORDER BY createdAt ASC` | FIFO-Ordering für Event-Reihenfolge |

**Publisher Refactoring:**
```typescript
async processPendingEvents(): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    // 1. Lock Events (andere Scheduler überspringen diese)
    const events = await this.outboxRepository.findAndLockPending(
      this.config.batchSize,
      tx,
    );

    // 2. Process innerhalb der Transaction (Lock gehalten)
    for (const event of events) {
      try {
        await this.eventPublisher.publish(event);
        await this.outboxRepository.markAsPublished(event.id, tx);
      } catch (error) {
        await this.outboxRepository.markAsFailed(event.id, error.message, tx);
      }
    }
    // 3. COMMIT → Locks werden freigegeben
  }, { timeout: 10000, maxWait: 5000 });
}
```

#### Sequence Diagram: Concurrent Scheduler Flow

```
┌─────────┐  ┌─────────┐  ┌────────────────┐  ┌─────────────┐
│Scheduler│  │Scheduler│  │ PostgreSQL DB  │  │ Event Bus   │
│    A    │  │    B    │  │                │  │             │
└────┬────┘  └────┬────┘  └───────┬────────┘  └──────┬──────┘
     │            │               │                  │
     │ BEGIN TX   │               │                  │
     │─────────────────────────── ▶│                  │
     │            │               │                  │
     │ SELECT FOR UPDATE          │                  │
     │ SKIP LOCKED (Event 1-3)    │                  │
     │─────────────────────────── ▶│                  │
     │            │               │                  │
     │◀─ Rows 1,2,3 (LOCKED) ─────│                  │
     │            │               │                  │
     │            │ BEGIN TX      │                  │
     │            │───────────────▶│                  │
     │            │               │                  │
     │            │ SELECT FOR    │                  │
     │            │ UPDATE SKIP   │                  │
     │            │ LOCKED        │                  │
     │            │───────────────▶│                  │
     │            │               │                  │
     │            │◀─ (empty) ────│ ← Rows 1-3 gesperrt!
     │            │               │                  │
     │ Publish Event 1            │                  │
     │─────────────────────────────────────────────── ▶│
     │            │               │                  │
     │ markAsPublished(1, tx)     │                  │
     │─────────────────────────── ▶│                  │
     │            │               │                  │
     │            │ COMMIT (empty)│                  │
     │            │───────────────▶│                  │
     │            │               │                  │
     │ ... Publish 2, 3 ...       │                  │
     │            │               │                  │
     │ COMMIT     │               │                  │
     │─────────────────────────── ▶│ ← Locks freigegeben
     │            │               │                  │
```

#### Vorteile

| Aspekt | Beschreibung |
|--------|--------------|
| **Keine Duplikate** | Jedes Event wird exakt einmal verarbeitet |
| **Horizontal Scalable** | Mehrere Scheduler können parallel arbeiten |
| **Kein In-Memory State** | Nur DB-Level Locking (keine shared state Probleme) |
| **Graceful Degradation** | SKIP LOCKED blockt nicht, sondern überspringt |
| **FIFO erhalten** | ORDER BY createdAt ASC + Lock = Reihenfolge garantiert |

#### Defense in Depth

Zusätzlich zum DB-Level Locking behält der Publisher das `isRunning` Flag:

```typescript
@Cron(CronExpression.EVERY_5_SECONDS)
async publishPendingEvents(): Promise<void> {
  // In-Process Guard (zusätzliche Sicherheit)
  if (this.isRunning) {
    return;
  }
  this.isRunning = true;

  try {
    await this.processPendingEvents(); // DB-Level Locking hier
  } finally {
    this.isRunning = false;
  }
}
```

**Warum beide?**
- `isRunning`: Verhindert overlapping Cron-Calls im selben Prozess
- `FOR UPDATE SKIP LOCKED`: Verhindert Race Conditions über Prozesse/Container hinweg

**Siehe:** `/packages/backend/src/infrastructure/outbox/__tests__/outbox-race-condition.integration.spec.ts`

## Repository Interface Patterns

### Return-Type Consistency

Domain Repository Interfaces verwenden das **Result<T> Pattern** für explizites, type-safe Error Handling:

```typescript
// ✅ Korrekt: Result<T> Pattern für Domain Repositories
interface IEinsatzRepository {
  save(aggregate: Einsatz, tx?: TransactionContext): Promise<Result<void>>;
  findById(id: EinsatzId): Promise<Result<Einsatz | null>>;
  findActive(): Promise<Result<Einsatz[]>>;
}

// ❌ Inkonsistent: Promise<T> ohne Result (Legacy, zu migrieren)
interface IEtbRepository {
  save(aggregate: EinsatztagebuchAggregate, tx?: TransactionContext): Promise<void>;
  findById(id: EtbId, tx?: TransactionContext): Promise<EinsatztagebuchAggregate | null>;
}
```

**Aktuelle Konsistenz:**

| Repository | Pattern | Status |
|------------|---------|--------|
| `IEinsatzRepository` | `Result<T>` | ✅ Konsistent |
| `IUserRepository` | `Result<T>` | ✅ Konsistent |
| `IEtbRepository` | `Promise<T>` | ⚠️ Zu migrieren |
| `ILagekarteRepository` | `Promise<T>` | ⚠️ Zu migrieren |
| `IOutboxRepository` | `Promise<T>` | ℹ️ Sonderfall |

**Sonderfall IOutboxRepository:**
- Infrastructure-internes Repository (kein Domain-Repository)
- Consumer: Nur `OutboxEventPublisher` Service
- Bleibt bei `Promise<T>` da Infrastructure-Concern

**Siehe:** [ADR-024: Repository Interface Return-Type Pattern](../adr/ADR-024-repository-interface-pattern.md) für vollständige Entscheidungsdokumentation und Migrationsplan.

## Security Architecture

### Authentication Flow

```
1. POST /api/auth/unified { username, password }
   ↓
2. Backend prüft Credentials (oder erstellt User bei Auto-Register)
   ↓
3. Generiere JWT Tokens:
   - Access Token (15min)
   - Refresh Token (7d)
   - Admin Token (falls Admin-Rolle)
   ↓
4. Setze HTTP-Only Cookies
   ↓
5. Return User-Objekt
```

### Token Refresh Flow

```
1. Access Token abgelaufen (401)
   ↓
2. Frontend: POST /api/auth/refresh (mit Refresh Token Cookie)
   ↓
3. Backend validiert Refresh Token
   ↓
4. Generiere neues Access Token
   ↓
5. Setze neues Access Token Cookie
   ↓
6. Retry original request
```

### Role-Based Access Control (RBAC)

**3 Rollen (NICHT die arc42-beschriebenen Admin/Koordinator/Mitglied):**

| Role | Permissions | Guards |
|------|-------------|--------|
| **USER** | Basic access, CRUD Einsätze/ETB/Lagekarte | `@UseGuards(JwtAuthGuard)` |
| **ADMIN** | User management, System config | `@UseGuards(AdminJwtAuthGuard)` |
| **SUPER_ADMIN** | Full system access | `@UseGuards(AdminJwtAuthGuard)` |

**Permission Guards:**
- `JwtAuthGuard` - Validiert Access Token
- `AdminJwtAuthGuard` - Validiert Admin Token
- `JwtRefreshGuard` - Validiert Refresh Token

### Security Features

- **JWT Tokens:** Secure, stateless authentication
- **HTTP-Only Cookies:** XSS-Schutz
- **SameSite Cookies:** CSRF-Schutz
- **Helmet Middleware:** Security headers
- **Rate Limiting:** Throttle Guards auf kritischen Endpunkten
- **Audit Logging:** Vollständige Nachvollziehbarkeit aller Änderungen
- **Soft-Delete:** Daten werden nicht physisch gelöscht
- **Password Hashing:** Bcrypt (nur für Admin-User)

## Testing Architecture

### E2E Test Infrastructure Pattern

Das Backend nutzt **End-to-End Integration Tests** gegen eine echte PostgreSQL Datenbank, um das vollständige Zusammenspiel aller Layer (Domain, Application, Infrastructure) zu validieren.

**Test-Strategie:**
- **Real Database:** PostgreSQL 17 (KEINE Mocks!)
- **Direct Handler Invocation:** CQRS Handlers direkt aufrufen
- **Given-When-Then BDD:** Strukturierter Test-Stil
- **RBAC Testing:** Alle 3 User-Rollen (USER, ADMIN, SUPER_ADMIN)
- **Outbox Pattern:** Event Publishing Verification
- **Performance Baselines:** Kritische Operationen monitoren

### Core Test Patterns

#### 1. EinsatzE2eTestContext Pattern

Zentrale Test-Context Factory für isolierte Test-Umgebungen:

```typescript
interface EinsatzE2eTestContext {
  prisma: TestPrismaService;
  repository: PrismaEinsatzRepository;
  outboxRepository: PrismaOutboxRepository;
  eventPublisher: SpyEventPublisher;
  testUserIds: {
    user: string;        // CUID2 für USER Rolle
    admin: string;       // CUID2 für ADMIN Rolle
    superAdmin: string;  // CUID2 für SUPER_ADMIN Rolle
  };
  testRunId: string;     // Unique Timestamp für Test Isolation
}

// Setup in beforeAll
const ctx = await createEinsatzE2eModule();
```

**Was passiert intern:**
1. PrismaClient für Test-DB erstellen
2. Alte Test-Daten aufräumen (> 1 Stunde)
3. Drei Test User anlegen (USER, ADMIN, SUPER_ADMIN)
4. Repository und SpyEventPublisher instanzieren
5. Outbox Repository initialisieren

#### 2. SpyEventPublisher Pattern

Mock-Implementation von `IEventPublisher` für Event-Verification ohne echtes Publishing:

```typescript
// Events publishen (automatisch durch Repository)
await ctx.repository.save(aggregate);

// Events abrufen und verifizieren
const events = ctx.eventPublisher.getEventsByName('einsatz.created');
expect(events).toHaveLength(1);
expect(events[0].payload.alarmstichwort).toBe('Brand');

// Events zwischen Tests clearen
ctx.eventPublisher.clear();
```

**Use Cases:**
- Domain Event Emission verifizieren
- Event Payload validieren
- Event Handler Integration testen
- Outbox Pattern Integration prüfen

#### 3. SQL Trigger Management Pattern

**Problem:** PostgreSQL Triggers blockieren physisches DELETE (DRK Compliance).
**Lösung:** `session_replication_role` für Test-Cleanup:

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
- In Produktion NIEMALS `session_replication_role` ändern!
- Pattern ist in `cleanupTestData()` und `teardownE2eModule()` automatisch implementiert
- Constants: `DISABLE_TRIGGERS_SQL`, `ENABLE_TRIGGERS_SQL`

#### 4. waitFor() Utility Pattern

Polling-basierte asynchrone Assertions für Event Handler:

```typescript
// Event Handler läuft asynchron
await createHandler.execute(command);

// Warten bis Event im Publisher erscheint
await waitFor(async () => {
  const events = ctx.eventPublisher.getEventsByName('einsatz.created');
  expect(events).toHaveLength(1);
}, 500, 50); // 500ms timeout, 50ms interval
```

**Use Cases:**
- Event Handler Verification
- Outbox Event Persistence warten
- Asynchrone Side-Effects prüfen

### Integration Test Patterns

#### Outbox Pattern Validation

Testen der atomaren Event-Persistierung und Retry-Logic:

```typescript
// AC1.1: Einsatz-Events werden in Outbox persistiert
const result = await createHandler.execute(command);
const outboxEvents = await ctx.outboxRepository.findPendingEvents(10);
expect(outboxEvents).toContainEqual(
  expect.objectContaining({
    eventName: 'einsatz.created',
    status: 'PENDING',
    aggregateId: result.value!,
  })
);

// AC1.4: Retry Mechanism
await ctx.outboxRepository.markAsFailed(eventId, 'Network Error');
const failedEvent = await ctx.outboxRepository.findById(eventId);
expect(failedEvent!.retryCount).toBe(1);
```

#### NO-DELETE Policy Testing

Validierung der Domain-Invariante gegen PostgreSQL Trigger:

```typescript
// AC2.1: DELETE-Operationen werden blockiert
await expect(
  ctx.prisma.einsatz.delete({ where: { id: einsatzId } })
).rejects.toThrow('DELETE operations are not allowed');

// AC2.2: Soft-Delete Flag wird verwendet
const command = ArchiveEinsatzCommand.create(einsatzId, userId).value!;
await archiveHandler.execute(command);

const archived = await ctx.repository.findById(einsatzId);
expect(archived!.archivedAt).toBeDefined();
expect(archived!.status.value).toBe('ARCHIVIERT');
```

#### RBAC Constraint Testing

Multi-User Authorization Tests:

```typescript
// AC3.1: USER kann nur eigene Einsätze ändern
const einsatzId = await createTestEinsatz(ctx, {
  createdBy: ctx.testUserIds.admin,
});

const userCommand = UpdateEinsatzCommand.create({
  id: einsatzId,
  einsatzort: 'Neue Adresse',
}, ctx.testUserIds.user).value!;

const result = await updateHandler.execute(userCommand);
expect(result.isFailure).toBe(true);
expect(result.error).toContain('Unauthorized');

// AC3.2: ADMIN kann alle Einsätze ändern
const adminCommand = UpdateEinsatzCommand.create({
  id: einsatzId,
  einsatzort: 'Neue Adresse',
}, ctx.testUserIds.admin).value!;

const adminResult = await updateHandler.execute(adminCommand);
expect(adminResult.isSuccess).toBe(true);
```

#### HTTP Integration Testing

Controller-Level Tests mit NestJS TestingModule:

```typescript
// AC5.1: REST Endpoints funktionieren
const response = await request(app.getHttpServer())
  .post('/api/alpha/einsaetze')
  .set('Cookie', authCookie)
  .send({ alarmstichwort: 'Brand' })
  .expect(201);

expect(response.body).toMatchObject({
  data: expect.objectContaining({
    id: expect.any(String),
    alarmstichwort: 'Brand',
  }),
  statusCode: 201,
});

// AC5.2: Authentication via JWT
await request(app.getHttpServer())
  .get('/api/alpha/einsaetze')
  .expect(401); // Ohne Cookie
```

### Performance Baseline Testing

Kritische Operationen mit festgelegten Thresholds:

| Operation | Baseline | Tolerance | Test Threshold | AC |
|-----------|----------|-----------|----------------|-----|
| List Active Einsätze | 50ms | ±10% | 55ms | AC4.1 |
| Get Einsatz Details | 80ms | ±10% | 88ms | AC4.2 |
| Create Einsatz | 150ms | ±10% | 165ms | AC4.3 |
| Combined Query Overhead | - | - | <50ms | AC4.4 |

**Test Pattern:**

```typescript
const start = performance.now();
await getActiveHandler.execute(query);
const duration = performance.now() - start;

expect(duration).toBeLessThan(55); // AC4.1
```

**Hinweis:** Baselines sind Guidelines, keine Hard Limits. CI/CD Pipeline kann langsamer sein.

### Test Lifecycle Hooks

**Setup Pattern (beforeAll):**
```typescript
let ctx: EinsatzE2eTestContext;

beforeAll(async () => {
  ctx = await createEinsatzE2eModule();
  // - DB-Verbindung erstellen
  // - Test-User anlegen
  // - Repositories instanzieren
});
```

**Cleanup Pattern (afterEach):**
```typescript
afterEach(async () => {
  await cleanupTestData(ctx);
  // - Einsatz-Daten löschen (Lagekarten, ETB, Outbox, Einsätze)
  // - Users behalten für weitere Tests
  // - EventPublisher Spy clearen
});
```

**Teardown Pattern (afterAll):**
```typescript
afterAll(async () => {
  await teardownE2eModule(ctx);
  // - ALLE Test-Daten löschen (inkl. Users)
  // - DB-Verbindung schließen
  // - Cleanup mit disabled Triggers
});
```

### Test Helper Functions

| Helper | Verwendung |
|--------|------------|
| `generateTestId()` | CUID2-Format IDs für alle Entity Types |
| `createTestEinsatz(ctx, options?)` | Test-Einsatz mit Custom-Properties erstellen |
| `createTestUser(ctx, role, username?)` | Zusätzlichen Test-User anlegen |
| `createTestOutboxEvent(ctx, options?)` | Test-Outbox-Event erstellen |
| `cleanupEinsatzById(ctx, einsatzId)` | Spezifischen Einsatz mit Dependencies löschen |
| `waitFor(assertion, timeout?, interval?)` | Asynchrone Assertions pollen |

### Test Coverage

**Implementierte Test-Suites:**

| Test File | Acceptance Criteria | Beschreibung |
|-----------|-------------------|--------------|
| `outbox-integration.e2e.spec.ts` | AC1.1-1.7 | Outbox Pattern & Event Publishing |
| `no-delete-policy.e2e.spec.ts` | AC2.1-2.5 | NO-DELETE Policy Enforcement |
| `rbac-constraints.e2e.spec.ts` | AC3.1-3.4 | RBAC Authorization Tests |
| `einsatz-performance.e2e.spec.ts` | AC4.1-4.4 | Performance Baselines |
| `einsatz-controller.e2e.spec.ts` | AC5.1, 5.3, 5.4 | HTTP REST Integration |
| `auth-controller.e2e.spec.ts` | AC5.2 | Authentication HTTP Integration |

**Weitere Details:** `/packages/backend/src/infrastructure/einsatz/__tests__/README.md`

---
