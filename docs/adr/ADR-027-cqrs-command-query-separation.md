# ADR-027: CQRS (Command Query Responsibility Segregation)

**Status:** Accepted
**Datum:** 2025-12-05
**Autoren:** Ruben (via Dev Agent)
**Context:** Application Layer Pattern, Epic 1-4

## Kontext

Im Application Layer der Hexagonal Architecture müssen wir zwischen zwei fundamental unterschiedlichen Arten von Operationen unterscheiden:

1. **Write-Operationen (Mutations):**
   - Ändern den System-State
   - Enthalten komplexe Business-Logik und Validierungen
   - Müssen Domain Events emittieren
   - Benötigen Transaktionssicherheit
   - Müssen auditiert werden

2. **Read-Operationen (Queries):**
   - Lesen nur Daten, ändern keinen State
   - Haben einfache Logik (Filter, Sortierung, Pagination)
   - Benötigen keine Domain Events
   - Können direkt auf Persistence Layer zugreifen für Performance
   - Müssen schnell sein (oft kritisch für UX)

Das Vermischen dieser beiden Concerns in einer Service-Schicht führt zu:
- Schwer testbarem Code (Command-Logik und Query-Logik in gleichen Tests)
- Suboptimaler Performance (Queries laden unnötig Domain Aggregate)
- Unklarer Separation of Concerns (Was ändert State, was nicht?)
- Komplexität bei Event-Handling (Welche Methoden emittieren Events?)

## Entscheidung

Wir implementieren **CQRS (Command Query Responsibility Segregation)** im Application Layer:

### Commands (Write-Operations)

**Commands** sind Objekte, die eine State-Änderung repräsentieren:

```typescript
// src/application/einsatz/commands/create-einsatz/create-einsatz.command.ts
export class CreateEinsatzCommand {
  private constructor(
    public readonly nummer: string,
    public readonly stichwort: string,
    public readonly einsatzort: string,
  ) {}

  static create(props: {
    nummer: string;
    stichwort: string;
    einsatzort: string;
  }): Result<CreateEinsatzCommand> {
    // Validation logic
    return Result.ok(new CreateEinsatzCommand(props.nummer, props.stichwort, props.einsatzort));
  }
}
```

**Command Handler** führen Commands aus und nutzen die `TransactionalCommandHandler` Base Class:

```typescript
// src/application/einsatz/commands/create-einsatz/create-einsatz.handler.ts
@Injectable()
export class CreateEinsatzHandler extends TransactionalCommandHandler<
  CreateEinsatzCommand,
  string
> {
  constructor(
    @Inject(DI_TOKENS.REPOSITORIES.EINSATZ)
    private readonly repository: IEinsatzRepository,
    prismaService: PrismaService,
  ) {
    super(prismaService);
  }

  protected async executeInTransaction(
    command: CreateEinsatzCommand,
    tx: PrismaTransaction,
  ): Promise<{ result: string; events: DomainEvent[] }> {
    // 1. Domain Logic: Aggregate erstellen
    const einsatzResult = Einsatz.create({
      nummer: command.nummer,
      stichwort: command.stichwort,
      einsatzort: command.einsatzort,
    });

    if (einsatzResult.isFailure) {
      return { result: '', events: [] }; // Result Pattern propagiert Fehler
    }

    const einsatz = einsatzResult.value;

    // 2. Persistence: In gleicher Transaktion speichern
    await this.repository.save(einsatz, tx);

    // 3. Events: Domain Events extrahieren
    const events = einsatz.getDomainEvents();
    einsatz.clearDomainEvents();

    // 4. Base class speichert Events atomar in Outbox
    return { result: einsatz.id.value, events };
  }
}
```

### Queries (Read-Operations)

**Queries** sind Objekte, die eine Leseoperation repräsentieren:

```typescript
// src/application/einsatz/queries/get-active-einsaetze/get-active-einsaetze.query.ts
export class GetActiveEinsaetzeQuery {
  constructor(
    public readonly limit?: number,
    public readonly offset?: number,
  ) {}
}
```

**Query Handler** führen Queries aus und greifen direkt auf Prisma zu (Performance-Optimierung):

```typescript
// src/application/einsatz/queries/get-active-einsaetze/get-active-einsaetze.handler.ts
@Injectable()
export class GetActiveEinsaetzeQueryHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetActiveEinsaetzeQuery): Promise<EinsatzListDto[]> {
    // Direkter Prisma-Zugriff für optimale Read-Performance
    const einsaetze = await this.prisma.einsatz.findMany({
      where: {
        status: { in: ['AKTIV', 'ALARMIERT'] },
      },
      take: query.limit ?? 50,
      skip: query.offset ?? 0,
      orderBy: { alarmierungszeit: 'desc' },
      select: {
        // Nur benötigte Felder laden (Performance)
        id: true,
        nummer: true,
        stichwort: true,
        einsatzort: true,
        status: true,
        alarmierungszeit: true,
      },
    });

    // Direkt DTOs zurückgeben (kein Domain Mapping)
    return einsaetze.map(e => ({
      id: e.id,
      nummer: e.nummer,
      stichwort: e.stichwort,
      einsatzort: e.einsatzort,
      status: e.status,
      alarmierungszeit: e.alarmierungszeit,
    }));
  }
}
```

### File Structure

```
src/application/einsatz/
├── commands/
│   ├── create-einsatz/
│   │   ├── create-einsatz.command.ts
│   │   └── create-einsatz.handler.ts
│   ├── update-einsatz/
│   │   ├── update-einsatz.command.ts
│   │   └── update-einsatz.handler.ts
│   └── archive-einsatz/
│       ├── archive-einsatz.command.ts
│       └── archive-einsatz.handler.ts
└── queries/
    ├── get-active-einsaetze/
    │   ├── get-active-einsaetze.query.ts
    │   └── get-active-einsaetze.handler.ts
    ├── get-einsatz-details/
    │   ├── get-einsatz-details.query.ts
    │   └── get-einsatz-details.handler.ts
    └── search-einsaetze/
        ├── search-einsaetze.query.ts
        └── search-einsaetze.handler.ts
```

### Begründung

1. **Separation of Concerns:**
   - Write-Logik (Commands) ist komplex: Validierung, Business Rules, Domain Events, Transaktionen
   - Read-Logik (Queries) ist einfach: Filter, Sortierung, Pagination
   - Trennung macht Code verständlicher und wartbarer

2. **Optimierte Read-Paths:**
   - Queries können direkt auf Prisma zugreifen (keine Domain Aggregate laden)
   - Performance-kritische Reads (z.B. Listen, Search) werden nicht durch Domain-Layer gebremst
   - Nur benötigte Felder laden (SELECT statt vollständige Entities)

3. **Testbarkeit:**
   - Command Handler können isoliert mit Mocks getestet werden
   - Query Handler haben keine komplexe Logik (weniger Tests nötig)
   - Klare Abgrenzung: Commands werden intensiv getestet, Queries oft nur Integration-Tests

4. **Event-Driven Architecture:**
   - Nur Commands emittieren Domain Events (über Transactional Outbox)
   - Queries sind read-only und emittieren niemals Events
   - Klare Ownership: Commands = einzige Quelle für State-Änderungen

5. **Explizite Fehlerbehandlung:**
   - Commands nutzen Result Pattern für erwartete Fehler
   - Queries werfen Exceptions für unerwartete Fehler (DB down, etc.)
   - Controller mappen Result → HTTP Status (200, 400, 500)

6. **Skalierbarkeit:**
   - Queries können später in separaten Read-Microservice ausgelagert werden
   - Commands bleiben im Hauptsystem (Single Source of Truth)
   - CQRS ist Vorbereitung für Event Sourcing (falls nötig)

## Konsequenzen

### Positiv

1. **Klare Verantwortlichkeiten:**
   - Commands = "Was soll passieren?" (Intent)
   - Queries = "Was gibt es?" (Data Retrieval)
   - Kein Vermischen von Write- und Read-Logik

2. **Performance-Optimierung:**
   - Queries umgehen Domain Layer (direkt Prisma)
   - Nur benötigte Felder laden (DTOs statt Aggregates)
   - Read-heavy Anwendungen profitieren massiv

3. **Bessere Testbarkeit:**
   - Command Handler: Unit Tests mit Mocks
   - Query Handler: Integration Tests mit Test-DB
   - Isolation macht Tests schneller und stabiler

4. **Event-Driven Ready:**
   - Commands emittieren Events automatisch (via Outbox)
   - Queries triggern keine Events (read-only)
   - Basis für CQRS mit separaten Read Models (später)

5. **Framework-Agnostizität:**
   - Commands/Queries sind Plain TypeScript Objects
   - Handler haben minimale NestJS-Abhängigkeiten (nur `@Injectable`)
   - Einfach zu anderen Frameworks migrierbar

### Negativ

1. **Mehr Boilerplate:**
   - Jede Operation benötigt Command/Query + Handler (2 Dateien statt 1 Service-Methode)
   - Kann bei vielen simplen CRUDs zu viel Overhead sein
   - Mitigation: Template-Scripts für Command/Query-Generierung

2. **Komplexität für Einsteiger:**
   - Entwickler müssen CQRS-Pattern verstehen
   - Unterschied Command vs. Query muss klar sein
   - Mitigation: Dokumentation + Onboarding-Guide

3. **Keine automatische Konsistenz:**
   - Queries lesen direkt aus DB (kein Domain Model)
   - Bei Read Models später: Eventual Consistency statt Strong Consistency
   - Mitigation: Aktuell nur eine DB (kein Problem), später: Read Model Projections

4. **Duplizierung:**
   - Domain Model (Aggregates) vs. Read DTOs
   - Feld-Mappings müssen synchron bleiben
   - Mitigation: Integration Tests + Prisma Schema als Single Source of Truth

### Migration

**Phase 1 (Aktuell - Epic 1-4):**
- Neue Features nutzen CQRS ab sofort
- Bestehende 3-Tier Services werden NICHT migriert (Legacy bleibt)
- Koexistenz: Alte Services (3-Tier) + neue Handlers (CQRS)

**Phase 2 (Epic 2):**
- Migration einzelner kritischer Endpoints (z.B. Einsatz-CRUD)
- Step-by-Step: Ein Command/Query nach dem anderen
- Alte Services bleiben bis alle Endpoints migriert sind

**Phase 3 (Epic 3+):**
- Alle neuen Features nutzen CQRS
- Legacy Services werden sukzessive entfernt
- Ziel: 100% CQRS im Application Layer

**Migration-Workflow:**
```typescript
// Alt (3-Tier Service)
@Injectable()
export class EinsatzService {
  async create(dto: CreateEinsatzDto): Promise<Einsatz> { ... }
  async findAll(): Promise<Einsatz[]> { ... }
}

// Neu (CQRS)
@Injectable()
export class CreateEinsatzHandler extends TransactionalCommandHandler<CreateEinsatzCommand, string> { ... }

@Injectable()
export class GetActiveEinsaetzeQueryHandler {
  async execute(query: GetActiveEinsaetzeQuery): Promise<EinsatzListDto[]> { ... }
}

// Controller nutzt Handler
@Controller('einsatz')
export class EinsatzController {
  constructor(
    private readonly createHandler: CreateEinsatzHandler,
    private readonly getActiveHandler: GetActiveEinsaetzeQueryHandler,
  ) {}

  @Post()
  async create(@Body() dto: CreateEinsatzDto) {
    const command = CreateEinsatzCommand.create(dto);
    const result = await this.createHandler.execute(command.value);
    if (result.isFailure) {
      throw new BadRequestException(result.error);
    }
    return result.value;
  }

  @Get('active')
  async getActive(@Query() queryDto: GetActiveEinsaetzeDto) {
    const query = new GetActiveEinsaetzeQuery(queryDto.limit, queryDto.offset);
    return this.getActiveHandler.execute(query);
  }
}
```

## Verwandte Entscheidungen

- **ADR-025: Hexagonal Architecture**
  - CQRS ist das konkrete Pattern für den Application Layer
  - Commands/Queries sind die "Use Cases" in Clean Architecture Terminologie
  - Handler orchestrieren Domain + Persistence (Ports & Adapters)

- **ADR-028: Transactional Outbox Pattern**
  - Command Handler nutzen `TransactionalCommandHandler` Base Class
  - Domain Events werden atomar mit Command-Execution gespeichert
  - Queries emittieren niemals Events (read-only)

- **ADR-024: Repository Interface Pattern**
  - Command Handler nutzen Repository Interfaces (DI via Tokens)
  - Queries greifen direkt auf Prisma zu (Performance-Optimierung)
  - Repositories sind nur für Write-Path relevant

- **ADR-026: Domain Events**
  - Commands emittieren Domain Events nach erfolgreicher Execution
  - Events werden via Outbox Pattern persistiert
  - Queries triggern keine Events

## Validierung

**Checklists für Code Reviews:**

1. **Command Handler Checklist:**
   - [ ] Extends `TransactionalCommandHandler<TCommand, TResult>`
   - [ ] `executeInTransaction()` nutzt Transaktions-Context
   - [ ] Repository.save() innerhalb Transaktion
   - [ ] Domain Events werden extrahiert und zurückgegeben
   - [ ] Result Pattern für Fehlerbehandlung
   - [ ] Keine direkte HTTP-Exception (nur im Controller)

2. **Query Handler Checklist:**
   - [ ] Nutzt `@Injectable()` (kein Base Class)
   - [ ] Direkter Prisma-Zugriff (kein Repository)
   - [ ] Gibt DTOs zurück (keine Domain Aggregates)
   - [ ] Keine Domain Events
   - [ ] Keine Transaktionen (read-only)
   - [ ] Performance-optimiert (SELECT nur benötigte Felder)

3. **Controller Integration Checklist:**
   - [ ] Injiziert Handler (nicht Services)
   - [ ] Mappt DTO → Command/Query
   - [ ] Mappt Result → HTTP Response
   - [ ] Exception Handling für unerwartete Fehler
   - [ ] OpenAPI Decorators vorhanden

**Beispiel-Tests:**

```typescript
// Command Handler Unit Test
describe('CreateEinsatzHandler', () => {
  let handler: CreateEinsatzHandler;
  let mockRepository: jest.Mocked<IEinsatzRepository>;
  let mockPrisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository = createMockRepository();
    mockPrisma = createMockPrisma();
    handler = new CreateEinsatzHandler(mockRepository, mockPrisma);
  });

  it('should create einsatz and emit domain event', async () => {
    // Given
    const command = CreateEinsatzCommand.create({
      nummer: 'E-2025-001',
      stichwort: 'Brand',
      einsatzort: 'Hauptstraße 1',
    }).value!;

    mockRepository.save.mockResolvedValue(undefined);

    // When
    const result = await handler.execute(command);

    // Then
    expect(result.isSuccess).toBe(true);
    expect(mockRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ nummer: 'E-2025-001' }),
      expect.any(Object), // Transaction context
    );
  });
});

// Query Handler Integration Test
describe('GetActiveEinsaetzeQueryHandler', () => {
  let handler: GetActiveEinsaetzeQueryHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    prisma = new PrismaService();
    handler = new GetActiveEinsaetzeQueryHandler(prisma);
  });

  it('should return active einsaetze ordered by time', async () => {
    // Given
    await prisma.einsatz.createMany({
      data: [
        { nummer: 'E-001', status: 'AKTIV', alarmierungszeit: new Date('2025-01-01') },
        { nummer: 'E-002', status: 'ABGESCHLOSSEN', alarmierungszeit: new Date('2025-01-02') },
        { nummer: 'E-003', status: 'ALARMIERT', alarmierungszeit: new Date('2025-01-03') },
      ],
    });

    const query = new GetActiveEinsaetzeQuery(10, 0);

    // When
    const result = await handler.execute(query);

    // Then
    expect(result).toHaveLength(2); // Nur AKTIV + ALARMIERT
    expect(result[0].nummer).toBe('E-003'); // Neueste zuerst
    expect(result[1].nummer).toBe('E-001');
  });
});
```

**Dokumentation:**
- Diese ADR dokumentiert CQRS als zentrales Pattern für Application Layer
- Code Examples zeigen konkrete Implementation
- Migration-Path für bestehende Services definiert
- Checklists für Code Reviews bereitgestellt
