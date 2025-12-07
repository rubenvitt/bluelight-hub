import { GetLagekarteQueryHandler } from '../get-lagekarte.handler';
import { GetLagekarteQuery } from '../get-lagekarte.query';
import type { ILagekarteRepository } from '@domain/repositories';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { UserId } from '@domain/value-objects/user-id';
import { createValidTestId } from './helpers/test-id.helper';

// Mock cuid2 for deterministic test IDs
jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn(() => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'c';
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
 * Unit Tests für GetLagekarteQueryHandler.
 *
 * Testet Handler-Orchestration gemäß BDD Given-When-Then Pattern.
 * Nutzt jest.fn() für Repository-Mocks (NO NestJS Test Module).
 *
 * Coverage Target: >90%
 */
describe('GetLagekarteQueryHandler', () => {
  let handler: GetLagekarteQueryHandler;
  let mockRepo: jest.Mocked<ILagekarteRepository>;

  beforeEach(() => {
    // Create mock repository with all required methods
    mockRepo = {
      findByEinsatzId: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      exists: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    // Instantiate handler with mock (Direct Instantiation Pattern)
    handler = new GetLagekarteQueryHandler(mockRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should return DTO when Lagekarte found', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const einsatzIdVo = EinsatzId.create(einsatzId).value!;

      const userId = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzIdVo, userId).value!;

      mockRepo.findByEinsatzId.mockResolvedValue(aggregate);

      const query = new GetLagekarteQuery(einsatzId);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value).not.toBeNull();
      expect(result.value!.einsatzId).toBe(einsatzId);
      expect(result.value!.id).toBe(aggregate.id.value);
      expect(result.value!.pois).toBeInstanceOf(Array);
      expect(result.value!.pois.length).toBe(0);
      expect(result.value!.createdAt).toBeInstanceOf(Date);

      // Verify repository called with correct EinsatzId
      expect(mockRepo.findByEinsatzId).toHaveBeenCalledWith(expect.objectContaining({ value: einsatzId }));
      expect(mockRepo.findByEinsatzId).toHaveBeenCalledTimes(1);
    });

    it('should return null when Lagekarte not found (NOT error)', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      mockRepo.findByEinsatzId.mockResolvedValue(null);

      const query = new GetLagekarteQuery(einsatzId);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true); // ✅ Success with null!
      expect(result.value).toBeNull();
      expect(result.error).toBeUndefined();

      // Verify repository was called
      expect(mockRepo.findByEinsatzId).toHaveBeenCalledWith(expect.objectContaining({ value: einsatzId }));
      expect(mockRepo.findByEinsatzId).toHaveBeenCalledTimes(1);
    });

    it('should return DTO with POIs collection mapped correctly', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const einsatzIdVo = EinsatzId.create(einsatzId).value!;

      // Create Lagekarte
      const userId = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzIdVo, userId).value!;

      // Add POI via domain method
      const mgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777, 5).value!; // Berlin
      const category = PoiCategory.create('EINSATZSTELLE').value!;

      const poiResult = aggregate.addPoi('Brandenburger Tor', mgrs, category, userId);
      expect(poiResult.isSuccess).toBe(true);

      mockRepo.findByEinsatzId.mockResolvedValue(aggregate);

      const query = new GetLagekarteQuery(einsatzId);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.pois).toBeInstanceOf(Array);
      expect(result.value!.pois.length).toBe(1);

      // Verify POI DTO structure
      const poiDto = result.value!.pois[0];
      expect(poiDto.name).toBe('Brandenburger Tor');
      expect(poiDto.category).toBe('EINSATZSTELLE');
      expect(poiDto.coordinate).toBeDefined();

      // Verify MGRS coordinate in DTO
      expect(poiDto.coordinate.mgrs).toBeDefined();
      expect(poiDto.coordinate.mgrs).toContain('33UUU'); // Berlin MGRS zone

      // Verify Lat/Lng coordinate in DTO (converted from MGRS)
      expect(poiDto.coordinate.lat).toBeDefined();
      expect(poiDto.coordinate.lng).toBeDefined();
      expect(poiDto.coordinate.lat).toBeCloseTo(52.5163, 3); // Rounding tolerance
      expect(poiDto.coordinate.lng).toBeCloseTo(13.3777, 3);
    });

    it('should return DTO containing both MGRS and Lat/Lng coordinates for each POI', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const einsatzIdVo = EinsatzId.create(einsatzId).value!;

      const userId = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzIdVo, userId).value!;

      // Add multiple POIs with different coordinates
      const berlin = MgrsCoordinate.fromLatLng(52.5163, 13.3777, 5).value!;
      const hamburg = MgrsCoordinate.fromString('32UNE8934004990').value!; // Hamburg MGRS
      const category = PoiCategory.create('EINSATZSTELLE').value!;

      aggregate.addPoi('Berlin', berlin, category, userId);
      aggregate.addPoi('Hamburg', hamburg, category, userId);

      mockRepo.findByEinsatzId.mockResolvedValue(aggregate);

      const query = new GetLagekarteQuery(einsatzId);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.pois.length).toBe(2);

      // Verify each POI has both MGRS and Lat/Lng
      for (const poi of result.value!.pois) {
        expect(poi.coordinate.mgrs).toBeDefined();
        expect(poi.coordinate.lat).toBeDefined();
        expect(poi.coordinate.lng).toBeDefined();
        expect(typeof poi.coordinate.mgrs).toBe('string');
        expect(typeof poi.coordinate.lat).toBe('number');
        expect(typeof poi.coordinate.lng).toBe('number');
      }
    });
  });

  describe('Failure Cases', () => {
    it('should handle valid nanoid format as einsatzId', async () => {
      // Given: Query with valid nanoid format (21 URL-safe characters)
      const validNanoid = createValidTestId('test');
      const query = new GetLagekarteQuery(validNanoid);

      // Mock repository returns null (not found)
      mockRepo.findByEinsatzId.mockResolvedValue(null);

      // When
      const result = await handler.execute(query);

      // Then: Handler should work with any valid nanoid
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull(); // Lagekarte not found
    });

    it('should fail when repository throws error', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteQuery(einsatzId);

      // Mock: Repository throws error
      mockRepo.findByEinsatzId.mockRejectedValue(new Error('Database connection failed'));

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Failed to load Lagekarte');
      expect(result.value).toBeUndefined();

      // Verify repository was called
      expect(mockRepo.findByEinsatzId).toHaveBeenCalledTimes(1);
    });

    it('should fail when repository throws non-Error object', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteQuery(einsatzId);

      // Mock: Repository throws string
      mockRepo.findByEinsatzId.mockRejectedValue('String error');

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Failed to load Lagekarte');
    });
  });

  describe('Orchestration Verification', () => {
    it('should call repository.findByEinsatzId with correct EinsatzId', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteQuery(einsatzId);
      mockRepo.findByEinsatzId.mockResolvedValue(null);

      // When
      await handler.execute(query);

      // Then
      const call = mockRepo.findByEinsatzId.mock.calls[0][0];
      expect(call).toBeInstanceOf(EinsatzId);
      expect(call.value).toBe(einsatzId);
    });

    it('should NOT call save() method (read-only query)', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const einsatzIdVo = EinsatzId.create(einsatzId).value!;

      const userId = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzIdVo, userId).value!;

      mockRepo.findByEinsatzId.mockResolvedValue(aggregate);

      const query = new GetLagekarteQuery(einsatzId);

      // When
      await handler.execute(query);

      // Then: save() should NEVER be called (query is read-only)
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle Lagekarte with empty POIs array', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const einsatzIdVo = EinsatzId.create(einsatzId).value!;

      const userId = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzIdVo, userId).value!;

      mockRepo.findByEinsatzId.mockResolvedValue(aggregate);

      const query = new GetLagekarteQuery(einsatzId);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.pois).toEqual([]);
      expect(result.value!.pois.length).toBe(0);
    });

    it('should handle Lagekarte with many POIs', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const einsatzIdVo = EinsatzId.create(einsatzId).value!;

      const userId = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzIdVo, userId).value!;

      // Add 10 POIs
      const category = PoiCategory.create('EINSATZSTELLE').value!;

      for (let i = 0; i < 10; i++) {
        const lat = 52.5 + i * 0.01;
        const lng = 13.3 + i * 0.01;
        const mgrs = MgrsCoordinate.fromLatLng(lat, lng, 5).value!;
        aggregate.addPoi(`POI ${i}`, mgrs, category, userId);
      }

      mockRepo.findByEinsatzId.mockResolvedValue(aggregate);

      const query = new GetLagekarteQuery(einsatzId);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.pois.length).toBe(10);

      // Verify all POIs have correct structure
      result.value!.pois.forEach((poi, index) => {
        expect(poi.name).toBe(`POI ${index}`);
        expect(poi.coordinate.mgrs).toBeDefined();
        expect(poi.coordinate.lat).toBeDefined();
        expect(poi.coordinate.lng).toBeDefined();
      });
    });

    it('should handle einsatzId with all valid cuid2 characters', async () => {
      // Given
      const complexEinsatzId = 'clw3h8x9y0000qwertyuiazaz0'; // Valid CUID2 format
      const einsatzIdVo = EinsatzId.create(complexEinsatzId).value!;

      const userId = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzIdVo, userId).value!;

      mockRepo.findByEinsatzId.mockResolvedValue(aggregate);

      const query = new GetLagekarteQuery(complexEinsatzId);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.einsatzId).toBe(complexEinsatzId);
    });
  });
});
