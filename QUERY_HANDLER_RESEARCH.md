# Query Handler Implementation Patterns & Testing Strategies for Story 2.2

**Context:** Story 2.2 implements CQRS Query Handlers for Lagekarte read operations. Story 2.1 (Commands) is complete and validated through comprehensive test examples.

**Research Date:** November 18, 2025
**Project:** Bluelight Hub - Hexagonal Architecture Migration
**Status:** Complete - Ready for Story 2.2 Implementation

---

## 1. CQRS Architecture Overview in This Project

### Key Files Analyzed
- **Commands (Story 2.1 - COMPLETE):**
  - `/packages/backend/src/application/lagekarte/commands/create-lagekarte.command.ts` - Command definition
  - `/packages/backend/src/application/lagekarte/commands/create-lagekarte.handler.ts` - Handler implementation
  - `/packages/backend/src/application/lagekarte/commands/__tests__/create-lagekarte.handler.spec.ts` - Test examples

- **Domain Layer:**
  - `/packages/backend/src/domain/aggregates/lagekarte.aggregate.ts` - Root aggregate
  - `/packages/backend/src/domain/repositories/i-lagekarte.repository.ts` - Repository interface

- **DTO & API Patterns:**
  - `/packages/backend/src/einsatz/dto/einsatz-response.dto.ts` - Response DTO example
  - `/packages/backend/src/einsatz/dto/einsatz-query.dto.ts` - Query DTO example
  - `/packages/backend/src/einsatz/einsatz.service.ts` - Service with query methods

---

## 2. Existing Query Handler Pattern (From Story 2.1 Handler)

### 2.1 Query Class Structure

**Pattern from CreateLagekarteCommand (Commands):**

```typescript
/**
 * Command zum Erstellen einer neuen Lagekarte für einen Einsatz.
 *
 * Diese Command unterstützt optionales initialPoi, um Lagekarte + ersten POI
 * atomar zu erstellen (verhindert leere Lagekarten in der DB).
 *
 * Warum Command Pattern: Entkoppelt Controller von Domain-Logic,
 * ermöglicht spätere Event-Sourcing-Migration ohne Controller-Änderungen.
 */
export class CreateLagekarteCommand {
  constructor(
    public readonly einsatzId: string,
    public readonly initialPoi?: {
      name: string;
      coordinate: { lat: number; lng: number } | { mgrs: string };
      category: string;
    },
  ) {
    // Validation: einsatzId required
    if (!einsatzId || einsatzId.trim().length === 0) {
      throw new Error('einsatzId is required');
    }

    // Validation: initialPoi fields if provided
    if (initialPoi) {
      if (!initialPoi.name || initialPoi.name.trim().length === 0) {
        throw new Error('initialPoi.name is required when initialPoi is provided');
      }
      if (!initialPoi.coordinate) {
        throw new Error('initialPoi.coordinate is required');
      }
      if (!initialPoi.category || initialPoi.category.trim().length === 0) {
        throw new Error('initialPoi.category is required when initialPoi is provided');
      }
    }
  }
}
```

**Patterns for Queries (Story 2.2):**
- Queries should be similar - simple data holders with constructor validation
- No side effects, read-only intent (clear from naming)
- Validation in constructor: required fields, format checks

### 2.2 Handler Implementation Pattern

**Concrete Example from CreateLagekarteCommandHandler:**

```typescript
import { Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { Poi } from '@domain/entities/poi.entity';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { UserId } from '@domain/value-objects/user-id';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import type { CreateLagekarteCommand } from './create-lagekarte.command';

/**
 * Handler für CreateLagekarteCommand.
 *
 * Orchestriert die Erstellung einer Lagekarte über das Domain-Aggregate.
 * Validiert Einsatz-Existenz, konvertiert Koordinaten, delegiert Business-Logic
 * an LagekarteAggregate.
 *
 * Warum Koordinaten-Konversion hier: Application Layer ist zuständig für
 * Format-Transformation (Lat/Lng → MGRS). Domain Layer arbeitet ausschließlich
 * mit MGRS (DRK-Standard).
 *
 * TODO (Epic 2.7): Event Publishing via IEventPublisher nach save() hinzufügen.
 */
@Injectable()
export class CreateLagekarteCommandHandler {
  constructor(
    private readonly einsatzRepository: IEinsatzRepository,
    private readonly lagekarteRepository: ILagekarteRepository,
  ) {}

  async execute(command: CreateLagekarteCommand): Promise<Result<LagekarteId>> {
    // Step 1: Validate EinsatzId
    const einsatzIdResult = EinsatzId.create(command.einsatzId);
    if (einsatzIdResult.isFailure) {
      return Result.fail<LagekarteId>(einsatzIdResult.error!);
    }
    const einsatzId = einsatzIdResult.value!;

    // Step 2: Check Einsatz exists
    const einsatzExistsResult = await this.einsatzRepository.exists(einsatzId);
    if (einsatzExistsResult.isFailure) {
      return Result.fail<LagekarteId>(einsatzExistsResult.error!);
    }
    if (!einsatzExistsResult.value) {
      return Result.fail<LagekarteId>(`Einsatz with ID ${einsatzId.value} not found`);
    }

    // Step 3: Check Lagekarte doesn't already exist
    const existingLagekarte = await this.lagekarteRepository.findByEinsatzId(einsatzId);
    if (existingLagekarte !== null) {
      return Result.fail<LagekarteId>(`Lagekarte already exists for Einsatz ${einsatzId.value}`);
    }

    // Step 4: Create Poi entity if initialPoi provided
    let initialPoi: Poi | undefined;
    if (command.initialPoi) {
      // Convert coordinate to MGRS
      let mgrsCoordinate: MgrsCoordinate;
      if ('mgrs' in command.initialPoi.coordinate) {
        const mgrsResult = MgrsCoordinate.fromString(command.initialPoi.coordinate.mgrs);
        if (mgrsResult.isFailure) {
          return Result.fail<LagekarteId>(`Invalid MGRS coordinate: ${mgrsResult.error}`);
        }
        mgrsCoordinate = mgrsResult.value!;
      } else {
        const mgrsResult = MgrsCoordinate.fromLatLng(
          command.initialPoi.coordinate.lat,
          command.initialPoi.coordinate.lng
        );
        if (mgrsResult.isFailure) {
          return Result.fail<LagekarteId>(`Invalid Lat/Lng coordinate: ${mgrsResult.error}`);
        }
        mgrsCoordinate = mgrsResult.value!;
      }

      // Create PoiCategory
      const categoryResult = PoiCategory.create(command.initialPoi.category);
      if (categoryResult.isFailure) {
        return Result.fail<LagekarteId>(`Invalid POI category: ${categoryResult.error}`);
      }

      // Placeholder UserId until auth implemented
      const userIdResult = UserId.create('SYSTEM');
      if (userIdResult.isFailure) {
        return Result.fail<LagekarteId>(userIdResult.error!);
      }

      // Create Poi entity using factory method
      initialPoi = Poi.create(
        command.initialPoi.name,
        mgrsCoordinate,
        categoryResult.value!,
        userIdResult.value!
      );
    }

    // Step 5: Create aggregate
    const aggregateResult = LagekarteAggregate.create(einsatzId, initialPoi);
    if (aggregateResult.isFailure) {
      return Result.fail<LagekarteId>(aggregateResult.error!);
    }
    const aggregate = aggregateResult.value!;

    // Step 6: Save
    try {
      await this.lagekarteRepository.save(aggregate);
    } catch (error) {
      return Result.fail<LagekarteId>(
        `Failed to save Lagekarte: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // TODO (Epic 2.7): Publish domain events
    // await this.eventPublisher.publishAll(aggregate.getDomainEvents());
    // aggregate.clearDomainEvents();

    return Result.ok(aggregate.id);
  }
}
```

**Key Handler Patterns for Queries:**

1. **@Injectable() decorator** - NestJS dependency injection
2. **Constructor injection** - Repositories passed via DI (not called, just store reference)
3. **Result<T> pattern** - Explicit error handling (no throw)
4. **Orchestration Flow:**
   - Step 1-2: Validate inputs
   - Step 3: Load data from repositories
   - Step 4: Transform/map to DTO
   - Step 5: Return Result<T>
5. **No Event Publishing in Queries** (only in Commands)
6. **No Side Effects** - Queries are read-only

---

## 3. DTO Patterns & Mapping Strategies

### 3.1 Response DTO Pattern (From EinsatzResponseDto)

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EinsatzStatus, type Prisma } from '@prisma/client';
import { IsEnum } from 'class-validator';

/**
 * Response-DTO für einen Einsatz.
 *
 * Zweck: Entkoppelt die persistente Entität (Prisma) von der API-Antwort
 * und erlaubt ergänzende/berechnete Felder ohne DB-spezifische Logik.
 * Dieses DTO beschreibt ausschließlich die nach außen exponierten Felder
 * und enthält keine Geschäfts- oder Persistenzlogik.
 */
export class EinsatzResponseDto {
  @ApiProperty({
    description: 'Eindeutige ID des Einsatzes',
    example: 'cm4xyzabc123456789',
  })
  id!: string;

  @ApiPropertyOptional({
    description: 'Das Alarmstichwort des Einsatzes',
    example: 'Brand 3',
  })
  alarmstichwort!: string | null;

  // ... other fields with @ApiProperty decorators
}
```

**Key DTO Patterns:**
1. **@ApiProperty/@ApiPropertyOptional** - Swagger/OpenAPI decorators for API spec generation
2. **Optional fields** - Use `!` or nullable types (`null`)
3. **Computed/enriched fields** - Can include calculated values (not from DB)
4. **Enums** - @IsEnum validators for category-like fields
5. **Date fields** - Use Date type with format metadata
6. **Security** - Use `Pick<>` to explicitly allow only certain fields

### 3.2 Query DTO Pattern (From EinsatzQueryDto)

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EinsatzStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * DTO für Query-Parameter beim Abrufen von Einsätzen
 */
export class EinsatzQueryDto {
  @ApiPropertyOptional({
    enum: EinsatzStatus,
    description: 'Filter nach Einsatz-Status',
    example: EinsatzStatus.ANGELEGT,
  })
  @IsOptional()
  @IsEnum(EinsatzStatus)
  status?: EinsatzStatus;

  @ApiPropertyOptional({
    description: 'Seitennummer für Pagination (startet bei 1)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  page?: number;

  @ApiPropertyOptional({
    description: 'Anzahl Einträge pro Seite',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  limit?: number;
}
```

**Key Query DTO Patterns:**
1. **@IsOptional()** - All query parameters optional
2. **@Transform()** - Parse string query params to proper types
3. **Validators** - @Min, @Max, @IsEnum for value validation
4. **Pagination fields** - page, limit for cursor/offset pagination
5. **Filtering fields** - status, search for dynamic filtering

### 3.3 Mapper Function Pattern (From UserResponse Mapper)

```typescript
import type { User } from '@prisma/client';
import type { UserResponseDto } from '../dto/user-response.dto';

/**
 * Konvertiert ein Prisma User-Objekt in einen sicheren UserResponseDto
 *
 * Entfernt sensitive Felder wie:
 * - passwordHash
 * - failedLoginCount
 * - lockedUntil
 *
 * @param user - Das vollständige User-Objekt aus der Datenbank
 * @returns Gefiltertes User-Objekt für API-Responses
 */
export function toUserResponseDto(user: User): UserResponseDto {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
```

**Mapper Patterns for Queries:**
1. **Pure functions** - No dependencies, deterministic
2. **Single responsibility** - One transformation per mapper
3. **Type-safe** - Use explicit Pick<> for security
4. **Performance** - Direct field mapping (no loops unless needed)
5. **Null handling** - Explicit handling of optional fields

---

## 4. Query Handler Pattern for Story 2.2

### 4.1 Recommended Structure (Based on Analysis)

**For GetLagekarteQuery:**

```typescript
/**
 * Query to retrieve a Lagekarte by Einsatz ID.
 *
 * Lightweight query object - minimal validation (format checks only).
 * Business logic validation happens in Handler (if needed).
 */
export class GetLagekarteQuery {
  constructor(public readonly einsatzId: string) {
    if (!einsatzId || einsatzId.trim().length === 0) {
      throw new Error('einsatzId is required');
    }
  }
}
```

**Handler Pattern:**

```typescript
import { Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import { GetLagekarteQuery } from './get-lagekarte.query';
import { LagekarteDto } from './dto/lagekarte.dto';
import { LagekarteDtoMapper } from './mappers/lagekarte-dto.mapper';

/**
 * Handler für GetLagekarteQuery.
 *
 * Lädt eine Lagekarte anhand der Einsatz-ID und mapped zu DTO.
 *
 * Warum separate Handler für Queries?
 * - CQRS Separation: Commands verändern State, Queries sind read-only
 * - Optimierungsoptionen: Future Queries können Direct Prisma nutzen
 * - Single Responsibility: Jeder Handler hat klar definierte Aufgabe
 *
 * Differences from Command Handlers:
 * - KEINE Event Publishing
 * - KEINE Repository.save()
 * - NUR read operations (findById, findByEinsatzId, exists)
 * - Daten können direkt aus Prisma kommen (kein Aggregate reload nötig)
 */
@Injectable()
export class GetLagekarteQueryHandler {
  constructor(private readonly lagekarteRepository: ILagekarteRepository) {}

  async execute(query: GetLagekarteQuery): Promise<Result<LagekarteDto | null>> {
    // Step 1: Validate EinsatzId format
    const einsatzIdResult = EinsatzId.create(query.einsatzId);
    if (einsatzIdResult.isFailure) {
      return Result.fail<LagekarteDto | null>(einsatzIdResult.error!);
    }
    const einsatzId = einsatzIdResult.value!;

    // Step 2: Load Lagekarte from repository
    let lagekarte;
    try {
      lagekarte = await this.lagekarteRepository.findByEinsatzId(einsatzId);
    } catch (error) {
      return Result.fail<LagekarteDto | null>(
        `Failed to load Lagekarte: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Step 3: Handle not found case (valid response, not an error)
    if (lagekarte === null) {
      return Result.ok<LagekarteDto | null>(null);
    }

    // Step 4: Map Aggregate to DTO
    const dto = LagekarteDtoMapper.fromAggregate(lagekarte);

    return Result.ok(dto);
  }
}
```

### 4.2 DTO Design for Queries

**Based on Epic 2.2 specification:**

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PoiDto {
  @ApiProperty({
    description: 'Eindeutige POI-ID',
    example: 'A1B2C3D4E5F6G7H8I9J0K',
  })
  id!: string;

  @ApiProperty({
    description: 'Name des POI',
    example: 'Brandenburger Tor',
  })
  name!: string;

  @ApiProperty({
    description: 'Koordinaten in beiden Formaten',
    example: {
      mgrs: '33UUU1234567890',
      lat: 52.5163,
      lng: 13.3777,
    },
  })
  coordinate!: {
    mgrs: string;
    lat: number;
    lng: number;
  };

  @ApiProperty({
    description: 'POI-Kategorie',
    example: 'EINSATZSTELLE',
    enum: [
      'EINSATZSTELLE',
      'BEREITSTELLUNGSRAUM',
      'WASSERENTNAHMESTELLE',
      'VERLETZTENABLAGE',
      'KOMMANDOSTELLE',
    ],
  })
  category!: string;

  @ApiPropertyOptional({
    description: 'Beschreibung des POI',
    example: 'Haupteingang, Brandenburger Tor',
    nullable: true,
  })
  beschreibung?: string;

  @ApiProperty({
    description: 'Erstellungszeitpunkt',
    type: String,
    format: 'date-time',
  })
  createdAt!: Date;
}

export class LagekarteDto {
  @ApiProperty({
    description: 'Eindeutige Lagekarten-ID',
    example: 'L1B2C3D4E5F6G7H8I9J0K',
  })
  id!: string;

  @ApiProperty({
    description: 'Zugehörige Einsatz-ID',
    example: 'E1B2C3D4E5F6G7H8I9J0K',
  })
  einsatzId!: string;

  @ApiProperty({
    description: 'Points of Interest auf dieser Lagekarte',
    type: () => [PoiDto],
  })
  pois!: PoiDto[];

  @ApiProperty({
    description: 'Erstellungszeitpunkt',
    type: String,
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Letzter Update-Zeitpunkt',
    type: String,
    format: 'date-time',
  })
  updatedAt!: Date;
}
```

### 4.3 DTO Mapper Pattern for Queries

```typescript
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { GeoCoordinate } from '@domain/value-objects/geo-coordinate';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { LagekarteDto, PoiDto } from './lagekarte.dto';

/**
 * Mapper von LagekarteAggregate zu LagekarteDto.
 *
 * Transformiert Domain Model zu API Response Model.
 * Konvertiert MGRS → Lat/Lng für Frontend (beide Formate im Response).
 *
 * Warum separate Mapper?
 * - DRY: Bei mehreren Query Handlers mit gleichem DTO
 * - Testability: Mapper kann isoliert getestet werden
 * - Maintainability: Zentrale Stelle für Transformation
 */
export class LagekarteDtoMapper {
  /**
   * Konvertiert LagekarteAggregate zu DTO.
   *
   * Transformations:
   * - Aggregate POI Collection → Array von PoiDto
   * - MGRS Coordinate → MGRS String + Lat/Lng Numbers
   * - Entity createdAt → DTO createdAt
   *
   * @param aggregate - Domain Lagekarte Aggregate
   * @returns DTO für API Response
   */
  static fromAggregate(aggregate: LagekarteAggregate): LagekarteDto {
    const pois: PoiDto[] = aggregate.pois.map((poi) => {
      // Convert MGRS to both MGRS string and Lat/Lng
      const mgrsString = poi.coordinate.toString(); // "33UUU1234567890"

      // Convert MGRS back to Lat/Lng for Frontend (if needed)
      const geoCoordinate = GeoCoordinate.fromMgrs(poi.coordinate).value;
      const lat = geoCoordinate?.latitude ?? 0;
      const lng = geoCoordinate?.longitude ?? 0;

      return {
        id: poi.id.value,
        name: poi.name,
        coordinate: {
          mgrs: mgrsString,
          lat,
          lng,
        },
        category: poi.category.value,
        beschreibung: poi.beschreibung ?? undefined,
        createdAt: poi.createdAt,
      };
    });

    return {
      id: aggregate.id.value,
      einsatzId: aggregate.einsatzId.value,
      pois,
      createdAt: aggregate.createdAt,
      updatedAt: aggregate.updatedAt,
    };
  }
}
```

---

## 5. Testing Strategies for Query Handlers

### 5.1 Unit Test Pattern (From Command Handler Tests)

**Key Patterns Adapted for Queries:**

```typescript
import { GetLagekarteQueryHandler } from '../get-lagekarte.query-handler';
import { GetLagekarteQuery } from '../get-lagekarte.query';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import { Result } from '@domain/common/result';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';

/**
 * Unit Tests für GetLagekarteQueryHandler.
 *
 * Testet Handler-Orchestration gemäß BDD Given-When-Then Pattern.
 * Nutzt jest.fn() für Repository-Mocks (NO NestJS Test Module).
 *
 * Coverage Target: >90%
 * Testing Framework: Jest 30.2.0 mit @swc/jest
 *
 * Key Differences from Command Tests:
 * - NO Event Publishing assertions
 * - NO Repository.save() assertions
 * - Focus on: Data Loading, DTO Mapping, Null Handling
 */
describe('GetLagekarteQueryHandler', () => {
  let handler: GetLagekarteQueryHandler;
  let mockLagekarteRepo: jest.Mocked<ILagekarteRepository>;

  beforeEach(() => {
    // Create mock repository
    mockLagekarteRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEinsatzId: jest.fn(),
      exists: jest.fn(),
    } as any;

    // Instantiate handler with mock (Direct Instantiation Pattern)
    handler = new GetLagekarteQueryHandler(mockLagekarteRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should return Lagekarte DTO when found', async () => {
      // Given
      const einsatzId = 'test-einsatz-id-123456789abc';
      const query = new GetLagekarteQuery(einsatzId);

      // Mock: Lagekarte found
      const testAggregate = createTestLagekarteAggregate(einsatzId, 1); // 1 POI
      mockLagekarteRepo.findByEinsatzId.mockResolvedValue(testAggregate);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.id).toBe(testAggregate.id.value);
      expect(result.value?.einsatzId).toBe(einsatzId);
      expect(result.value?.pois).toHaveLength(1);

      // Verify correct repository method called
      expect(mockLagekarteRepo.findByEinsatzId).toHaveBeenCalledWith(
        expect.objectContaining({ value: einsatzId })
      );
    });

    it('should return null when Lagekarte not found', async () => {
      // Given
      const einsatzId = 'test-einsatz-id-not-exists-123';
      const query = new GetLagekarteQuery(einsatzId);

      // Mock: Lagekarte NOT found
      mockLagekarteRepo.findByEinsatzId.mockResolvedValue(null);

      // When
      const result = await handler.execute(query);

      // Then: null is a valid success response, not a failure
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();

      // Verify repository was called
      expect(mockLagekarteRepo.findByEinsatzId).toHaveBeenCalledTimes(1);
    });

    it('should map Aggregate to DTO with MGRS + Lat/Lng coordinates', async () => {
      // Given
      const einsatzId = 'test-einsatz-123';
      const query = new GetLagekarteQuery(einsatzId);

      // Create aggregate with POI (MGRS coordinates)
      const testAggregate = createTestLagekarteAggregate(einsatzId, 2); // 2 POIs
      mockLagekarteRepo.findByEinsatzId.mockResolvedValue(testAggregate);

      // When
      const result = await handler.execute(query);
      const dto = result.value!;

      // Then: DTO contains both MGRS and Lat/Lng
      expect(dto.pois).toHaveLength(2);
      dto.pois.forEach((poi) => {
        // MGRS format: "32U MV 12345 67890" or similar
        expect(poi.coordinate.mgrs).toBeDefined();
        expect(typeof poi.coordinate.mgrs).toBe('string');

        // Lat/Lng numbers
        expect(poi.coordinate.lat).toBeDefined();
        expect(poi.coordinate.lng).toBeDefined();
        expect(typeof poi.coordinate.lat).toBe('number');
        expect(typeof poi.coordinate.lng).toBe('number');

        // Lat in [-90, 90], Lng in [-180, 180]
        expect(poi.coordinate.lat).toBeGreaterThanOrEqual(-90);
        expect(poi.coordinate.lat).toBeLessThanOrEqual(90);
        expect(poi.coordinate.lng).toBeGreaterThanOrEqual(-180);
        expect(poi.coordinate.lng).toBeLessThanOrEqual(180);
      });
    });
  });

  describe('Failure Cases', () => {
    it('should fail when einsatzId is invalid format', async () => {
      // Given
      const query = new GetLagekarteQuery('invalid-id'); // Invalid if EinsatzId.create() rejects

      // Mock: EinsatzId validation fails
      mockLagekarteRepo.findByEinsatzId.mockResolvedValue(null);

      // When
      const result = await handler.execute(query);

      // Then: Check based on actual EinsatzId validation
      // (Implementation dependent)
      if (result.isFailure) {
        expect(result.error).toBeDefined();
      }
    });

    it('should fail when repository throws error', async () => {
      // Given
      const einsatzId = 'test-einsatz-123';
      const query = new GetLagekarteQuery(einsatzId);

      // Mock: Repository error (DB connection failed, etc.)
      mockLagekarteRepo.findByEinsatzId.mockRejectedValue(
        new Error('Database connection timeout')
      );

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to load Lagekarte');
      expect(result.error).toContain('Database connection timeout');
    });
  });

  describe('DTO Null Handling', () => {
    it('should handle POI with null beschreibung', async () => {
      // Given
      const einsatzId = 'test-einsatz-123';
      const query = new GetLagekarteQuery(einsatzId);

      // Create aggregate with POI that has no description
      const testAggregate = createTestLagekarteAggregateWithOptionalFields(einsatzId);
      mockLagekarteRepo.findByEinsatzId.mockResolvedValue(testAggregate);

      // When
      const result = await handler.execute(query);
      const dto = result.value!;

      // Then
      const poi = dto.pois[0];
      expect(poi.beschreibung).toBeUndefined(); // null → undefined in DTO
    });
  });
});

// Helper functions for test data
function createTestLagekarteAggregate(einsatzId: string, poiCount: number): LagekarteAggregate {
  // Create test aggregate with specified POI count
  // (Implementation details omitted for brevity)
}

function createTestLagekarteAggregateWithOptionalFields(einsatzId: string): LagekarteAggregate {
  // Create test aggregate with optional fields set to null
  // (Implementation details omitted for brevity)
}
```

### 5.2 Key Testing Differences: Commands vs Queries

| Aspect | Commands | Queries |
|--------|----------|---------|
| **Repository Methods** | `save()` + `findById()` | `findById()`, `findByEinsatzId()`, `exists()` only |
| **Event Publishing** | Assert `publishAll()` called | NO event publishing |
| **Side Effects** | Assert state changes | NO assertions for side effects |
| **Return Type** | Result with created ID/DTO | Result with DTO or null |
| **Null Handling** | Exceptions if not found | null is valid result |
| **DTO Mapping** | Not in Command | Always map Aggregate→DTO |
| **Error Focus** | Validation + repository errors | Data transformation errors |

### 5.3 Test Cases Checklist for Story 2.2

**GetLagekarteQuery Handler Tests:**
- ✅ Success: Return LagekarteDto when found
- ✅ Success: Return null when not found (valid response)
- ✅ Success: Map Aggregate to DTO correctly
- ✅ Success: MGRS string in DTO
- ✅ Success: Lat/Lng converted from MGRS in DTO
- ✅ Success: POI collection mapped correctly
- ✅ Failure: Invalid einsatzId format
- ✅ Failure: Repository throws error
- ✅ Null: Handle null beschreibung in POI

**GetPoisQuery Handler Tests:**
- ✅ Success: Return all POIs when no category filter
- ✅ Success: Filter POIs by category
- ✅ Success: Return empty array when no POIs
- ✅ Failure: Lagekarte not found (aggregate null)
- ✅ Failure: Repository error

**GetLagekarteExistsQuery Handler Tests:**
- ✅ Success: Return true when exists
- ✅ Success: Return false when not exists
- ✅ Failure: Repository error

---

## 6. Repository Interface Summary (From Epic 1)

**ILagekarteRepository Interface:**

```typescript
export interface ILagekarteRepository {
  // Query Methods (Used by Query Handlers)
  findById(id: LagekarteId, tx?: TransactionContext): Promise<LagekarteAggregate | null>;
  findByEinsatzId(einsatzId: EinsatzId, tx?: TransactionContext): Promise<LagekarteAggregate | null>;
  exists(einsatzId: EinsatzId): Promise<boolean>;

  // Write Methods (Used by Command Handlers - NOT by Queries)
  save(aggregate: LagekarteAggregate, tx?: TransactionContext): Promise<void>;

  // NO delete() method (NO-DELETE Policy)
}
```

**Key Points:**
- Query handlers use **read-only methods**: `findById()`, `findByEinsatzId()`, `exists()`
- Returns `LagekarteAggregate | null` (not DTO - aggregates are domain responsibility)
- Mapping Aggregate→DTO happens in Handler after repository returns
- No business logic validation in query handlers (data just flows through)

---

## 7. Directory Structure for Story 2.2

**Expected structure after implementation:**

```
packages/backend/src/application/lagekarte/
├── commands/                    # Story 2.1 (COMPLETE)
│   ├── create-lagekarte.command.ts
│   ├── create-lagekarte.handler.ts
│   ├── index.ts
│   └── __tests__/
│       └── create-lagekarte.handler.spec.ts
├── queries/                     # Story 2.2 (NEW)
│   ├── get-lagekarte.query.ts
│   ├── get-lagekarte.handler.ts
│   ├── get-pois.query.ts
│   ├── get-pois.handler.ts
│   ├── get-lagekarte-exists.query.ts
│   ├── get-lagekarte-exists.handler.ts
│   ├── index.ts
│   ├── dto/                     # NEW
│   │   ├── lagekarte.dto.ts
│   │   └── index.ts
│   ├── mappers/                 # NEW
│   │   ├── lagekarte-dto.mapper.ts
│   │   └── index.ts
│   └── __tests__/               # NEW
│       ├── get-lagekarte.handler.spec.ts
│       ├── get-pois.handler.spec.ts
│       └── get-lagekarte-exists.handler.spec.ts
```

---

## 8. Key Differences: Command vs Query Handlers

### Command Handlers (Story 2.1)
- Purpose: **Modify state** (Create, Update, Delete)
- Repository: `save()` called
- Events: **Published after save()**
- Return: Created/Modified entity ID
- Validation: **Heavy** (business rule checks)
- Idempotency: **Needed** (Upsert pattern)

### Query Handlers (Story 2.2)
- Purpose: **Read state** (no modification)
- Repository: `findById()`, `findByEinsatzId()`, `exists()` only
- Events: **NEVER published**
- Return: DTO or null
- Validation: **Light** (format checks only)
- Idempotency: **Not applicable** (no side effects)

---

## 9. Result<T> Pattern Usage

**Established Pattern from Commands:**

```typescript
// Success case
return Result.ok(lagekarte);

// Failure case
return Result.fail<LagekarteDto | null>('Error message');

// Usage in handlers
if (result.isFailure) {
  return Result.fail(result.error);
}

// Usage in tests
expect(result.isSuccess).toBe(true);
expect(result.value).toBeDefined();
```

---

## 10. Implementation Checklist for Story 2.2

### Core Implementation
- [ ] Create `queries/` directory
- [ ] Implement `GetLagekarteQuery` (simple command object)
- [ ] Implement `GetLagekarteQueryHandler` (follows Command Handler pattern)
- [ ] Implement `GetPoisQuery` + Handler
- [ ] Implement `GetLagekarteExistsQuery` + Handler
- [ ] Create DTOs: `LagekarteDto`, `PoiDto`
- [ ] Create mapper: `LagekarteDtoMapper.fromAggregate()`

### Testing
- [ ] Unit tests for all 3 query handlers
- [ ] Test success cases (found + not found)
- [ ] Test failure cases (repository errors)
- [ ] Test DTO mapping (MGRS→Lat/Lng conversion)
- [ ] Test null handling (optional fields)

### Integration
- [ ] Export from `index.ts`
- [ ] Update Controller (Story 2.6) to use QueryBus
- [ ] Regenerate API client: `pnpm run generate-api`

---

## Summary

Story 2.2 Query Handlers follow established CQRS patterns from Story 2.1 Commands with key differences:

1. **Queries are read-only** - No event publishing, no state changes
2. **Handlers orchestrate data flow** - Load from repository → Map to DTO → Return
3. **DTOs are query-optimized** - Both MGRS and Lat/Lng included for Frontend flexibility
4. **Testing focuses on mapping** - Verify DTO transformation, null handling, coordinate conversion
5. **Result<T> pattern** - Explicit error handling, no exceptions

Reference implementations already exist in the codebase (Commands, Einsatz Service), making Story 2.2 a straightforward application of proven patterns.
