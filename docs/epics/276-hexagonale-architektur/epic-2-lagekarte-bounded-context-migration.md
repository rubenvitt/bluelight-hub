# Epic 2: Lagekarte Bounded Context Migration

**Goal:** Migrate Lagekarte to Hexagonal Architecture as Proof-of-Concept for Strangler Fig Pattern.

**Business Value:**
- First End-to-End migration validates architectural patterns
- Smallest context reduces migration risk
- MGRS coordinate system compliance (DRK standard)
- Foundation for ETB and Einsatz migrations

**Technical Scope:**
- Commands/Handlers: CreateLagekarte, AddPoi, RemovePoi, UpdatePoiPosition
- Queries/Handlers: GetLagekarte, GetPois, GetPoisByCategory
- Infrastructure: PrismaLagekarteRepository, NominatimGeocodingAdapter
- Mappers: Domain ↔ Prisma (Lagekarte, POI)
- Controller Refactoring: Thin adapter layer
- Frontend: API client regeneration, component updates

**Success Criteria:**
- [ ] Lagekarte completely migrated to new architecture (Backend + Frontend)
- [ ] Integration tests green
- [ ] MGRS ↔ Lat/Lng conversion working
- [ ] Frontend functional with new API
- [ ] NO changes to old code (parallel implementation)
- [ ] Rollback possible at any time

**Estimated Effort:** 30-40h (26-34h Backend, 4-6h Frontend)

---

## Story 2.1: Lagekarte Application Layer - Commands

**As a** Backend Developer,
**I want** Command handlers for Lagekarte write operations,
**So that** Lagekarte creation and POI management use the new architecture.

**Acceptance Criteria:**

**Given** Domain Layer exists (Epic 1)
**When** I implement Lagekarte command handlers
**Then** the following exist in `application/lagekarte/commands/`:

**1. CreateLagekarteCommand & Handler**

Command:
```typescript
class CreateLagekarteCommand {
  constructor(
    public readonly einsatzId: string,
    public readonly initialPoi?: {
      name: string;
      coordinate: { lat: number; lng: number } | { mgrs: string };
      category: string;
    }
  ) {}
}
```

Handler:
- Validates EinsatzId exists (via IEinsatzRepository)
- Converts Lat/Lng to MGRS if needed
- Creates LagekarteAggregate (with optional initialPoi)
- Saves via ILagekarteRepository
- Publishes domain events (LagekarteCreatedEvent, PoiAddedEvent if initialPoi)
- Returns Result<LagekarteId>

**2. AddPoiCommand & Handler**

Command:
```typescript
class AddPoiCommand {
  constructor(
    public readonly lagekarteId: string,
    public readonly name: string,
    public readonly coordinate: { lat: number; lng: number } | { mgrs: string },
    public readonly category: string,
    public readonly beschreibung?: string
  ) {}
}
```

Handler:
- Loads LagekarteAggregate by ID
- Converts coordinate to MGRS if Lat/Lng
- Calls `aggregate.addPoi()`
- Saves aggregate
- Publishes PoiAddedEvent
- Returns Result<PoiId>

**3. RemovePoiCommand & Handler**

Command:
```typescript
class RemovePoiCommand {
  constructor(
    public readonly lagekarteId: string,
    public readonly poiId: string
  ) {}
}
```

Handler:
- Loads aggregate
- Calls `aggregate.removePoi(poiId)`
- Saves aggregate
- Publishes PoiRemovedEvent
- Returns Result<void>

**4. UpdatePoiPositionCommand & Handler**

Command:
```typescript
class UpdatePoiPositionCommand {
  constructor(
    public readonly lagekarteId: string,
    public readonly poiId: string,
    public readonly newCoordinate: { lat: number; lng: number } | { mgrs: string }
  ) {}
}
```

Handler:
- Loads aggregate
- Converts coordinate
- Calls `aggregate.updatePoiPosition()`
- Saves aggregate
- Publishes PoiPositionUpdatedEvent

**And** Unit-Tests validate:
- Command validation (required fields)
- Handler orchestration (Repository calls, Event publishing)
- Error handling (aggregate not found, invalid coordinates)
- Result<T> success/failure paths

**Prerequisites:** Epic 1 (Domain Layer)

**Technical Notes:**
- Handlers use Result<T> pattern (no exceptions)
- Coordinate conversion in Handler before passing to Aggregate
- Event publishing via EventPublisher Port
- Validation happens in Domain (Aggregate/VOs), Handler only orchestrates

---

## Story 2.2: Lagekarte Application Layer - Queries

**As a** Backend Developer,
**I want** Query handlers for Lagekarte read operations,
**So that** data retrieval is optimized without loading full Aggregates.

**Acceptance Criteria:**

**Given** Domain Layer exists (Epic 1)
**When** I implement Lagekarte query handlers
**Then** the following exist in `application/lagekarte/queries/`:

**1. GetLagekarteQuery & Handler**

Query:
```typescript
class GetLagekarteQuery {
  constructor(public readonly einsatzId: string) {}
}
```

Handler:
- Queries ILagekarteRepository.findByEinsatzId()
- Maps Aggregate to DTO (LagekarteDto)
- Converts MGRS coordinates to Lat/Lng for Frontend
- Returns Result<LagekarteDto | null>

DTO:
```typescript
class LagekarteDto {
  id: string;
  einsatzId: string;
  pois: PoiDto[];
  createdAt: Date;
}

class PoiDto {
  id: string;
  name: string;
  coordinate: { mgrs: string; lat: number; lng: number }; // Both formats
  category: string;
  beschreibung?: string;
}
```

**2. GetPoisQuery & Handler**

Query:
```typescript
class GetPoisQuery {
  constructor(
    public readonly lagekarteId: string,
    public readonly category?: string
  ) {}
}
```

Handler:
- Loads aggregate
- Filters POIs by category if specified
- Maps to PoiDto[]
- Returns Result<PoiDto[]>

**3. GetLagekarteExistsQuery & Handler**

Query:
```typescript
class GetLagekarteExistsQuery {
  constructor(public readonly einsatzId: string) {}
}
```

Handler:
- Calls ILagekarteRepository.exists(einsatzId)
- Returns boolean

**And** Unit-Tests validate:
- Query handlers return correct DTOs
- MGRS → Lat/Lng conversion in DTO
- Category filtering works
- Null handling (Lagekarte not found)

**And** DTOs are optimized for Frontend:
- Both MGRS and Lat/Lng in response (Frontend can choose)
- Flat structure (no deep nesting)
- Typed enums for category

**Prerequisites:** Epic 1 (Domain Layer)

**Technical Notes:**
- CQRS: Queries can bypass Aggregate if needed (direct Prisma)
- For now: Load Aggregate, then map to DTO (simplicity)
- Future optimization: Read Models (separate tables)
- DTOs defined in Application Layer (shared between Backend + Frontend via OpenAPI)

---

## Story 2.3: Lagekarte Infrastructure - Prisma Repository Adapter

**As a** Backend Developer,
**I want** a Prisma adapter implementing ILagekarteRepository,
**So that** Lagekarte aggregates are persisted to PostgreSQL.

**Acceptance Criteria:**

**Given** Domain Layer with ILagekarteRepository interface (Epic 1)
**When** I implement the Prisma adapter
**Then** a `PrismaLagekarteRepository` class exists in `infrastructure/persistence/prisma/adapters/`:

**Implementation:**
```typescript
class PrismaLagekarteRepository implements ILagekarteRepository {
  constructor(private prisma: PrismaClient) {}

  async save(aggregate: LagekarteAggregate): Promise<void> {
    const data = PrismaLagekarteMapper.toPersistence(aggregate);

    await this.prisma.lagekarte.upsert({
      where: { id: data.id },
      update: {
        ...data,
        pois: {
          deleteMany: {}, // Clear existing POIs
          create: data.pois // Re-create from aggregate
        }
      },
      create: data
    });
  }

  async findById(id: LagekarteId): Promise<LagekarteAggregate | null> {
    const prismaLagekarte = await this.prisma.lagekarte.findUnique({
      where: { id: id.value },
      include: { pois: true }
    });

    return prismaLagekarte
      ? PrismaLagekarteMapper.toDomain(prismaLagekarte)
      : null;
  }

  async findByEinsatzId(einsatzId: EinsatzId): Promise<LagekarteAggregate | null> {
    const prismaLagekarte = await this.prisma.lagekarte.findUnique({
      where: { einsatzId: einsatzId.value },
      include: { pois: true }
    });

    return prismaLagekarte
      ? PrismaLagekarteMapper.toDomain(prismaLagekarte)
      : null;
  }

  async exists(einsatzId: EinsatzId): Promise<boolean> {
    const count = await this.prisma.lagekarte.count({
      where: { einsatzId: einsatzId.value }
    });
    return count > 0;
  }
}
```

**And** Integration-Tests validate:
- Save creates new Lagekarte
- Save updates existing Lagekarte (upsert)
- FindById returns correct aggregate with POIs
- FindByEinsatzId finds Lagekarte
- Exists returns true/false correctly
- POI collection properly persisted (order maintained)

**And** Error handling:
- Database connection errors caught
- Unique constraint violations mapped to domain errors
- Transaction rollback on save failure

**Prerequisites:**
- Epic 1 (Domain Layer)
- Story 2.4 (Mapper)

**Technical Notes:**
- Use `upsert` for idempotency (save called multiple times OK)
- POIs are cascade-deleted and re-created (simplicity over performance)
- Future optimization: Delta-based POI updates
- Prisma transactions handled internally by Prisma
- Repository returns Domain objects, NEVER Prisma types

---

## Story 2.4: Lagekarte Infrastructure - Domain ↔ Prisma Mapper

**As a** Backend Developer,
**I want** a bidirectional mapper between LagekarteAggregate and Prisma entities,
**So that** domain objects are correctly persisted and hydrated from the database.

**Acceptance Criteria:**

**Given** LagekarteAggregate and Prisma schema exist
**When** I implement the mapper
**Then** a `PrismaLagekarteMapper` class exists in `infrastructure/persistence/prisma/mappers/`:

**Mapper Implementation:**
```typescript
class PrismaLagekarteMapper {
  static toDomain(prismaLagekarte: PrismaLagekarte & { pois: PrismaPoi[] }): LagekarteAggregate {
    const pois = prismaLagekarte.pois.map(prismaPoi =>
      new Poi({
        id: new PoiId(prismaPoi.id),
        name: prismaPoi.name,
        coordinate: MgrsCoordinate.fromString(prismaPoi.mgrsCoordinate),
        category: new PoiCategory(prismaPoi.category),
        beschreibung: prismaPoi.beschreibung ?? undefined,
        createdAt: prismaPoi.createdAt
      })
    );

    return new LagekarteAggregate({
      id: new LagekarteId(prismaLagekarte.id),
      einsatzId: new EinsatzId(prismaLagekarte.einsatzId),
      pois: pois,
      createdAt: prismaLagekarte.createdAt
    });
  }

  static toPersistence(aggregate: LagekarteAggregate): PrismaLagekarteCreateInput {
    return {
      id: aggregate.id.value,
      einsatzId: aggregate.einsatzId.value,
      createdAt: aggregate.createdAt,
      pois: {
        create: aggregate.pois.map(poi => ({
          id: poi.id.value,
          name: poi.name,
          mgrsCoordinate: poi.coordinate.toString(), // MGRS format
          category: poi.category.value,
          beschreibung: poi.beschreibung,
          createdAt: poi.createdAt
        }))
      }
    };
  }
}
```

**And** Unit-Tests validate:
- Bidirectional conversion (Domain → Prisma → Domain = equal)
- MGRS coordinate conversion (string ↔ MgrsCoordinate VO)
- POI collection mapping (order preserved)
- Optional fields (beschreibung can be null)
- EntityId types correctly mapped (string ↔ LagekarteId)
- No data loss in round-trip conversion

**And** Error handling:
- Invalid MGRS format throws domain error
- Missing required fields throw validation errors
- Type conversions are type-safe (no `any`)

**Prerequisites:**
- Epic 1 (Domain Layer)
- Prisma schema for Lagekarte + POI

**Technical Notes:**
- Mapper is pure function (no dependencies)
- MGRS stored as string in DB (e.g., "32U MV 12345 67890")
- PoiCategory enum validated during mapping
- Mapper throws on invalid data (fail-fast, don't persist corrupt state)
- Use TypeScript generics for type safety

---

## Story 2.5: Lagekarte Infrastructure - Nominatim Geocoding Adapter

**As a** Backend Developer,
**I want** a Nominatim API adapter implementing IGeocodingPort,
**So that** addresses can be geocoded to coordinates and vice versa.

**Acceptance Criteria:**

**Given** IGeocodingPort interface exists (Epic 1)
**When** I implement the Nominatim adapter
**Then** a `NominatimGeocodingAdapter` class exists in `infrastructure/external/nominatim/`:

**Implementation:**
```typescript
class NominatimGeocodingAdapter implements IGeocodingPort {
  private baseUrl = 'https://nominatim.openstreetmap.org';

  async geocode(address: Address): Promise<Result<GeoCoordinate>> {
    try {
      const query = address.toString(); // Format: "Strasse Hausnummer, PLZ Ort"
      const response = await fetch(
        `${this.baseUrl}/search?q=${encodeURIComponent(query)}&format=json&limit=1`
      );

      const data = await response.json();

      if (data.length === 0) {
        return Result.fail('Address not found');
      }

      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);

      return Result.ok(new GeoCoordinate(lat, lng));
    } catch (error) {
      return Result.fail(`Geocoding failed: ${error.message}`);
    }
  }

  async reverseGeocode(coordinate: GeoCoordinate): Promise<Result<Address>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/reverse?lat=${coordinate.latitude}&lon=${coordinate.longitude}&format=json`
      );

      const data = await response.json();

      if (!data.address) {
        return Result.fail('Coordinate not found');
      }

      return Result.ok(new Address({
        strasse: data.address.road,
        hausnummer: data.address.house_number,
        plz: data.address.postcode,
        ort: data.address.city || data.address.town || data.address.village
      }));
    } catch (error) {
      return Result.fail(`Reverse geocoding failed: ${error.message}`);
    }
  }
}
```

**And** Integration-Tests validate:
- Geocode known address returns correct coordinates (±100m tolerance)
- Reverse geocode known coordinates returns address
- Invalid address returns Result.fail()
- Network errors handled gracefully
- Rate limiting respected (1 request per second)

**And** Configuration:
- User-Agent header set (required by Nominatim policy)
- Timeout: 5 seconds
- Retry logic: 3 attempts with exponential backoff
- Cache: Optional (not required for MVP)

**Prerequisites:**
- Epic 1 (Domain Layer with IGeocodingPort)
- Story 1.5 (Address and GeoCoordinate VOs)

**Technical Notes:**
- Nominatim is free OpenStreetMap service
- Rate limit: 1 request/second (respect fair use policy)
- User-Agent MUST be set (e.g., "BlueLight-Hub/1.0")
- Fallback: If Nominatim fails, return Result.fail() (no hard crash)
- Future: Replace with paid service (Google Maps, Here.com) for production

---

## Story 2.6: Lagekarte Controller Refactoring

**As a** Backend Developer,
**I want** LagekarteController refactored to use CommandBus/QueryBus,
**So that** the controller is a thin adapter without business logic.

**Acceptance Criteria:**

**Given** Command/Query handlers exist (Story 2.1, 2.2)
**When** I refactor LagekarteController
**Then** the controller in `infrastructure/http/controllers/` uses CommandBus/QueryBus:

**Before (Old Service-based):**
```typescript
@Controller('lagekarte')
class LagekarteController {
  constructor(private lagekarteService: LagekarteService) {} // OLD

  @Post()
  async create(@Body() dto: CreateLagekarteDto) {
    return this.lagekarteService.create(dto); // Business logic in service
  }
}
```

**After (New CQRS-based):**
```typescript
@Controller('lagekarte')
@ApiTags('lagekarte')
class LagekarteController {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus
  ) {}

  @Post()
  @ApiOperation({ summary: 'Lagekarte erstellen' })
  @ApiCreatedResponse({ type: LagekarteDto })
  async create(@Body() dto: CreateLagekarteDto): Promise<LagekarteDto> {
    const command = new CreateLagekarteCommand(
      dto.einsatzId,
      dto.initialPoi
    );

    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      throw new BadRequestException(result.error);
    }

    // Query to return created Lagekarte
    const query = new GetLagekarteQuery(dto.einsatzId);
    const lagekarteResult = await this.queryBus.execute(query);

    return lagekarteResult.value;
  }

  @Post(':lagekarteId/poi')
  @ApiOperation({ summary: 'POI hinzufügen' })
  async addPoi(
    @Param('lagekarteId') lagekarteId: string,
    @Body() dto: AddPoiDto
  ): Promise<PoiDto> {
    const command = new AddPoiCommand(
      lagekarteId,
      dto.name,
      dto.coordinate,
      dto.category,
      dto.beschreibung
    );

    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      throw new BadRequestException(result.error);
    }

    return result.value; // Return created POI
  }

  @Get('einsatz/:einsatzId')
  @ApiOperation({ summary: 'Lagekarte abrufen' })
  async getByEinsatzId(@Param('einsatzId') einsatzId: string): Promise<LagekarteDto | null> {
    const query = new GetLagekarteQuery(einsatzId);
    const result = await this.queryBus.execute(query);

    if (result.isFailure) {
      throw new NotFoundException(result.error);
    }

    return result.value;
  }
}
```

**And** DTOs updated:
- `CreateLagekarteDto` with OpenAPI decorators
- `AddPoiDto` with validation decorators
- Response DTOs match Query handler outputs

**And** Integration-Tests validate:
- POST /lagekarte creates Lagekarte
- POST /lagekarte/:id/poi adds POI
- GET /lagekarte/einsatz/:id returns Lagekarte
- Error responses (400, 404) correct
- OpenAPI spec generated correctly

**And** Old code kept for rollback:
- Old `LagekarteService` NOT deleted yet (Epic 5)
- Controller can be reverted to old service
- Feature flag for switching (optional)

**Prerequisites:**
- Story 2.1 (Commands)
- Story 2.2 (Queries)
- Story 2.3 (Repository)

**Technical Notes:**
- Controller max. 20 lines per method (thin adapter)
- NO business logic in controller (only DTO → Command mapping)
- Result<T> errors mapped to HTTP exceptions
- OpenAPI decorators REQUIRED for API client generation
- Old service kept for rollback safety

---

## Story 2.7: Lagekarte Event Publishing Integration

**As a** Backend Developer,
**I want** Domain events from LagekarteAggregate published to the event system,
**So that** other modules can react to Lagekarte changes (e.g., audit logging).

**Acceptance Criteria:**

**Given** Command handlers emit domain events
**When** I integrate event publishing
**Then** an `EventPublisher` service exists in `infrastructure/events/`:

**Implementation:**
```typescript
class EventPublisher {
  constructor(private eventEmitter: EventEmitter2) {}

  async publish(event: DomainEvent): Promise<void> {
    await this.eventEmitter.emitAsync(event.constructor.name, event);
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
```

**And** Command handlers call EventPublisher after save:
```typescript
// In CreateLagekarteHandler
const aggregate = LagekarteAggregate.create(einsatzId, initialPoi);
await this.repository.save(aggregate);
await this.eventPublisher.publishAll(aggregate.getUncommittedEvents());
aggregate.clearEvents();
```

**And** Event handlers exist for logging:
```typescript
@Injectable()
class LagekarteEventLogger {
  @OnEvent(LagekarteCreatedEvent)
  async handleCreated(event: LagekarteCreatedEvent) {
    this.logger.log(`Lagekarte created for Einsatz ${event.einsatzId.value}`);
  }

  @OnEvent(PoiAddedEvent)
  async handlePoiAdded(event: PoiAddedEvent) {
    this.logger.log(`POI ${event.poiId.value} added to Lagekarte ${event.lagekarteId.value}`);
  }
}
```

**And** Integration-Tests validate:
- LagekarteCreatedEvent published after creation
- PoiAddedEvent published after POI addition
- Event handlers receive correct event data
- Events NOT published if save fails (transactional)

**Prerequisites:**
- Story 2.1 (Commands)
- Story 2.3 (Repository)
- Epic 1 (Domain Events)

**Technical Notes:**
- Use NestJS EventEmitter2 for now (simple)
- Future: Replace with Transactional Outbox (Epic 4)
- Events published AFTER save (not before)
- clearEvents() prevents duplicate publishing
- Event handlers are asynchronous

---

## Story 2.8: Frontend - API Client Regeneration & Component Updates

**As a** Frontend Developer,
**I want** the API client regenerated and Lagekarte components updated,
**So that** the Frontend uses the new Backend API.

**Acceptance Criteria:**

**Given** Backend API has changed (Story 2.6)
**When** I regenerate the API client
**Then** the following tasks are completed:

**1. API Client Generation (1h)**
```bash
pnpm run generate-api
```

**And** verify new types exist:
- `LagekarteDto`
- `PoiDto`
- `CreateLagekarteDto`
- `AddPoiDto`

**2. TanStack Query Hooks Update (2-3h)**

Update `src/hooks/lagekarte/useLagekarte.ts`:
```typescript
// Before (Old API)
const useLagekarte = (einsatzId: string) => {
  return useQuery({
    queryKey: ['lagekarte', einsatzId],
    queryFn: () => fetch(`/api/lagekarte/${einsatzId}`).then(r => r.json())
  });
};

// After (New API Client)
import { api } from '@bluelight-hub/shared/client';

const useLagekarte = (einsatzId: string) => {
  return useQuery({
    queryKey: ['lagekarte', einsatzId],
    queryFn: () => api.lagekarte.getByEinsatzId(einsatzId)
  });
};
```

Create `src/hooks/lagekarte/useCreateLagekarte.ts`:
```typescript
const useCreateLagekarte = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateLagekarteDto) =>
      api.lagekarte.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lagekarte'] });
    }
  });
};
```

**3. Component Updates (1-2h)**

Update Lagekarte components to use new hooks:
- `LagekarteMap.tsx` - Display POIs with MGRS coordinates
- `PoiForm.tsx` - Add POI form (use new AddPoiDto types)
- `CoordinateInput.tsx` - Support both MGRS and Lat/Lng input

**4. Type-Error Fixes (1h)**

Fix any TypeScript errors from API changes:
- Import new types from generated client
- Update component props
- Fix form schemas (Zod)

**And** Manual Testing validates:
- Lagekarte can be created from Frontend
- POIs can be added/removed
- MGRS coordinates displayed correctly
- No console errors
- Network requests use new API endpoints

**Prerequisites:**
- Story 2.6 (Backend API)
- Backend running locally (Port 3000)

**Technical Notes:**
- API client generation uses OpenAPI spec from Backend
- TanStack Query query keys MUST match for cache invalidation
- MGRS display format: "32U MV 12345 67890" (readable)
- Lat/Lng as fallback for external map libraries (Leaflet)

---

## Story 2.9: Lagekarte Migration - Integration Tests & Rollback Plan

**As a** Backend Developer,
**I want** comprehensive integration tests and a rollback plan,
**So that** the Lagekarte migration is safe and reversible.

**Acceptance Criteria:**

**Given** Lagekarte migration is complete (Stories 2.1-2.8)
**When** I implement integration tests
**Then** the following tests exist:

**1. End-to-End Integration Tests (4-6h)**

Test file: `test/integration/lagekarte.integration.spec.ts`

Tests:
```typescript
describe('Lagekarte Migration - E2E', () => {
  it('should create Lagekarte with initial POI', async () => {
    // Arrange
    const einsatz = await createEinsatz();

    // Act
    const response = await request(app.getHttpServer())
      .post('/lagekarte')
      .send({
        einsatzId: einsatz.id,
        initialPoi: {
          name: 'Einsatzstelle',
          coordinate: { lat: 52.5200, lng: 13.4050 },
          category: 'EINSATZSTELLE'
        }
      });

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.pois).toHaveLength(1);
    expect(response.body.pois[0].coordinate.mgrs).toMatch(/^\d{1,2}[A-Z] [A-Z]{2} \d{5} \d{5}$/);
  });

  it('should convert Lat/Lng to MGRS automatically', async () => {
    const lagekarte = await createLagekarte();

    const response = await request(app.getHttpServer())
      .post(`/lagekarte/${lagekarte.id}/poi`)
      .send({
        name: 'Wasserentnahme',
        coordinate: { lat: 52.5200, lng: 13.4050 },
        category: 'WASSERENTNAHMESTELLE'
      });

    expect(response.status).toBe(201);
    expect(response.body.coordinate.mgrs).toBeDefined();
    expect(response.body.coordinate.lat).toBeCloseTo(52.5200, 4);
  });

  it('should emit LagekarteCreatedEvent', async () => {
    const eventSpy = jest.spyOn(eventEmitter, 'emitAsync');

    await createLagekarte();

    expect(eventSpy).toHaveBeenCalledWith(
      'LagekarteCreatedEvent',
      expect.any(LagekarteCreatedEvent)
    );
  });
});
```

**2. Rollback Plan Documentation**

Create `docs/rollback/lagekarte-migration-rollback.md`:
```markdown
# Lagekarte Migration Rollback Plan

# Trigger Conditions
- Integration tests failing
- Performance regression >20%
- Critical bug in production

# Rollback Steps (15 minutes)

1. Backend: Revert Controller
   ```typescript
   // Change from:
   await this.commandBus.execute(command);
   // Back to:
   await this.lagekarteService.create(dto);
   ```

2. Frontend: Revert to previous API client
   ```bash
   git checkout HEAD~1 packages/shared/client/apis/
   pnpm install
   ```

3. Verify
   - Run integration tests
   - Manual QA: Create Lagekarte + POI

# Monitoring
- Check error logs
- Check API response times (should be <200ms)
```

**And** Performance Baseline established:
- Measure API response times BEFORE migration
- Measure API response times AFTER migration
- Acceptable: ±10% variance

**And** Smoke Tests pass:
- Lagekarte CRUD works
- POI addition works
- MGRS ↔ Lat/Lng conversion works
- Events are published

**Prerequisites:**
- All Stories 2.1-2.8 complete

**Technical Notes:**
- Integration tests use real database (test DB)
- Tests clean up after themselves (no data pollution)
- Rollback MUST be executable in <30 minutes
- Old code NOT deleted until Epic 5

---
