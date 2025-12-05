# ADR-025: Hexagonale Architektur

**Status:** Accepted
**Datum:** 2025-12-05
**Autoren:** Ruben (via Dev Agent)
**Context:** Epic 1-4, Hexagonal Architecture Migration

## Kontext

Das Bluelight-Hub Projekt wurde ursprünglich mit einer klassischen **3-Tier Architecture** implementiert (Controller → Service → Repository). Diese Architektur führte zu mehreren strukturellen Problemen:

### Probleme mit 3-Tier Architecture

1. **Tight Coupling:** Business-Logik in Service-Klassen war direkt an NestJS-Framework und Prisma ORM gekoppelt. Ein Austausch des Frameworks oder der Persistence-Technologie hätte große Teile des Codes betroffen.

2. **Testing-Schwierigkeiten:** Unit-Tests für Business-Logik erforderten das Mocken von Framework-Decorators (`@Injectable`, `@InjectRepository`) und ORM-Clients. Domain-Tests waren nicht isoliert möglich.

3. **Unklare Verantwortlichkeiten:** Service-Klassen enthielten eine Mischung aus HTTP-spezifischer Logik, Business-Regeln, Datenbankabfragen und Event-Publishing. Die Grenzen zwischen Layers waren fließend.

4. **Framework-Abhängigkeit im Core:** Domain-Konzepte wie Aggregates, Value Objects und Business Rules waren mit NestJS-Decorators und Prisma-Typen durchsetzt.

5. **Schwer wartbar:** Änderungen an Business-Regeln erforderten Änderungen in Service-, Controller- und Repository-Code gleichzeitig.

### Epic 1-4 Migration Journey

Die Migration zu Hexagonaler Architektur erfolgte schrittweise über mehrere Epics:

- **Epic 1:** User Aggregate Migration (Proof of Concept)
- **Epic 2:** Lagekarte Aggregate Migration
- **Epic 3:** Einsatztagebuch (ETB) Aggregate Migration
- **Epic 4:** Einsatz Aggregate Migration

### Strangler Fig Pattern

Die Migration nutzte das **Strangler Fig Pattern**, um die alte 3-Tier-Architektur schrittweise durch die neue Hexagonale Architektur zu ersetzen, ohne das laufende System zu gefährden:

1. **Parallele Entwicklung:** Neue Hexagonal-Layer wurden neben der alten 3-Tier-Struktur aufgebaut
2. **Feature-by-Feature Migration:** Jedes Epic migrierte ein Aggregate/Feature vollständig
3. **Schrittweise Ablösung:** Nach vollständiger Migration eines Features wurde der alte Code entfernt
4. **Zero Downtime:** Das System blieb während der gesamten Migration funktionsfähig

**Verweis auf ADR-026:** Das Strangler Fig Pattern ist detailliert in ADR-026 dokumentiert.

## Entscheidung

**Bluelight-Hub nutzt Hexagonale Architektur (Ports & Adapters) mit 3 klar getrennten Layern:**

```
┌─────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                     │
│  (Ports & Adapters - Framework-spezifisch)                 │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Controllers │  │ Prisma Repos │  │ Event Adapters│    │
│  │   (NestJS)   │  │   (Prisma)   │  │   (NestJS)    │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │ depends on       │ implements       │ implements
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                          │
│  (Use Cases - CQRS Commands & Queries)                      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Commands   │  │    Queries   │  │    Mappers   │     │
│  │   Handlers   │  │   Handlers   │  │     (DTOs)   │     │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘     │
│         │                  │                                │
└─────────┼──────────────────┼────────────────────────────────┘
          │ depends on       │ depends on
          ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      DOMAIN LAYER                            │
│  (Pure Business Logic - Framework-agnostic)                 │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Aggregates  │  │ Value Objects│  │Repository     │     │
│  │   (Entities) │  │   (VOs)      │  │  Ports        │     │
│  └──────────────┘  └──────────────┘  │ (Interfaces)  │     │
│  ┌──────────────┐  ┌──────────────┐  └──────────────┘     │
│  │Domain Events │  │Domain Services│                        │
│  └──────────────┘  └──────────────┘                        │
│                                                              │
│  ⚠️  NO FRAMEWORK DEPENDENCIES (except @Injectable)         │
└─────────────────────────────────────────────────────────────┘
```

### Layer-Struktur

**Packages-Struktur im Backend:**

```
packages/backend/src/
├── domain/                      # DOMAIN LAYER (Pure TypeScript)
│   ├── aggregates/              # Aggregate Roots (Einsatz, User, ETB, Lagekarte)
│   ├── entities/                # Child Entities (PoiEntity, EtbEintragEntity)
│   ├── value-objects/           # Value Objects (EinsatzId, Address, EinsatzStatus)
│   ├── events/                  # Domain Events (EinsatzCreatedEvent, etc.)
│   ├── repositories/            # Repository Ports (Interfaces)
│   ├── services/                # Domain Services (EinsatzNamingService, etc.)
│   │   └── ports/               # External Service Ports (ITokenServicePort, etc.)
│   └── common/                  # Shared Domain Concepts (Result, AggregateRoot, etc.)
│
├── application/                 # APPLICATION LAYER (Use Cases)
│   ├── einsatz/
│   │   ├── commands/            # Commands (CreateEinsatzCommand, UpdateEinsatzCommand)
│   │   │   └── handlers/        # Command Handlers
│   │   ├── queries/             # Queries (GetEinsatzByIdQuery, GetActiveEinsaetzeQuery)
│   │   │   └── handlers/        # Query Handlers
│   │   ├── dto/                 # Data Transfer Objects (EinsatzDto, AddressDto)
│   │   └── mappers/             # Domain ↔ DTO Mappers
│   ├── etb/                     # Analog für ETB
│   ├── lagekarte/               # Analog für Lagekarte
│   └── common/                  # Shared Application Utilities
│
└── infrastructure/              # INFRASTRUCTURE LAYER (Adapters)
    ├── einsatz/
    │   ├── controllers/         # REST Controllers (EinsatzController)
    │   ├── repositories/        # Repository Adapters (PrismaEinsatzRepository)
    │   └── mappers/             # Prisma ↔ Domain Mappers
    ├── outbox/                  # Transactional Outbox Pattern
    │   ├── prisma-outbox.repository.ts
    │   └── outbox-publisher.service.ts
    ├── auth/                    # JWT Auth Guards & Strategies
    └── common/                  # Shared Infrastructure (Prisma, NestJS Modules)
```

### Dependency Inversion Principle

Die zentrale Regel der Hexagonalen Architektur ist **Dependency Inversion:**

**Domain Layer definiert Ports (Interfaces):**

```typescript
// packages/backend/src/domain/repositories/ieinsatz.repository.ts
export interface IEinsatzRepository {
  save(aggregate: Einsatz, tx?: TransactionContext): Promise<Result<void>>;
  findById(id: EinsatzId): Promise<Result<Einsatz | null>>;
  findActive(): Promise<Result<Einsatz[]>>;
  // ... weitere Methoden
}
```

**Infrastructure Layer implementiert Adapters:**

```typescript
// packages/backend/src/infrastructure/einsatz/repositories/prisma-einsatz.repository.ts
@Injectable()
export class PrismaEinsatzRepository implements IEinsatzRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxRepository: PrismaOutboxRepository,
  ) {}

  async save(aggregate: Einsatz, tx?: TransactionContext): Promise<Result<void>> {
    // Prisma-spezifische Implementation
  }
  // ... weitere Implementierungen
}
```

**Application Layer nutzt Ports (nicht Adapters):**

```typescript
// packages/backend/src/application/einsatz/commands/create-einsatz/create-einsatz.handler.ts
@CommandHandler(CreateEinsatzCommand)
export class CreateEinsatzHandler implements ICommandHandler<CreateEinsatzCommand> {
  constructor(
    @Inject(DI_TOKENS.REPOSITORIES.EINSATZ)
    private readonly repository: IEinsatzRepository, // Interface, nicht Adapter!
  ) {}

  async execute(command: CreateEinsatzCommand): Promise<Result<EinsatzId>> {
    // Business Logic nutzt nur das Interface
    const einsatzResult = Einsatz.create({...});
    await this.repository.save(einsatzResult.value);
  }
}
```

### Framework-Agnostizität im Domain Layer

**Erlaubt im Domain Layer:**

```typescript
import { Injectable } from '@nestjs/common'; // OK: DI Metadata
import { Inject } from '@nestjs/common';     // OK: DI Token Injection
import { Optional } from '@nestjs/common';   // OK: Optional Dependencies

@Injectable() // ✅ ERLAUBT: Ermöglicht NestJS Dependency Injection
export class EinsatzNamingService {
  // Pure Business Logic
}
```

**VERBOTEN im Domain Layer:**

```typescript
// ❌ VERBOTEN: Framework-spezifische Decorators
import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HttpException, BadRequestException } from '@nestjs/common';

// ❌ VERBOTEN: ORM-Typen im Domain
import { Prisma } from '@prisma/client';
import type { Einsatz as PrismaEinsatz } from '@prisma/client';

// ❌ VERBOTEN: HTTP-Konzepte im Domain
import { Response, Request } from 'express';
```

**Verweis auf CLAUDE.md Code Review Checklist AC3:** Diese Regel ist Teil der Code Review Acceptance Criteria.

## Begründung

### 1. Testability

**Domain Layer kann isoliert getestet werden:**

```typescript
// packages/backend/src/domain/aggregates/einsatz.aggregate.spec.ts
describe('Einsatz Aggregate', () => {
  it('should create einsatz with valid data', () => {
    // KEIN NestJS, KEIN Prisma, KEINE Mocks nötig!
    const result = Einsatz.create({
      alarmstichwort: 'Wohnungsbrand',
      createdBy: UserId.create().value!,
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value!.alarmstichwort).toBe('Wohnungsbrand');
  });
});
```

**Ohne Hexagonal Architecture (alte 3-Tier):**

```typescript
// ❌ ALT: Service-Tests erforderten Framework-Mocks
describe('EinsatzService', () => {
  let service: EinsatzService;
  let mockPrisma: DeepMockProxy<PrismaClient>; // Framework-Abhängigkeit!

  beforeEach(async () => {
    mockPrisma = mockDeep<PrismaClient>();
    const module = await Test.createTestingModule({
      providers: [
        EinsatzService,
        { provide: PrismaService, useValue: mockPrisma }, // Mock-Setup komplex!
      ],
    }).compile();
    service = module.get(EinsatzService);
  });

  it('should create einsatz', async () => {
    mockPrisma.einsatz.create.mockResolvedValue({...}); // ORM-spezifisches Mock
    // Test gemischt mit Framework-Details
  });
});
```

### 2. Technology Independence

**Prisma kann durch TypeORM ersetzt werden, ohne Domain-Code zu ändern:**

```typescript
// NEU: TypeORM Adapter (ersetzt Prisma Adapter)
@Injectable()
export class TypeOrmEinsatzRepository implements IEinsatzRepository {
  constructor(
    @InjectRepository(EinsatzEntity)
    private readonly repo: Repository<EinsatzEntity>, // TypeORM!
  ) {}

  async save(aggregate: Einsatz, tx?: TransactionContext): Promise<Result<void>> {
    // TypeORM-spezifische Implementation
    // Domain Layer und Application Layer bleiben unverändert!
  }
}
```

**Domain Layer bleibt unverändert:** Aggregates, Value Objects, Events, Repository Interfaces - alles bleibt identisch.

**Application Layer bleibt unverändert:** Command/Query Handler nutzen weiterhin `IEinsatzRepository` Interface.

**Nur Infrastructure Layer ändert sich:** Austausch von `PrismaEinsatzRepository` gegen `TypeOrmEinsatzRepository` im DI-Container.

### 3. Business Logic Isolation

**Alle Business-Regeln leben im Domain Layer:**

```typescript
// packages/backend/src/domain/aggregates/einsatz.aggregate.ts
export class Einsatz extends AggregateRoot<EinsatzId> {
  /**
   * Business Rule: Status-Transition nur vorwärts
   * ANGELEGT → IN_BEARBEITUNG → ABGESCHLOSSEN → ARCHIVIERT
   */
  public updateStatus(newStatus: EinsatzStatus): Result<void> {
    if (this.isArchived()) {
      return Result.fail('Archivierte Einsätze können nicht geändert werden');
    }

    if (!this._status.canTransitionTo(newStatus)) {
      return Result.fail(`Ungültige Status-Transition: ${this._status.value} → ${newStatus.value}`);
    }

    const oldStatus = this._status;
    this._status = newStatus;
    this.addDomainEvent(new EinsatzStatusChangedEvent(this.id, oldStatus, newStatus, this.id.value));

    return Result.ok(undefined);
  }

  /**
   * Business Rule: NO-DELETE Policy (10-Jahres-Aufbewahrungspflicht)
   */
  public canBeDeleted(): boolean {
    return false; // NIEMALS löschen!
  }
}
```

**Controller ist "thin adapter" ohne Business-Logik:**

```typescript
// packages/backend/src/infrastructure/einsatz/controllers/einsatz.controller.ts
@Controller('einsatz')
export class EinsatzController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  async create(@Body() dto: CreateEinsatzDto, @CurrentUser() user: ValidatedUser) {
    // Nur HTTP → Command Mapping, KEINE Business-Logik!
    const commandResult = CreateEinsatzCommand.create(dto.alarmstichwort, user.userId);
    if (commandResult.isFailure) throw new BadRequestException(commandResult.error);

    const result = await this.commandBus.execute(commandResult.value);
    if (result.isFailure) throw new BadRequestException(result.error);

    return result.value;
  }
}
```

### 4. Explicit Boundaries

**Klare Trennung der Verantwortlichkeiten:**

| Layer | Verantwortlichkeit | Beispiel |
|-------|-------------------|----------|
| **Domain** | Business-Regeln, Invarianten, Domain Events | `Einsatz.complete()`, `EinsatzStatus.canTransitionTo()` |
| **Application** | Use Cases, Orchestration, DTOs | `CreateEinsatzHandler`, `EinsatzDto` |
| **Infrastructure** | HTTP, Database, Event-Publishing, Auth | `EinsatzController`, `PrismaEinsatzRepository`, `JwtAuthGuard` |

**Dependency Flow:** Infrastructure → Application → Domain (niemals umgekehrt!)

## Konsequenzen

### Positiv

1. **Unit-testbarer Domain Layer:**
   - Domain-Tests sind reine TypeScript Unit-Tests ohne Framework-Mocks
   - 100% Code Coverage für Business-Regeln ist einfach erreichbar
   - Tests laufen schnell (kein Framework-Overhead)

2. **Clear Dependency Direction:**
   - Dependency Flow ist immer Infrastructure → Application → Domain
   - Domain hängt NIEMALS von Infrastructure ab
   - Compile-Time Enforcement durch TypeScript Imports

3. **Replaceable Infrastructure:**
   - Prisma → TypeORM: Nur Infrastructure Layer ändern
   - NestJS → Express: Nur Infrastructure Layer ändern
   - PostgreSQL → MongoDB: Nur Repository Adapters ändern

4. **Framework-agnostischer Core:**
   - Domain Layer kann in andere Projekte portiert werden
   - Business-Logik ist nicht an NestJS gebunden
   - Future-Proof: Framework-Migration ohne Domain-Rewrite

5. **CQRS Integration:**
   - Hexagonal Architecture ermöglicht sauberes CQRS Pattern
   - Commands/Queries trennen Write/Read Concerns
   - **Verweis auf ADR-027:** CQRS Pattern ist in ADR-027 dokumentiert

6. **Transactional Outbox Pattern:**
   - Domain Events werden atomar mit Aggregate persistiert
   - Garantiert Konsistenz zwischen Domain und Events
   - Infrastructure-Concern (Outbox Repository) getrennt von Domain

### Negativ

1. **More Boilerplate:**
   - Ports (Interfaces) + Adapters (Implementations) = mehr Code
   - Mapper für Domain ↔ Persistence ↔ DTO = 3 Mappings pro Entity
   - DI Token Constants für Port-Injection

2. **Steeper Learning Curve:**
   - Entwickler müssen Hexagonal Architecture verstehen
   - Dependency Inversion Principle muss verinnerlicht werden
   - "Wo gehört dieser Code hin?" ist komplexer als bei 3-Tier

3. **Migration Effort:**
   - Epic 1-4 benötigte 4 separate Stories für Migration
   - Strangler Fig Pattern erforderte parallele Strukturen
   - Legacy Code musste schrittweise abgelöst werden

4. **Mehr Files:**
   - Pro Aggregate: Domain Entity + Repository Port + Prisma Adapter + Mapper
   - Pro Use Case: Command + Handler + DTO + Query + Handler
   - Verzeichnisstruktur ist tiefer als bei 3-Tier

## Verwandte Entscheidungen

- **ADR-022:** Domain Layer als Backend Subfolder (Strukturelle Grundlage)
- **ADR-024:** Repository Interface Return-Type Pattern (Result<T> Pattern für alle Ports)
- **ADR-026:** Strangler Fig Migration Pattern (Wie die Migration umgesetzt wurde)
- **ADR-027:** CQRS Pattern (Command/Query Separation im Application Layer)

## Validierung

Diese ADR ist erfüllt, wenn:

1. ✅ Das Dokument existiert in `docs/adr/ADR-025-hexagonal-architecture.md`
2. ✅ Die 3-Layer Hexagonal Architecture (Domain → Application → Infrastructure) ist dokumentiert
3. ✅ Dependency Inversion Principle (Ports & Adapters) ist erklärt
4. ✅ Framework-Agnostizität des Domain Layers ist definiert (@Injectable OK, andere Decorators VERBOTEN)
5. ✅ Code-Beispiele zeigen Unterschied zu alter 3-Tier Architecture
6. ✅ Verzeichnisstruktur (`src/domain/`, `src/application/`, `src/infrastructure/`) ist dokumentiert
7. ✅ Verwandte ADRs sind cross-referenced (ADR-022, ADR-024, ADR-026, ADR-027)
