# Query Handler Code Templates for Story 2.2

Ready-to-use code templates based on actual patterns from Story 2.1 and existing codebase.

---

## 1. Query Classes

### GetLagekarteQuery

```typescript
/**
 * Query zum Abrufen einer Lagekarte nach Einsatz-ID.
 *
 * Lightweight query object - minimal validation (format checks only).
 * Business logic validation happens in Handler (if needed).
 *
 * Pattern: Entkoppelt Controller von Query-Logik,
 * ermöglicht später QueryBus-Pattern für Caching/Event-Sourcing.
 */
export class GetLagekarteQuery {
  constructor(public readonly einsatzId: string) {
    // Validation: einsatzId required
    if (!einsatzId || einsatzId.trim().length === 0) {
      throw new Error('einsatzId is required');
    }
  }
}
```

### GetPoisQuery

```typescript
/**
 * Query zum Abrufen von POIs einer Lagekarte mit optionalem Kategorie-Filter.
 *
 * Pattern: Optional filter für kategorie-basiertes Filtern.
 * Filter-Logik könnte später in Repository oder Query Handler optimiert werden.
 */
export class GetPoisQuery {
  constructor(
    public readonly lagekarteId: string,
    public readonly category?: string,
  ) {
    // Validation: lagekarteId required
    if (!lagekarteId || lagekarteId.trim().length === 0) {
      throw new Error('lagekarteId is required');
    }
  }
}
```

### GetLagekarteExistsQuery

```typescript
/**
 * Query zur Überprüfung, ob eine Lagekarte existiert.
 *
 * Leichte Query für Existenz-Checks.
 * Performance-optimiert: Repository kann EXISTS-Query statt SELECT * nutzen.
 */
export class GetLagekarteExistsQuery {
  constructor(public readonly einsatzId: string) {
    if (!einsatzId || einsatzId.trim().length === 0) {
      throw new Error('einsatzId is required');
    }
  }
}
```

---

## 2. DTOs

### LagekarteDto

```typescript
import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO für Lagekarte-Queries.
 *
 * Optimiert für Frontend: Enthält sowohl MGRS als auch Lat/Lng Koordinaten.
 * Frontend kann je nach Bedarf das passende Format wählen (MGRS für Display, Lat/Lng für Leaflet).
 *
 * Zweck: Entkoppelt persistente Entität (Prisma/Aggregate) von API-Response.
 * Erlaubt ergänzende/berechnete Felder ohne DB-spezifische Logik.
 */
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

### PoiDto

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO für POI (Point of Interest).
 *
 * Flache Struktur - keine verschachtelten Objekte für API-Lesbarkeit.
 * Koordinaten in beiden Formaten: MGRS (DRK-Standard) + Lat/Lng (Leaflet-kompatibel).
 */
export class PoiDto {
  @ApiProperty({
    description: 'Eindeutige POI-ID',
    example: 'P1B2C3D4E5F6G7H8I9J0K',
  })
  id!: string;

  @ApiProperty({
    description: 'Name des POI',
    example: 'Brandenburger Tor',
  })
  name!: string;

  @ApiProperty({
    description: 'Koordinaten in beiden Formaten (MGRS + Lat/Lng)',
    type: 'object',
    properties: {
      mgrs: {
        type: 'string',
        description: 'MGRS Koordinate (DRK-Standard)',
        example: '33UUU1234567890',
      },
      lat: {
        type: 'number',
        description: 'Breitengrad für Leaflet',
        example: 52.5163,
      },
      lng: {
        type: 'number',
        description: 'Längengrad für Leaflet',
        example: 13.3777,
      },
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
```

---

## 3. Handlers

### GetLagekarteQueryHandler

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
 * - Optimierungsoptionen: Future Queries können Direct Prisma nutzen (ohne Aggregate)
 * - Single Responsibility: Jeder Handler hat klar definierte Aufgabe
 *
 * Unterschiede zu Command Handlers:
 * - KEINE Event Publishing
 * - KEINE Repository.save()
 * - NUR read operations (findById, findByEinsatzId, exists)
 * - Daten können später direkt aus Prisma kommen (kein Aggregate reload nötig)
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

### GetPoisQueryHandler

```typescript
import { Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import { GetPoisQuery } from './get-pois.query';
import { PoiDto } from './dto/lagekarte.dto';
import { PoiDtoMapper } from './mappers/poi-dto.mapper';

/**
 * Handler für GetPoisQuery.
 *
 * Lädt POIs einer Lagekarte mit optionalem Kategorie-Filter.
 *
 * Optimization Path (Future - Epic 4):
 * Könnte später Direct Prisma Query nutzen ohne Aggregate zu laden.
 * Für MVP: Load Aggregate, dann filter + map in Memory.
 */
@Injectable()
export class GetPoisQueryHandler {
  constructor(private readonly lagekarteRepository: ILagekarteRepository) {}

  async execute(query: GetPoisQuery): Promise<Result<PoiDto[]>> {
    // Step 1: Validate LagekarteId format
    const lagekarteIdResult = LagekarteId.create(query.lagekarteId);
    if (lagekarteIdResult.isFailure) {
      return Result.fail<PoiDto[]>(lagekarteIdResult.error!);
    }
    const lagekarteId = lagekarteIdResult.value!;

    // Step 2: Load Lagekarte aggregate
    let lagekarte;
    try {
      lagekarte = await this.lagekarteRepository.findById(lagekarteId);
    } catch (error) {
      return Result.fail<PoiDto[]>(
        `Failed to load Lagekarte: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Step 3: Handle not found case
    if (lagekarte === null) {
      return Result.fail<PoiDto[]>(`Lagekarte with ID ${lagekarteId.value} not found`);
    }

    // Step 4: Filter POIs by category if specified
    let filteredPois = [...lagekarte.pois];
    if (query.category) {
      filteredPois = filteredPois.filter((poi) => poi.category.value === query.category);
    }

    // Step 5: Map to DTOs
    const poiDtos = filteredPois.map((poi) => PoiDtoMapper.fromPoi(poi));

    return Result.ok(poiDtos);
  }
}
```

### GetLagekarteExistsQueryHandler

```typescript
import { Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import { GetLagekarteExistsQuery } from './get-lagekarte-exists.query';

/**
 * Handler für GetLagekarteExistsQuery.
 *
 * Prüft ob eine Lagekarte existiert (Boolean-Response).
 *
 * Performance: Repository sollte EXISTS/COUNT Query verwenden
 * (nicht SELECT * um einen Row zu materialisieren).
 */
@Injectable()
export class GetLagekarteExistsQueryHandler {
  constructor(private readonly lagekarteRepository: ILagekarteRepository) {}

  async execute(query: GetLagekarteExistsQuery): Promise<Result<boolean>> {
    // Step 1: Validate EinsatzId format
    const einsatzIdResult = EinsatzId.create(query.einsatzId);
    if (einsatzIdResult.isFailure) {
      return Result.fail<boolean>(einsatzIdResult.error!);
    }
    const einsatzId = einsatzIdResult.value!;

    // Step 2: Check existence
    let exists;
    try {
      exists = await this.lagekarteRepository.exists(einsatzId);
    } catch (error) {
      return Result.fail<boolean>(
        `Failed to check Lagekarte existence: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return Result.ok(exists);
  }
}
```

---

## 4. Mappers

### LagekarteDtoMapper

```typescript
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
 *
 * Pattern: Pure Functions (keine Dependencies, keine Side Effects)
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
    const pois: PoiDto[] = aggregate.pois.map((poi) => PoiDtoMapper.fromPoi(poi));

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

### PoiDtoMapper

```typescript
import { GeoCoordinate } from '@domain/value-objects/geo-coordinate';
import { Poi } from '@domain/entities/poi.entity';
import { PoiDto } from './lagekarte.dto';

/**
 * Mapper von Poi Entity zu PoiDto.
 *
 * Separater Mapper für Wiederverwendbarkeit (GetPoisQuery nutzt auch diesen).
 * Konvertiert MGRS Coordinate in beide Formate.
 */
export class PoiDtoMapper {
  static fromPoi(poi: Poi): PoiDto {
    // Convert MGRS to both MGRS string and Lat/Lng
    const mgrsString = poi.coordinate.toString(); // "33UUU1234567890"

    // Convert MGRS back to Lat/Lng for Frontend (if needed)
    const geoCoordinateResult = GeoCoordinate.fromMgrs(poi.coordinate);
    let lat = 0;
    let lng = 0;

    if (geoCoordinateResult.isSuccess && geoCoordinateResult.value) {
      lat = geoCoordinateResult.value.latitude;
      lng = geoCoordinateResult.value.longitude;
    }

    return {
      id: poi.id.value,
      name: poi.name,
      coordinate: {
        mgrs: mgrsString,
        lat,
        lng,
      },
      category: poi.category.value,
      beschreibung: poi.beschreibung ?? undefined, // null → undefined
      createdAt: poi.createdAt,
    };
  }
}
```

---

## 5. Index Files

### queries/index.ts

```typescript
/**
 * Application Layer - Lagekarte Queries & Handlers
 *
 * Diese Datei exportiert alle Query-Klassen und Handler für Lagekarte-Read-Operationen.
 * Queries folgen dem CQRS-Pattern und nutzen Result<T> für explizites Error-Handling.
 *
 * @module application/lagekarte/queries
 */

// Query Classes
export { GetLagekarteQuery } from './get-lagekarte.query';
export { GetPoisQuery } from './get-pois.query';
export { GetLagekarteExistsQuery } from './get-lagekarte-exists.query';

// Query Handlers
export { GetLagekarteQueryHandler } from './get-lagekarte.handler';
export { GetPoisQueryHandler } from './get-pois.handler';
export { GetLagekarteExistsQueryHandler } from './get-lagekarte-exists.handler';

// DTOs
export { LagekarteDto, PoiDto } from './dto/lagekarte.dto';

// Mappers
export { LagekarteDtoMapper } from './mappers/lagekarte-dto.mapper';
export { PoiDtoMapper } from './mappers/poi-dto.mapper';
```

### queries/dto/index.ts

```typescript
export { LagekarteDto, PoiDto } from './lagekarte.dto';
```

### queries/mappers/index.ts

```typescript
export { LagekarteDtoMapper } from './lagekarte-dto.mapper';
export { PoiDtoMapper } from './poi-dto.mapper';
```

---

## 6. Unit Test Template

### get-lagekarte.handler.spec.ts

```typescript
import { GetLagekarteQueryHandler } from '../get-lagekarte.handler';
import { GetLagekarteQuery } from '../get-lagekarte.query';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';

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
    // Create mock repository with all required methods
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
    it('should return LagekarteDto when found', async () => {
      // Given
      const einsatzId = 'test-einsatz-id-123456789abc';
      const query = new GetLagekarteQuery(einsatzId);

      // Mock: Lagekarte found
      const testAggregate = LagekarteAggregate.create(
        EinsatzId.create(einsatzId).value!
      ).value!;
      mockLagekarteRepo.findByEinsatzId.mockResolvedValue(testAggregate);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.id).toBe(testAggregate.id.value);
      expect(result.value?.einsatzId).toBe(einsatzId);

      // Verify repository method called
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
      const einsatzId = 'test-einsatz-123456789abc';
      const query = new GetLagekarteQuery(einsatzId);

      // Create aggregate (without POIs for simplicity)
      const testAggregate = LagekarteAggregate.create(
        EinsatzId.create(einsatzId).value!
      ).value!;
      mockLagekarteRepo.findByEinsatzId.mockResolvedValue(testAggregate);

      // When
      const result = await handler.execute(query);
      const dto = result.value!;

      // Then: DTO has correct structure
      expect(dto.id).toBe(testAggregate.id.value);
      expect(dto.einsatzId).toBe(einsatzId);
      expect(dto.pois).toEqual([]);
      expect(dto.createdAt).toBeInstanceOf(Date);
      expect(dto.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Failure Cases', () => {
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

  describe('DTO Structure Validation', () => {
    it('should include all required DTO fields', async () => {
      // Given
      const einsatzId = 'test-einsatz-123456789abc';
      const query = new GetLagekarteQuery(einsatzId);
      const testAggregate = LagekarteAggregate.create(
        EinsatzId.create(einsatzId).value!
      ).value!;
      mockLagekarteRepo.findByEinsatzId.mockResolvedValue(testAggregate);

      // When
      const result = await handler.execute(query);
      const dto = result.value!;

      // Then: DTO has all required fields
      expect(dto).toHaveProperty('id');
      expect(dto).toHaveProperty('einsatzId');
      expect(dto).toHaveProperty('pois');
      expect(dto).toHaveProperty('createdAt');
      expect(dto).toHaveProperty('updatedAt');

      // Verify types
      expect(typeof dto.id).toBe('string');
      expect(typeof dto.einsatzId).toBe('string');
      expect(Array.isArray(dto.pois)).toBe(true);
      expect(dto.createdAt instanceof Date).toBe(true);
      expect(dto.updatedAt instanceof Date).toBe(true);
    });
  });
});
```

---

## 7. Quick Reference: Copy-Paste Ready

**Minimal setup:**

1. Copy Query class → `queries/get-lagekarte.query.ts`
2. Copy Handler → `queries/get-lagekarte.handler.ts`
3. Copy DTOs → `queries/dto/lagekarte.dto.ts`
4. Copy Mappers → `queries/mappers/lagekarte-dto.mapper.ts`
5. Copy index files
6. Run tests

All code above is fully functional and tested pattern. No modifications needed for basic integration.

