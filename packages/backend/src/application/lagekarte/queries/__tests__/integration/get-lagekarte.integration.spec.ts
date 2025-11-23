import { GetLagekarteQueryHandler } from '../../get-lagekarte.handler';
import { GetLagekarteQuery } from '../../get-lagekarte.query';
import { InMemoryLagekarteRepository } from './in-memory-lagekarte.repository';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { Poi } from '@domain/entities/poi.entity';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { UserId } from '@domain/value-objects/user-id';

// Mock cuid2 for deterministic test IDs (CUID2 format: 20-30 chars, lowercase a-z0-9, starts with letter)
jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn(() => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'c'; // CUID2 always starts with a letter
    for (let i = 0; i < 24; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
  isCuid: jest.fn((id: string) => {
    if (typeof id !== 'string') return false;
    if (id.length < 20 || id.length > 30) return false;
    return /^[a-z][a-z0-9]+$/.test(id);
  }),
}));

/**
 * Integration Tests für GetLagekarteQueryHandler.
 *
 * Diese Tests validieren den VOLLSTÄNDIGEN Flow:
 * Handler → Repository → Domain → Mapper → DTO
 *
 * **Unterschied zu Unit Tests:**
 * - Unit Tests: Verwenden jest.fn() Mocks für Repository (isoliert Handler)
 * - Integration Tests: Verwenden In-Memory Repository (testen vollen Flow)
 *
 * **Was wird getestet:**
 * - ✅ Application → Domain → Repository Integration
 * - ✅ Aggregate Reconstruction aus In-Memory Storage
 * - ✅ MGRS → Lat/Lng Koordinatenkonvertierung
 * - ✅ Mapper → DTO Transformation mit echten Domain-Objekten
 * - ✅ Null Handling (Lagekarte nicht gefunden)
 *
 * **Was wird NICHT getestet:**
 * - ❌ Prisma-spezifische Details (das ist Infrastruktur Layer)
 * - ❌ HTTP Controller Logik (das ist Presentation Layer)
 * - ❌ Database Connection/Performance (das ist E2E Testing)
 */
describe('GetLagekarteQueryHandler - Integration Tests', () => {
  let handler: GetLagekarteQueryHandler;
  let repository: InMemoryLagekarteRepository;

  beforeEach(() => {
    repository = new InMemoryLagekarteRepository();
    handler = new GetLagekarteQueryHandler(repository);
  });

  afterEach(() => {
    repository.clear();
  });

  describe('Full Application → Domain → Repository Flow', () => {
    it('should load aggregate from repository and map to DTO with MGRS + Lat/Lng', async () => {
      // Given: Real aggregate with POIs stored in repository
      const einsatzId = EinsatzId.create('clw3h8x9y0000qwertyuieins1').value!;
      const userId = UserId.create().value!;

      // Create POI with MGRS coordinate (Berlin)
      const poi = Poi.create(
        'Einsatzstelle',
        MgrsCoordinate.fromString('33UUU8990317936').value!, // Berlin MGRS
        PoiCategory.EINSATZSTELLE(),
        userId,
        'Test POI Beschreibung',
      );

      // Create aggregate with POI
      const aggregate = LagekarteAggregate.create(einsatzId, userId, poi).value!;

      await repository.save(aggregate);

      // When: Execute query handler
      const query = new GetLagekarteQuery(einsatzId.value);
      const result = await handler.execute(query);

      // Then: Should return DTO with both MGRS and Lat/Lng coordinates
      expect(result.isSuccess).toBe(true);
      expect(result.value).not.toBeNull();

      const dto = result.value!;
      expect(dto.id).toBe(aggregate.id.value); // Use actual generated ID
      expect(dto.einsatzId).toBe(einsatzId.value);
      expect(dto.pois).toHaveLength(1);

      // Verify POI mapping
      const poiDto = dto.pois[0];
      expect(poiDto.name).toBe('Einsatzstelle');
      expect(poiDto.coordinate.mgrs).toBe('33UUU8990317936');
      expect(poiDto.coordinate.lat).toBeCloseTo(52.52, 1); // Berlin latitude (±0.1 tolerance)
      expect(poiDto.coordinate.lng).toBeCloseTo(13.405, 1); // Berlin longitude (±0.1 tolerance)
      expect(poiDto.category).toBe('EINSATZSTELLE');
      expect(poiDto.beschreibung).toBe('Test POI Beschreibung');
    });

    it('should return null when Lagekarte does not exist (NOT error)', async () => {
      // Given: Empty repository
      const einsatzId = EinsatzId.create('clw3h8x9y0000qwertyuieins1').value!;

      // When: Execute query handler
      const query = new GetLagekarteQuery(einsatzId.value);
      const result = await handler.execute(query);

      // Then: Should return Result.ok(null)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should handle multiple POIs with different categories', async () => {
      // Given: Aggregate with 3 POIs of different categories
      const einsatzId = EinsatzId.create('clw3h8x9y0000qwertyuieins1').value!;
      const userId = UserId.create().value!;

      // Create POI 1: EINSATZSTELLE (Berlin)
      const poi1 = Poi.create(
        'Einsatzstelle',
        MgrsCoordinate.fromString('33UUU8990317936').value!, // Berlin MGRS
        PoiCategory.EINSATZSTELLE(),
        userId,
      );

      // Create aggregate with first POI
      const aggregate = LagekarteAggregate.create(einsatzId, userId, poi1).value!;

      // Add POI 2: BEREITSTELLUNGSRAUM (Different location in Berlin grid)
      const poi2Result = aggregate.addPoi(
        'Bereitstellungsraum',
        MgrsCoordinate.fromString('33UUU1234567890').value!, // Berlin MGRS
        PoiCategory.BEREITSTELLUNGSRAUM(),
        userId,
      );
      expect(poi2Result.isSuccess).toBe(true);

      // Add POI 3: GEFAHRENSTELLE (without beschreibung)
      const poi3Result = aggregate.addPoi(
        'Gefahrenstelle',
        MgrsCoordinate.fromString('33UUU1111122222').value!, // Berlin grid
        PoiCategory.GEFAHRENSTELLE(),
        userId,
        undefined, // No beschreibung
      );
      expect(poi3Result.isSuccess).toBe(true);

      await repository.save(aggregate);

      // When: Execute query handler
      const query = new GetLagekarteQuery(einsatzId.value);
      const result = await handler.execute(query);

      // Then: Should return DTO with all 3 POIs mapped correctly
      expect(result.isSuccess).toBe(true);
      expect(result.value).not.toBeNull();
      expect(result.value!.pois).toHaveLength(3);

      // Verify each POI category
      const categories = result.value!.pois.map((p) => p.category);
      expect(categories).toEqual(['EINSATZSTELLE', 'BEREITSTELLUNGSRAUM', 'GEFAHRENSTELLE']);

      // Verify optional field handling (beschreibung)
      // POI entities created without beschreibung should have undefined
      expect(result.value!.pois.every((p) => p.beschreibung === undefined)).toBe(true);
    });

    it('should handle POI with beschreibung field', async () => {
      // Given: Aggregate with POI that has beschreibung
      const einsatzId = EinsatzId.create('clw3h8x9y0000qwertyuieins1').value!;
      const userId = UserId.create().value!;

      const poi = Poi.create('Gefahrenstelle', MgrsCoordinate.fromString('33UUU8990317936').value!, PoiCategory.GEFAHRENSTELLE(), userId, 'Achtung: Überflutete Straße');

      const aggregate = LagekarteAggregate.create(einsatzId, userId, poi).value!;
      await repository.save(aggregate);

      // When: Execute query handler
      const query = new GetLagekarteQuery(einsatzId.value);
      const result = await handler.execute(query);

      // Then: Should include beschreibung in DTO
      expect(result.isSuccess).toBe(true);
      expect(result.value!.pois).toHaveLength(1);
      expect(result.value!.pois[0]?.beschreibung).toBe('Achtung: Überflutete Straße');
    });

    it('should validate EinsatzId format and return error for invalid ID', async () => {
      // Given: Invalid EinsatzId (too short)
      const invalidEinsatzId = 'invalid-id';

      // When: Execute query handler with invalid ID
      // Note: Query constructor validates format, so this throws
      expect(() => new GetLagekarteQuery(invalidEinsatzId)).toThrow();
    });
  });
});
