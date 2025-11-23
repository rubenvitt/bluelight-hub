import { GetPoisQueryHandler } from '../../get-pois.handler';
import { GetPoisQuery } from '../../get-pois.query';
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
 * Integration Tests für GetPoisQueryHandler.
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
 * - ✅ POI-Filterung nach Kategorie (Domain Logic)
 * - ✅ MGRS → Lat/Lng Koordinatenkonvertierung
 * - ✅ Mapper → DTO Transformation mit echten Domain-Objekten
 * - ✅ Fehlerbehandlung (Lagekarte nicht gefunden = Fehler!)
 * - ✅ Kategorie-Validierung
 */
describe('GetPoisQueryHandler - Integration Tests', () => {
  let handler: GetPoisQueryHandler;
  let repository: InMemoryLagekarteRepository;

  beforeEach(() => {
    repository = new InMemoryLagekarteRepository();
    handler = new GetPoisQueryHandler(repository);
  });

  afterEach(() => {
    repository.clear();
  });

  /**
   * Test Helper: Erstellt ein Lagekarte-Aggregat mit mehreren POIs.
   *
   * @param einsatzId - Die Einsatz-ID
   * @returns Lagekarte mit 3 POIs (2 EINSATZSTELLE, 1 BEREITSTELLUNGSRAUM)
   */
  const createAggregateWithMixedPois = (einsatzId: EinsatzId): LagekarteAggregate => {
    const userId = UserId.create().value!;

    // POI 1: EINSATZSTELLE (Berlin)
    const poi1 = Poi.create('Einsatzstelle 1', MgrsCoordinate.fromString('33UUU8990317936').value!, PoiCategory.EINSATZSTELLE(), userId);

    const aggregate = LagekarteAggregate.create(einsatzId, userId, poi1).value!;

    // POI 2: EINSATZSTELLE (Hamburg - using valid 32U zone)
    const poi2Result = aggregate.addPoi('Einsatzstelle 2', MgrsCoordinate.fromString('32UPU1234567890').value!, PoiCategory.EINSATZSTELLE(), userId);
    if (poi2Result.isFailure) {
      throw new Error(`Failed to add POI 2: ${poi2Result.error}`);
    }

    // POI 3: BEREITSTELLUNGSRAUM (Munich) - Changed from SAMMELPLATZ to BEREITSTELLUNGSRAUM (valid category)
    const poi3Result = aggregate.addPoi('Bereitstellungsraum', MgrsCoordinate.fromString('33UUU1111122222').value!, PoiCategory.BEREITSTELLUNGSRAUM(), userId);
    if (poi3Result.isFailure) {
      throw new Error(`Failed to add POI 3: ${poi3Result.error}`);
    }

    return aggregate;
  };

  describe('Full Application → Domain → Repository Flow', () => {
    it('should load aggregate and filter POIs by category', async () => {
      // Given: Aggregate with 3 POIs (2 EINSATZSTELLE, 1 BEREITSTELLUNGSRAUM)
      const einsatzId = EinsatzId.create('clw3h8x9y0000qwertyuieins1').value!;

      const aggregate = createAggregateWithMixedPois(einsatzId);
      await repository.save(aggregate);

      // When: Query with category filter
      const query = new GetPoisQuery(aggregate.id.value, 'EINSATZSTELLE');
      const result = await handler.execute(query);

      // Then: Should return only EINSATZSTELLE POIs
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(2);
      expect(result.value!.every((p) => p.category === 'EINSATZSTELLE')).toBe(true);

      // Verify names
      const names = result.value!.map((p) => p.name);
      expect(names).toContain('Einsatzstelle 1');
      expect(names).toContain('Einsatzstelle 2');
      expect(names).not.toContain('Bereitstellungsraum');
    });

    it('should return all POIs when no category filter specified', async () => {
      // Given: Aggregate with 3 POIs of different categories
      const einsatzId = EinsatzId.create('clw3h8x9y0000qwertyuieins1').value!;

      const aggregate = createAggregateWithMixedPois(einsatzId);
      await repository.save(aggregate);

      // When: Query WITHOUT category filter
      const query = new GetPoisQuery(aggregate.id.value);
      const result = await handler.execute(query);

      // Then: Should return all 3 POIs
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(3);

      // Verify all categories are present
      const categories = result.value!.map((p) => p.category);
      expect(categories).toContain('EINSATZSTELLE');
      expect(categories).toContain('BEREITSTELLUNGSRAUM');
    });

    it('should return error when Lagekarte does not exist', async () => {
      // Given: Empty repository

      // When: Query non-existent Lagekarte
      const query = new GetPoisQuery('clw3h8x9y0000nonexistent01', 'EINSATZSTELLE');
      const result = await handler.execute(query);

      // Then: Should return Result.fail() (NOT null!)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Lagekarte not found');
    });

    it('should validate category and return error for invalid category', async () => {
      // Given: Aggregate stored in repository
      const einsatzId = EinsatzId.create('clw3h8x9y0000qwertyuieins1').value!;

      const aggregate = createAggregateWithMixedPois(einsatzId);
      await repository.save(aggregate);

      // When: Query with INVALID category
      const query = new GetPoisQuery(aggregate.id.value, 'INVALID_CATEGORY');
      const result = await handler.execute(query);

      // Then: Should return Result.fail() (category validation)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid category');
    });

    it('should return empty array when category filter matches no POIs', async () => {
      // Given: Aggregate with only EINSATZSTELLE POIs
      const einsatzId = EinsatzId.create('clw3h8x9y0000qwertyuieins1').value!;
      const userId = UserId.create().value!;

      const poi = Poi.create('Einsatzstelle', MgrsCoordinate.fromString('33UUU8990317936').value!, PoiCategory.EINSATZSTELLE(), userId);

      const aggregate = LagekarteAggregate.create(einsatzId, userId, poi).value!;
      await repository.save(aggregate);

      // When: Query with category GEFAHRENSTELLE (no POIs have this category)
      const query = new GetPoisQuery(aggregate.id.value, 'GEFAHRENSTELLE');
      const result = await handler.execute(query);

      // Then: Should return empty array (NOT error!)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(0);
    });

    it('should return empty array when Lagekarte has no POIs', async () => {
      // Given: Lagekarte WITHOUT POIs
      const einsatzId = EinsatzId.create('clw3h8x9y0000qwertyuieins1').value!;
      const userId = UserId.create().value!;

      // Create Lagekarte without initial POI
      const aggregate = LagekarteAggregate.create(einsatzId, userId).value!;
      await repository.save(aggregate);

      // When: Query all POIs
      const query = new GetPoisQuery(aggregate.id.value);
      const result = await handler.execute(query);

      // Then: Should return empty array (NOT error!)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(0);
    });

    it('should map POI coordinates (MGRS + Lat/Lng) correctly', async () => {
      // Given: Aggregate with POI in Berlin
      const einsatzId = EinsatzId.create('clw3h8x9y0000qwertyuieins1').value!;
      const userId = UserId.create().value!;

      const poi = Poi.create(
        'Brandenburger Tor',
        MgrsCoordinate.fromString('33UUU8990317936').value!, // Berlin MGRS
        PoiCategory.EINSATZSTELLE(),
        userId,
        'Historisches Wahrzeichen',
      );

      const aggregate = LagekarteAggregate.create(einsatzId, userId, poi).value!;
      await repository.save(aggregate);

      // When: Query POIs
      const query = new GetPoisQuery(aggregate.id.value);
      const result = await handler.execute(query);

      // Then: Should map coordinates correctly
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);

      const poiDto = result.value![0]!;
      expect(poiDto.name).toBe('Brandenburger Tor');
      expect(poiDto.coordinate.mgrs).toBe('33UUU8990317936');
      expect(poiDto.coordinate.lat).toBeCloseTo(52.52, 1); // Berlin latitude
      expect(poiDto.coordinate.lng).toBeCloseTo(13.405, 1); // Berlin longitude
      expect(poiDto.beschreibung).toBe('Historisches Wahrzeichen');
    });

    it('should validate LagekarteId format and return error for invalid ID', async () => {
      // Given: Invalid LagekarteId (too short)
      const invalidLagekarteId = 'invalid-id';

      // When: Execute query handler with invalid ID
      // Note: Query constructor validates format, so this throws
      expect(() => new GetPoisQuery(invalidLagekarteId)).toThrow();
    });
  });
});
