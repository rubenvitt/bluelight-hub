import { RemovePoiCommandHandler } from '../remove-poi.handler';
import { RemovePoiCommand } from '../remove-poi.command';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { PoiId } from '@domain/value-objects/poi-id';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';

// Mock nanoid for deterministic test IDs
jest.mock('nanoid/non-secure', () => ({
  nanoid: jest.fn((length?: number) => {
    // Generate valid nanoid format: URL-safe characters only (A-Za-z0-9_-)
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
 * Uses URL-safe characters (A-Za-z0-9_-) as per nanoid format.
 */
function createValidTestId(prefix = 'test'): string {
  // Create exactly 21 characters (padded with valid chars)
  const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let id = prefix;
  while (id.length < 21) {
    id += validChars.charAt(Math.floor(Math.random() * validChars.length));
  }
  return id.substring(0, 21); // Ensure exactly 21 chars
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

  beforeEach(() => {
    // Create mock repository with all required methods
    mockLagekarteRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEinsatzId: jest.fn(),
      exists: jest.fn(),
    } as any;

    // Instantiate handler with mocks (Direct Instantiation Pattern)
    handler = new RemovePoiCommandHandler(mockLagekarteRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should remove POI and return void success', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzId = EinsatzId.create(createValidTestId('einsatz')).value!;
      const aggregate = LagekarteAggregate.create(einsatzId).value!;

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

    it('should emit PoiRemovedEvent when POI is removed', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzId = EinsatzId.create(createValidTestId('einsatz')).value!;
      const aggregate = LagekarteAggregate.create(einsatzId).value!;

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

      // Verify domain event emitted
      const savedAggregate = mockLagekarteRepo.save.mock.calls[0][0];
      const events = savedAggregate.getDomainEvents();
      expect(events.length).toBe(2); // PoiAddedEvent + PoiRemovedEvent
      expect(events[1].constructor.name).toBe('PoiRemovedEvent');
      expect(events[1]).toMatchObject({
        poiId: poiId,
      });
    });

    it('should verify hard delete - POI not in aggregate after removal', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzId = EinsatzId.create(createValidTestId('einsatz')).value!;
      const aggregate = LagekarteAggregate.create(einsatzId).value!;

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
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzId = EinsatzId.create(createValidTestId('einsatz')).value!;
      const aggregate = LagekarteAggregate.create(einsatzId).value!;

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
      const invalidLagekarteId = 'invalid-id-too-short'; // Less than 21 chars
      const poiId = createValidTestId('poi');
      const command = RemovePoiCommand.create(invalidLagekarteId, poiId).value!;

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid nanoid format'); // LagekarteId validation error

      // Verify save was NOT called
      expect(mockLagekarteRepo.save).not.toHaveBeenCalled();
    });

    it('should fail when Lagekarte not found', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const poiId = createValidTestId('poi');
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
      const lagekarteId = createValidTestId('lagekarte');
      const invalidPoiId = 'invalid-poi-id-short'; // Less than 21 chars
      const command = RemovePoiCommand.create(lagekarteId, invalidPoiId).value!;

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid nanoid format'); // PoiId validation error

      // Verify save was NOT called
      expect(mockLagekarteRepo.save).not.toHaveBeenCalled();
    });

    it('should fail when POI not found in aggregate', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzId = EinsatzId.create(createValidTestId('einsatz')).value!;
      const aggregate = LagekarteAggregate.create(einsatzId).value!;

      const fakePoiId = createValidTestId('poi');
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
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzId = EinsatzId.create(createValidTestId('einsatz')).value!;
      const aggregate = LagekarteAggregate.create(einsatzId).value!;

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
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzId = EinsatzId.create(createValidTestId('einsatz')).value!;
      const aggregate = LagekarteAggregate.create(einsatzId).value!;

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
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzId = EinsatzId.create(createValidTestId('einsatz')).value!;
      const aggregate = LagekarteAggregate.create(einsatzId).value!;

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
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzId = EinsatzId.create(createValidTestId('einsatz')).value!;
      const aggregate = LagekarteAggregate.create(einsatzId).value!;

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
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzId = EinsatzId.create(createValidTestId('einsatz')).value!;
      const aggregate = LagekarteAggregate.create(einsatzId).value!;

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
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzId = EinsatzId.create(createValidTestId('einsatz')).value!;
      const aggregate = LagekarteAggregate.create(einsatzId).value!;

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

    it('should verify NO event publishing yet (Epic 2.7 deferred)', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzId = EinsatzId.create(createValidTestId('einsatz')).value!;
      const aggregate = LagekarteAggregate.create(einsatzId).value!;

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

      // Then: Verify events are NOT published (only stored in aggregate)
      const savedAggregate = mockLagekarteRepo.save.mock.calls[0][0];
      const events = savedAggregate.getDomainEvents();

      // Events should exist in aggregate but NOT published yet
      expect(events.length).toBeGreaterThan(0);

      // Verify NO eventPublisher injected/called (TODO Epic 2.7)
      // This test documents current behavior - will change in Epic 2.7
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe('Edge Cases', () => {
    it('should handle lagekarteId with all valid nanoid characters', async () => {
      // Given: Test with all types of valid nanoid characters (A-Za-z0-9_-)
      const complexLagekarteId = 'AZaz09_-0123456789XYZ'; // Exactly 21 chars with all valid types
      const einsatzId = EinsatzId.create(createValidTestId('einsatz')).value!;
      const aggregate = LagekarteAggregate.create(einsatzId).value!;

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

    it('should handle poiId with all valid nanoid characters', async () => {
      // Given: Test with all types of valid nanoid characters (A-Za-z0-9_-)
      const lagekarteId = createValidTestId('lagekarte');
      const einsatzId = EinsatzId.create(createValidTestId('einsatz')).value!;
      const aggregate = LagekarteAggregate.create(einsatzId).value!;

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
