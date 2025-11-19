import { GetPoisQueryHandler } from '../get-pois.handler';
import { GetPoisQuery } from '../get-pois.query';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { UserId } from '@domain/value-objects/user-id';

// Mock nanoid for deterministic test IDs
jest.mock('nanoid/non-secure', () => ({
  nanoid: jest.fn((length?: number) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    const targetLength = length || 21;
    let result = '';
    for (let i = 0; i < targetLength; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
}));

/**
 * Helper function: Generates valid 21-character nanoid for testing.
 */
function createValidTestId(prefix = 'test'): string {
  const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let id = prefix;
  while (id.length < 21) {
    id += validChars.charAt(Math.floor(Math.random() * validChars.length));
  }
  return id.substring(0, 21);
}

/**
 * Unit Tests für GetPoisQueryHandler.
 *
 * Testet Handler-Orchestration gemäß BDD Given-When-Then Pattern.
 * Nutzt jest.fn() für Repository-Mocks (NO NestJS Test Module).
 *
 * Coverage Target: >90%
 */
describe('GetPoisQueryHandler', () => {
  let handler: GetPoisQueryHandler;
  let mockRepo: jest.Mocked<ILagekarteRepository>;

  beforeEach(() => {
    // Create mock repository with all required methods
    mockRepo = {
      findById: jest.fn(),
      save: jest.fn(),
      findByEinsatzId: jest.fn(),
      exists: jest.fn(),
    } as any;

    // Instantiate handler with mock (Direct Instantiation Pattern)
    handler = new GetPoisQueryHandler(mockRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should return all POIs when no category filter', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzIdVo = EinsatzId.create(createValidTestId('einsatz')).value!;

      const aggregate = LagekarteAggregate.create(einsatzIdVo).value!;

      // Add multiple POIs with different categories
      const berlin = MgrsCoordinate.fromLatLng(52.5163, 13.3777, 5).value!;
      const hamburg = MgrsCoordinate.fromString('32UNE8934004990').value!;
      const einsatzstelle = PoiCategory.create('EINSATZSTELLE').value!;
      const bereitstellungsraum = PoiCategory.create('BEREITSTELLUNGSRAUM').value!;
      const userId = UserId.create().value!;

      aggregate.addPoi('Einsatzstelle Berlin', berlin, einsatzstelle, userId);
      aggregate.addPoi('Bereitstellungsraum Hamburg', hamburg, bereitstellungsraum, userId);

      mockRepo.findById.mockResolvedValue(aggregate);

      const query = new GetPoisQuery(lagekarteId);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.length).toBe(2);

      // Verify both POIs are in result
      const poiNames = result.value!.map((p) => p.name);
      expect(poiNames).toContain('Einsatzstelle Berlin');
      expect(poiNames).toContain('Bereitstellungsraum Hamburg');

      // Verify repository called with correct LagekarteId
      expect(mockRepo.findById).toHaveBeenCalledWith(expect.objectContaining({ value: lagekarteId }));
      expect(mockRepo.findById).toHaveBeenCalledTimes(1);
    });

    it('should filter POIs by category when specified', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzIdVo = EinsatzId.create(createValidTestId('einsatz')).value!;

      const aggregate = LagekarteAggregate.create(einsatzIdVo).value!;

      // Add multiple POIs with different categories
      const berlin = MgrsCoordinate.fromLatLng(52.5163, 13.3777, 5).value!;
      const hamburg = MgrsCoordinate.fromString('32UNE8934004990').value!;
      const munich = MgrsCoordinate.fromLatLng(48.1351, 11.582, 5).value!;
      const einsatzstelle = PoiCategory.create('EINSATZSTELLE').value!;
      const bereitstellungsraum = PoiCategory.create('BEREITSTELLUNGSRAUM').value!;
      const userId = UserId.create().value!;

      aggregate.addPoi('Einsatzstelle 1', berlin, einsatzstelle, userId);
      aggregate.addPoi('Bereitstellungsraum 1', hamburg, bereitstellungsraum, userId);
      aggregate.addPoi('Einsatzstelle 2', munich, einsatzstelle, userId);

      mockRepo.findById.mockResolvedValue(aggregate);

      const query = new GetPoisQuery(lagekarteId, 'EINSATZSTELLE');

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.length).toBe(2);

      // Verify only EINSATZSTELLE POIs are returned
      result.value!.forEach((poi) => {
        expect(poi.category).toBe('EINSATZSTELLE');
      });

      const poiNames = result.value!.map((p) => p.name);
      expect(poiNames).toContain('Einsatzstelle 1');
      expect(poiNames).toContain('Einsatzstelle 2');
      expect(poiNames).not.toContain('Bereitstellungsraum 1');
    });

    it('should return empty array when no POIs match category filter', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzIdVo = EinsatzId.create(createValidTestId('einsatz')).value!;

      const aggregate = LagekarteAggregate.create(einsatzIdVo).value!;

      // Add POIs with different category
      const berlin = MgrsCoordinate.fromLatLng(52.5163, 13.3777, 5).value!;
      const einsatzstelle = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = UserId.create().value!;

      aggregate.addPoi('Einsatzstelle Berlin', berlin, einsatzstelle, userId);

      mockRepo.findById.mockResolvedValue(aggregate);

      // Query for GEFAHRENSTELLE (not present)
      const query = new GetPoisQuery(lagekarteId, 'GEFAHRENSTELLE');

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
      expect(result.value!.length).toBe(0);
    });

    it('should return empty array when Lagekarte has no POIs', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzIdVo = EinsatzId.create(createValidTestId('einsatz')).value!;

      const aggregate = LagekarteAggregate.create(einsatzIdVo).value!;
      // No POIs added

      mockRepo.findById.mockResolvedValue(aggregate);

      const query = new GetPoisQuery(lagekarteId);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
      expect(result.value!.length).toBe(0);
    });

    it('should return DTOs with both MGRS and Lat/Lng coordinates', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzIdVo = EinsatzId.create(createValidTestId('einsatz')).value!;

      const aggregate = LagekarteAggregate.create(einsatzIdVo).value!;

      // Add POI with MGRS
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777, 5).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = UserId.create().value!;

      aggregate.addPoi('Brandenburger Tor', berlinMgrs, category, userId);

      mockRepo.findById.mockResolvedValue(aggregate);

      const query = new GetPoisQuery(lagekarteId);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.length).toBe(1);

      const poiDto = result.value![0];
      expect(poiDto.name).toBe('Brandenburger Tor');
      expect(poiDto.category).toBe('EINSATZSTELLE');
      expect(poiDto.coordinate).toBeDefined();

      // Verify MGRS coordinate
      expect(poiDto.coordinate.mgrs).toBeDefined();
      expect(poiDto.coordinate.mgrs).toContain('33UUU'); // Berlin MGRS zone

      // Verify Lat/Lng coordinate (converted from MGRS)
      expect(poiDto.coordinate.lat).toBeDefined();
      expect(poiDto.coordinate.lng).toBeDefined();
      expect(poiDto.coordinate.lat).toBeCloseTo(52.5163, 3);
      expect(poiDto.coordinate.lng).toBeCloseTo(13.3777, 3);
    });

    it('should return DTOs with beschreibung when present', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzIdVo = EinsatzId.create(createValidTestId('einsatz')).value!;

      const aggregate = LagekarteAggregate.create(einsatzIdVo).value!;

      const berlin = MgrsCoordinate.fromLatLng(52.5163, 13.3777, 5).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = UserId.create().value!;

      aggregate.addPoi('Einsatzort', berlin, category, userId, 'Rauchentwicklung im 2. OG');

      mockRepo.findById.mockResolvedValue(aggregate);

      const query = new GetPoisQuery(lagekarteId);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].beschreibung).toBe('Rauchentwicklung im 2. OG');
    });

    it('should filter by multiple different categories independently', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzIdVo = EinsatzId.create(createValidTestId('einsatz')).value!;

      const aggregate = LagekarteAggregate.create(einsatzIdVo).value!;

      const coord = MgrsCoordinate.fromLatLng(52.5163, 13.3777, 5).value!;
      const userId = UserId.create().value!;

      aggregate.addPoi('POI1', coord, PoiCategory.EINSATZSTELLE(), userId);
      aggregate.addPoi('POI2', coord, PoiCategory.BEREITSTELLUNGSRAUM(), userId);
      aggregate.addPoi('POI3', coord, PoiCategory.GEFAHRENSTELLE(), userId);
      aggregate.addPoi('POI4', coord, PoiCategory.EINSATZSTELLE(), userId);

      mockRepo.findById.mockResolvedValue(aggregate);

      // When - Query EINSATZSTELLE
      const result1 = await handler.execute(new GetPoisQuery(lagekarteId, 'EINSATZSTELLE'));

      // Then
      expect(result1.value!.length).toBe(2);
      expect(result1.value!.every((p) => p.category === 'EINSATZSTELLE')).toBe(true);

      // When - Query BEREITSTELLUNGSRAUM
      const result2 = await handler.execute(new GetPoisQuery(lagekarteId, 'BEREITSTELLUNGSRAUM'));

      // Then
      expect(result2.value!.length).toBe(1);
      expect(result2.value![0].category).toBe('BEREITSTELLUNGSRAUM');

      // When - Query GEFAHRENSTELLE
      const result3 = await handler.execute(new GetPoisQuery(lagekarteId, 'GEFAHRENSTELLE'));

      // Then
      expect(result3.value!.length).toBe(1);
      expect(result3.value![0].category).toBe('GEFAHRENSTELLE');
    });
  });

  describe('Failure Cases', () => {
    it('should fail when Lagekarte not found', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const query = new GetPoisQuery(lagekarteId);

      // Mock: Repository returns null
      mockRepo.findById.mockResolvedValue(null);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Lagekarte not found');
      expect(result.value).toBeUndefined();

      // Verify repository was called
      expect(mockRepo.findById).toHaveBeenCalledWith(expect.objectContaining({ value: lagekarteId }));
      expect(mockRepo.findById).toHaveBeenCalledTimes(1);
    });

    it('should fail when repository throws error', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const query = new GetPoisQuery(lagekarteId);

      // Mock: Repository throws error
      mockRepo.findById.mockRejectedValue(new Error('Database connection failed'));

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Failed to load POIs');
      expect(result.value).toBeUndefined();

      // Verify repository was called
      expect(mockRepo.findById).toHaveBeenCalledTimes(1);
    });

    it('should fail when repository throws non-Error object', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const query = new GetPoisQuery(lagekarteId);

      // Mock: Repository throws string
      mockRepo.findById.mockRejectedValue('String error');

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Failed to load POIs');
    });

    it('should fail when LagekarteId is invalid', async () => {
      // Given
      const invalidLagekarteId = 'invalid'; // Too short (< 21 chars)
      const query = new GetPoisQuery(invalidLagekarteId);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBeDefined();
      // LagekarteId.create() will fail with validation error
    });
  });

  describe('Orchestration Verification', () => {
    it('should call repository.findById with correct LagekarteId', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const query = new GetPoisQuery(lagekarteId);
      mockRepo.findById.mockResolvedValue(null);

      // When
      await handler.execute(query);

      // Then
      const call = mockRepo.findById.mock.calls[0][0];
      expect(call).toBeInstanceOf(LagekarteId);
      expect(call.value).toBe(lagekarteId);
    });

    it('should NOT call save() method (read-only query)', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzIdVo = EinsatzId.create(createValidTestId('einsatz')).value!;

      const aggregate = LagekarteAggregate.create(einsatzIdVo).value!;

      mockRepo.findById.mockResolvedValue(aggregate);

      const query = new GetPoisQuery(lagekarteId);

      // When
      await handler.execute(query);

      // Then: save() should NEVER be called (query is read-only)
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should NOT mutate aggregate POIs array', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzIdVo = EinsatzId.create(createValidTestId('einsatz')).value!;

      const aggregate = LagekarteAggregate.create(einsatzIdVo).value!;

      const coord = MgrsCoordinate.fromLatLng(52.5163, 13.3777, 5).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = UserId.create().value!;

      aggregate.addPoi('POI1', coord, category, userId);
      aggregate.addPoi('POI2', coord, PoiCategory.BEREITSTELLUNGSRAUM(), userId);

      const originalPoisCount = aggregate.pois.length;

      mockRepo.findById.mockResolvedValue(aggregate);

      // When - Query with category filter
      await handler.execute(new GetPoisQuery(lagekarteId, 'EINSATZSTELLE'));

      // Then - Aggregate should still have all POIs
      expect(aggregate.pois.length).toBe(originalPoisCount);
    });
  });

  describe('Edge Cases', () => {
    it('should handle Lagekarte with many POIs', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzIdVo = EinsatzId.create(createValidTestId('einsatz')).value!;

      const aggregate = LagekarteAggregate.create(einsatzIdVo).value!;

      // Add 20 POIs
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = UserId.create().value!;

      for (let i = 0; i < 20; i++) {
        const lat = 52.5 + i * 0.01;
        const lng = 13.3 + i * 0.01;
        const mgrs = MgrsCoordinate.fromLatLng(lat, lng, 5).value!;
        aggregate.addPoi(`POI ${i}`, mgrs, category, userId);
      }

      mockRepo.findById.mockResolvedValue(aggregate);

      const query = new GetPoisQuery(lagekarteId);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.length).toBe(20);

      // Verify all POIs have correct structure
      result.value!.forEach((poi, index) => {
        expect(poi.name).toBe(`POI ${index}`);
        expect(poi.coordinate.mgrs).toBeDefined();
        expect(poi.coordinate.lat).toBeDefined();
        expect(poi.coordinate.lng).toBeDefined();
      });
    });

    it('should handle lagekarteId with all valid nanoid characters', async () => {
      // Given
      const complexLagekarteId = 'AZaz09_-0123456789XYZ'; // All valid chars
      const einsatzIdVo = EinsatzId.create(createValidTestId('einsatz')).value!;

      const aggregate = LagekarteAggregate.create(einsatzIdVo).value!;

      mockRepo.findById.mockResolvedValue(aggregate);

      const query = new GetPoisQuery(complexLagekarteId);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
    });

    it('should handle category filter that matches no POIs in non-empty Lagekarte', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzIdVo = EinsatzId.create(createValidTestId('einsatz')).value!;

      const aggregate = LagekarteAggregate.create(einsatzIdVo).value!;

      const coord = MgrsCoordinate.fromLatLng(52.5163, 13.3777, 5).value!;
      const userId = UserId.create().value!;

      // Add only EINSATZSTELLE POIs
      aggregate.addPoi('POI1', coord, PoiCategory.EINSATZSTELLE(), userId);
      aggregate.addPoi('POI2', coord, PoiCategory.EINSATZSTELLE(), userId);

      mockRepo.findById.mockResolvedValue(aggregate);

      // Query for WASSERENTNAHMESTELLE (not present)
      const query = new GetPoisQuery(lagekarteId, 'WASSERENTNAHMESTELLE');

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
    });

    it('should handle case-sensitive category filtering', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzIdVo = EinsatzId.create(createValidTestId('einsatz')).value!;

      const aggregate = LagekarteAggregate.create(einsatzIdVo).value!;

      const coord = MgrsCoordinate.fromLatLng(52.5163, 13.3777, 5).value!;
      const userId = UserId.create().value!;

      aggregate.addPoi('POI1', coord, PoiCategory.EINSATZSTELLE(), userId);

      mockRepo.findById.mockResolvedValue(aggregate);

      // Query with lowercase (should NOT match)
      const query = new GetPoisQuery(lagekarteId, 'einsatzstelle');

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]); // No match due to case sensitivity
    });
  });
});
