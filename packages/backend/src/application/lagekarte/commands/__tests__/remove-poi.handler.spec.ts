// biome-ignore-all lint/suspicious/noExplicitAny: Test mocks and type casting
import { RemovePoiCommandHandler } from '../remove-poi.handler';
import { RemovePoiCommand } from '../remove-poi.command';
import type { ILagekarteRepository } from '@domain/repositories';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { UserId } from '@domain/value-objects/user-id';

// Mock CUID2 for deterministic test IDs
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
    // CUID2 Format: lowercase a-z and 0-9 only, starts with letter
    // Nanoid/CUID Format (für UserId): mixed case alphanumeric + underscore/hyphen
    // Wir akzeptieren beide Formate für Kompatibilität
    return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id);
  }),
}));

/**
 * Helper function: Generates valid CUID2-format IDs for testing.
 * CUID2 format: lowercase alphanumeric, starts with 'c', 25 chars total.
 */
function generateTestCuid(suffix = ''): string {
  const base = 'clw3h8x9y0000qwertyu';
  const padding = suffix.padEnd(5, '0').slice(0, 5);
  return base + padding;
}

/**
 * Unit Tests für RemovePoiCommandHandler.
 *
 * Testet Handler-Orchestration gemäß BDD Given-When-Then Pattern.
 * Nutzt jest.fn() für Repository-Mocks (NO NestJS Test Module).
 *
 * Coverage Target: >90%
 * Testing Framework: Jest 30.2.0 mit @swc/jest
 */
describe('RemovePoiCommandHandler', () => {
  let handler: RemovePoiCommandHandler;
  let mockLagekarteRepo: jest.Mocked<ILagekarteRepository>;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;

  beforeEach(() => {
    // Create mock repository with all required methods
    mockLagekarteRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEinsatzId: jest.fn(),
      exists: jest.fn(),
    } as any;

    mockEventPublisher = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    } as any;

    // Instantiate handler with mocks (Direct Instantiation Pattern)
    handler = new RemovePoiCommandHandler(mockLagekarteRepo, mockEventPublisher);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should remove POI and return void success', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkart');
      const einsatzId = EinsatzId.create(generateTestCuid('einsz')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add POI to aggregate
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = LagekarteId.create(lagekarteId).value!;
      const addResult = aggregate.addPoi('Test POI', berlinMgrs, category, userId as any);
      const poiId = addResult.value!.id;

      const command = RemovePoiCommand.create(lagekarteId, poiId.value).value!;

      // Mock: Lagekarte exists with POI
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeUndefined(); // void success

      // Verify POI was removed
      const savedAggregate = mockLagekarteRepo.save.mock.calls[0][0];
      expect(savedAggregate.pois.length).toBe(0);
    });

    it('should verify hard delete - POI not in aggregate after removal', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkrt3');
      const einsatzId = EinsatzId.create(generateTestCuid('eins3')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add POI to aggregate
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = LagekarteId.create(lagekarteId).value!;
      const addResult = aggregate.addPoi('Test POI', berlinMgrs, category, userId as any);
      const poiId = addResult.value!.id;

      const initialPoiCount = aggregate.pois.length;
      expect(initialPoiCount).toBe(1);

      const command = RemovePoiCommand.create(lagekarteId, poiId.value).value!;

      // Mock: Lagekarte exists with POI
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);

      // Verify hard delete: POI count decreased
      const savedAggregate = mockLagekarteRepo.save.mock.calls[0][0];
      expect(savedAggregate.pois.length).toBe(initialPoiCount - 1);
      expect(savedAggregate.pois.length).toBe(0);

      // Verify POI is NOT in aggregate anymore
      const poiExists = savedAggregate.pois.some((poi) => poi.id.equals(poiId));
      expect(poiExists).toBe(false);
    });

    it('should remove correct POI when multiple POIs exist', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkrt4');
      const einsatzId = EinsatzId.create(generateTestCuid('eins4')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add multiple POIs
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = LagekarteId.create(lagekarteId).value!;

      const poi1Result = aggregate.addPoi('POI 1', berlinMgrs, category, userId as any);
      const poi1Id = poi1Result.value!.id;

      const poi2Result = aggregate.addPoi('POI 2', berlinMgrs, category, userId as any);
      const poi2Id = poi2Result.value!.id;

      const poi3Result = aggregate.addPoi('POI 3', berlinMgrs, category, userId as any);

      expect(aggregate.pois.length).toBe(3);

      // Remove POI 2
      const command = RemovePoiCommand.create(lagekarteId, poi2Id.value).value!;

      // Mock: Lagekarte exists with POIs
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);

      // Verify only POI 2 was removed
      const savedAggregate = mockLagekarteRepo.save.mock.calls[0][0];
      expect(savedAggregate.pois.length).toBe(2);
      expect(savedAggregate.pois[0].id.equals(poi1Id)).toBe(true);
      expect(savedAggregate.pois[1].id.equals(poi3Result.value!.id)).toBe(true);

      // Verify POI 2 is NOT in aggregate
      const poi2Exists = savedAggregate.pois.some((poi) => poi.id.equals(poi2Id));
      expect(poi2Exists).toBe(false);
    });
  });

  describe('Failure Cases - LagekarteId validation', () => {
    it('should fail when LagekarteId format is invalid', async () => {
      // Given
      const invalidLagekarteId = 'INVALID-ID-SHORT'; // Invalid: uppercase and too short
      const poiId = generateTestCuid('poiid');
      const command = RemovePoiCommand.create(invalidLagekarteId, poiId).value!;

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid CUID format'); // LagekarteId validation error

      // Verify save was NOT called
      expect(mockLagekarteRepo.save).not.toHaveBeenCalled();
    });

    it('should fail when Lagekarte not found', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkrt5');
      const poiId = generateTestCuid('poi05');
      const command = RemovePoiCommand.create(lagekarteId, poiId).value!;

      // Mock: Lagekarte does NOT exist
      mockLagekarteRepo.findById.mockResolvedValue(null);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Lagekarte not found');

      // Verify save was NOT called
      expect(mockLagekarteRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('Failure Cases - PoiId validation', () => {
    it('should fail when PoiId format is invalid', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkrt6');
      const invalidPoiId = 'INVALID-POI-SHORT'; // Invalid: uppercase and too short
      const command = RemovePoiCommand.create(lagekarteId, invalidPoiId).value!;

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid CUID format'); // PoiId validation error

      // Verify save was NOT called
      expect(mockLagekarteRepo.save).not.toHaveBeenCalled();
    });

    it('should fail when POI not found in aggregate', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkrt7');
      const einsatzId = EinsatzId.create(generateTestCuid('eins7')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      const fakePoiId = generateTestCuid('fakep');
      const command = RemovePoiCommand.create(lagekarteId, fakePoiId).value!;

      // Mock: Lagekarte exists but POI does NOT
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('POI with ID');
      expect(result.error).toContain('not found');

      // Verify save was NOT called
      expect(mockLagekarteRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('Failure Cases - Repository save errors', () => {
    it('should fail when repository.save() throws error', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkrt8');
      const einsatzId = EinsatzId.create(generateTestCuid('eins8')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add POI to aggregate
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = LagekarteId.create(lagekarteId).value!;
      const addResult = aggregate.addPoi('Test POI', berlinMgrs, category, userId as any);
      const poiId = addResult.value!.id;

      const command = RemovePoiCommand.create(lagekarteId, poiId.value).value!;

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);

      // Mock: Save throws error
      mockLagekarteRepo.save.mockRejectedValue(new Error('Database write failed'));

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to save Lagekarte');
      expect(result.error).toContain('Database write failed');
    });

    it('should fail when repository.save() throws non-Error object', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkrt9');
      const einsatzId = EinsatzId.create(generateTestCuid('eins9')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add POI to aggregate
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = LagekarteId.create(lagekarteId).value!;
      const addResult = aggregate.addPoi('Test POI', berlinMgrs, category, userId as any);
      const poiId = addResult.value!.id;

      const command = RemovePoiCommand.create(lagekarteId, poiId.value).value!;

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);

      // Mock: Save throws non-Error object
      mockLagekarteRepo.save.mockRejectedValue('String error');

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to save Lagekarte');
      expect(result.error).toContain('String error');
    });
  });

  describe('Orchestration Verification', () => {
    it('should call repository methods in correct order: findById → save', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkr10');
      const einsatzId = EinsatzId.create(generateTestCuid('ein10')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add POI to aggregate
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = LagekarteId.create(lagekarteId).value!;
      const addResult = aggregate.addPoi('Test POI', berlinMgrs, category, userId as any);
      const poiId = addResult.value!.id;

      const command = RemovePoiCommand.create(lagekarteId, poiId.value).value!;
      const callOrder: string[] = [];

      // Mock: Track call order
      mockLagekarteRepo.findById.mockImplementation(async () => {
        callOrder.push('findById');
        return aggregate;
      });
      mockLagekarteRepo.save.mockImplementation(async () => {
        callOrder.push('save');
        return undefined;
      });

      // When
      await handler.execute(command);

      // Then: Verify correct order
      expect(callOrder).toEqual(['findById', 'save']);
    });

    it('should verify LagekarteId value object equality', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkr11');
      const einsatzId = EinsatzId.create(generateTestCuid('ein11')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add POI to aggregate
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = LagekarteId.create(lagekarteId).value!;
      const addResult = aggregate.addPoi('Test POI', berlinMgrs, category, userId as any);
      const poiId = addResult.value!.id;

      const command = RemovePoiCommand.create(lagekarteId, poiId.value).value!;

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // When
      await handler.execute(command);

      // Then: Verify LagekarteId was created with correct value
      const findByIdCall = mockLagekarteRepo.findById.mock.calls[0][0];

      expect(findByIdCall).toBeInstanceOf(LagekarteId);
      expect(findByIdCall.value).toBe(lagekarteId);
    });

    it('should verify aggregate.save() called with updated aggregate', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkr12');
      const einsatzId = EinsatzId.create(generateTestCuid('ein12')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add POI to aggregate
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = LagekarteId.create(lagekarteId).value!;
      const addResult = aggregate.addPoi('Test POI', berlinMgrs, category, userId as any);
      const poiId = addResult.value!.id;

      const command = RemovePoiCommand.create(lagekarteId, poiId.value).value!;

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // When
      await handler.execute(command);

      // Then: Verify save called with same aggregate instance (updated)
      const savedAggregate = mockLagekarteRepo.save.mock.calls[0][0];
      expect(savedAggregate).toBe(aggregate); // Same instance
      expect(savedAggregate.pois.length).toBe(0); // POI was removed
    });

    it('should verify POI count decreases after removal', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkr13');
      const einsatzId = EinsatzId.create(generateTestCuid('ein13')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add multiple POIs
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = LagekarteId.create(lagekarteId).value!;

      aggregate.addPoi('POI 1', berlinMgrs, category, userId as any);
      const poi2Result = aggregate.addPoi('POI 2', berlinMgrs, category, userId as any);
      aggregate.addPoi('POI 3', berlinMgrs, category, userId as any);

      const initialPoiCount = aggregate.pois.length;
      expect(initialPoiCount).toBe(3);

      const command = RemovePoiCommand.create(lagekarteId, poi2Result.value!.id.value).value!;

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // When
      await handler.execute(command);

      // Then: Verify POI count decreased
      const savedAggregate = mockLagekarteRepo.save.mock.calls[0][0];
      expect(savedAggregate.pois.length).toBe(initialPoiCount - 1);
      expect(savedAggregate.pois.length).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle lagekarteId with all valid CUID2 characters', async () => {
      // Given: Test with valid CUID2 format (lowercase alphanumeric, starts with letter)
      const complexLagekarteId = 'clw3h8x9y0000qwertyu12345'; // Exactly 25 chars, valid CUID2
      const einsatzId = EinsatzId.create(generateTestCuid('ein19')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add POI to aggregate
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = LagekarteId.create(complexLagekarteId).value!;
      const addResult = aggregate.addPoi('Test POI', berlinMgrs, category, userId as any);
      const poiId = addResult.value!.id;

      const command = RemovePoiCommand.create(complexLagekarteId, poiId.value).value!;

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      const findByIdCall = mockLagekarteRepo.findById.mock.calls[0][0];
      expect(findByIdCall.value).toBe(complexLagekarteId);
    });

    it('should handle poiId with all valid CUID2 characters', async () => {
      // Given: Test with all types of valid CUID2 characters (lowercase alphanumeric)
      const lagekarteId = generateTestCuid('lkr20');
      const einsatzId = EinsatzId.create(generateTestCuid('ein20')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add POI to aggregate
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = LagekarteId.create(lagekarteId).value!;
      const addResult = aggregate.addPoi('Test POI', berlinMgrs, category, userId as any);
      const poiId = addResult.value!.id;

      const command = RemovePoiCommand.create(lagekarteId, poiId.value).value!;

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
    });
  });
});
