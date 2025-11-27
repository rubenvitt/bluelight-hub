// biome-ignore-all lint/suspicious/noExplicitAny: Test mocks and type casting
import { UpdatePoiPositionCommandHandler } from '../update-poi-position.handler';
import { UpdatePoiPositionCommand } from '../update-poi-position.command';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
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
    return /^[a-z][a-z0-9]+$/.test(id);
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
 * Unit Tests für UpdatePoiPositionCommandHandler.
 *
 * Testet Handler-Orchestration gemäß BDD Given-When-Then Pattern.
 * Nutzt jest.fn() für Repository-Mocks (NO NestJS Test Module).
 *
 * Coverage Target: >90%
 * Testing Framework: Jest 30.2.0 mit @swc/jest
 */
describe('UpdatePoiPositionCommandHandler', () => {
  let handler: UpdatePoiPositionCommandHandler;
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
    handler = new UpdatePoiPositionCommandHandler(mockLagekarteRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should update POI position with Lat/Lng coordinate and convert to MGRS', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkart');

      // Create existing aggregate with POI
      const einsatzId = EinsatzId.create(generateTestCuid('einsz')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add initial POI at Berlin
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = UserId.create().value!;
      const addResult = aggregate.addPoi('Test POI', berlinMgrs, category, userId);
      const poi = addResult.value!;

      // Create command with actual POI ID
      const command = UpdatePoiPositionCommand.create(lagekarteId, poi.id.value, { lat: 53.55, lng: 10.0 }).value!; // Hamburg

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // Clear initial events
      aggregate.clearDomainEvents();

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeUndefined(); // Returns void

      // Verify MGRS conversion and position update
      const savedAggregate = mockLagekarteRepo.save.mock.calls[0][0];
      expect(savedAggregate.pois.length).toBe(1);
      expect(savedAggregate.pois[0].coordinate.toString()).toContain('32U'); // MGRS zone for Hamburg
    });

    it('should update POI position with MGRS string used directly', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkrt2');
      const newMgrsString = '32UNE8934004990'; // Hamburg MGRS

      // Create existing aggregate with POI
      const einsatzId = EinsatzId.create(generateTestCuid('eins2')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add initial POI at Berlin
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = UserId.create().value!;
      const addResult = aggregate.addPoi('Test POI', berlinMgrs, category, userId);
      const poi = addResult.value!;

      // Create command with actual POI ID
      const command = UpdatePoiPositionCommand.create(lagekarteId, poi.id.value, { mgrs: newMgrsString }).value!;

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // Clear initial events
      aggregate.clearDomainEvents();

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);

      // Verify MGRS string was parsed and used
      const savedAggregate = mockLagekarteRepo.save.mock.calls[0][0];
      expect(savedAggregate.pois.length).toBe(1);
      expect(savedAggregate.pois[0].coordinate.toString()).toBe(newMgrsString); // Normalized MGRS
    });
  });

  describe('Failure Cases - ID validation', () => {
    it('should fail when LagekarteId format is invalid', async () => {
      // Given
      const invalidLagekarteId = 'INVALID-ID-SHORT'; // Invalid: uppercase and too short
      const poiId = generateTestCuid('poiid');
      const command = UpdatePoiPositionCommand.create(invalidLagekarteId, poiId, { lat: 53.55, lng: 10.0 }).value!;

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid CUID format'); // LagekarteId validation error

      // Verify save was NOT called
      expect(mockLagekarteRepo.save).not.toHaveBeenCalled();
    });

    it('should fail when PoiId format is invalid', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkrt5');
      const invalidPoiId = 'INVALID-POI-SHORT'; // Invalid: uppercase and too short
      const command = UpdatePoiPositionCommand.create(lagekarteId, invalidPoiId, { lat: 53.55, lng: 10.0 }).value!;

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid CUID format'); // PoiId validation error

      // Verify save was NOT called
      expect(mockLagekarteRepo.save).not.toHaveBeenCalled();
    });

    it('should fail when Lagekarte not found', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkrt6');
      const poiId = generateTestCuid('poi06');
      const command = UpdatePoiPositionCommand.create(lagekarteId, poiId, { lat: 53.55, lng: 10.0 }).value!;

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

    it('should fail when POI not found in aggregate', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkrt7');
      const nonExistentPoiId = generateTestCuid('nonex');
      const command = UpdatePoiPositionCommand.create(lagekarteId, nonExistentPoiId, { lat: 53.55, lng: 10.0 }).value!;

      // Create existing aggregate WITHOUT the POI
      const einsatzId = EinsatzId.create(generateTestCuid('eins7')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Mock: Lagekarte exists but POI does not
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not found');

      // Verify save was NOT called
      expect(mockLagekarteRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('Failure Cases - Invalid coordinates', () => {
    it('should fail when MGRS string is invalid', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkrt8');
      const poiId = generateTestCuid('poi08');
      const command = UpdatePoiPositionCommand.create(lagekarteId, poiId, { mgrs: 'INVALID_MGRS_STRING' }).value!;

      // Create existing aggregate with POI
      const einsatzId = EinsatzId.create(generateTestCuid('eins8')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add initial POI
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = UserId.create().value!;
      aggregate.addPoi('Test POI', berlinMgrs, category, userId);

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid MGRS format');

      // Verify save was NOT called
      expect(mockLagekarteRepo.save).not.toHaveBeenCalled();
    });

    it('should fail when latitude is out of range (> 90)', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkrt9');
      const poiId = generateTestCuid('poi09');
      const command = UpdatePoiPositionCommand.create(lagekarteId, poiId, { lat: 91, lng: 10.0 }).value!;

      // Create existing aggregate with POI
      const einsatzId = EinsatzId.create(generateTestCuid('eins9')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add initial POI
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = UserId.create().value!;
      aggregate.addPoi('Test POI', berlinMgrs, category, userId);

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid lat');

      // Verify save was NOT called
      expect(mockLagekarteRepo.save).not.toHaveBeenCalled();
    });

    it('should fail when latitude is out of range (< -90)', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkr10');
      const poiId = generateTestCuid('poi10');
      const command = UpdatePoiPositionCommand.create(lagekarteId, poiId, { lat: -91, lng: 10.0 }).value!;

      // Create existing aggregate with POI
      const einsatzId = EinsatzId.create(generateTestCuid('ein10')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add initial POI
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = UserId.create().value!;
      aggregate.addPoi('Test POI', berlinMgrs, category, userId);

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid lat');

      // Verify save was NOT called
      expect(mockLagekarteRepo.save).not.toHaveBeenCalled();
    });

    it('should fail when longitude is out of range (> 180)', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkr11');
      const poiId = generateTestCuid('poi11');
      const command = UpdatePoiPositionCommand.create(lagekarteId, poiId, { lat: 53.55, lng: 181 }).value!;

      // Create existing aggregate with POI
      const einsatzId = EinsatzId.create(generateTestCuid('ein11')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add initial POI
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = UserId.create().value!;
      aggregate.addPoi('Test POI', berlinMgrs, category, userId);

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid longitude');

      // Verify save was NOT called
      expect(mockLagekarteRepo.save).not.toHaveBeenCalled();
    });

    it('should fail when longitude is out of range (< -180)', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkr12');
      const poiId = generateTestCuid('poi12');
      const command = UpdatePoiPositionCommand.create(lagekarteId, poiId, { lat: 53.55, lng: -181 }).value!;

      // Create existing aggregate with POI
      const einsatzId = EinsatzId.create(generateTestCuid('ein12')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add initial POI
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = UserId.create().value!;
      aggregate.addPoi('Test POI', berlinMgrs, category, userId);

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid longitude');

      // Verify save was NOT called
      expect(mockLagekarteRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('Failure Cases - Repository save errors', () => {
    it('should fail when repository.save() throws error', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkr13');

      // Create existing aggregate with POI
      const einsatzId = EinsatzId.create(generateTestCuid('ein13')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add initial POI
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = UserId.create().value!;
      const addResult = aggregate.addPoi('Test POI', berlinMgrs, category, userId);
      const poi = addResult.value!;

      // Create command with actual POI ID
      const command = UpdatePoiPositionCommand.create(lagekarteId, poi.id.value, { lat: 53.55, lng: 10.0 }).value!;

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
      const lagekarteId = generateTestCuid('lkr14');

      // Create existing aggregate with POI
      const einsatzId = EinsatzId.create(generateTestCuid('ein14')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add initial POI
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = UserId.create().value!;
      const addResult = aggregate.addPoi('Test POI', berlinMgrs, category, userId);
      const poi = addResult.value!;

      // Create command with actual POI ID
      const command = UpdatePoiPositionCommand.create(lagekarteId, poi.id.value, { lat: 53.55, lng: 10.0 }).value!;

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
    it('should call repository methods in correct order (findById → save)', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkr15');
      const callOrder: string[] = [];

      // Create existing aggregate with POI
      const einsatzId = EinsatzId.create(generateTestCuid('ein15')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add initial POI
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = UserId.create().value!;
      const addResult = aggregate.addPoi('Test POI', berlinMgrs, category, userId);
      const poi = addResult.value!;

      // Create command with actual POI ID
      const command = UpdatePoiPositionCommand.create(lagekarteId, poi.id.value, { lat: 53.55, lng: 10.0 }).value!;

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

    it('should verify aggregate.save() called with updated aggregate', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkr16');

      // Create existing aggregate with POI
      const einsatzId = EinsatzId.create(generateTestCuid('ein16')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add initial POI
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = UserId.create().value!;
      const addResult = aggregate.addPoi('Test POI', berlinMgrs, category, userId);
      const poi = addResult.value!;

      // Create command with actual POI ID
      const command = UpdatePoiPositionCommand.create(lagekarteId, poi.id.value, { lat: 53.55, lng: 10.0 }).value!;

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // When
      await handler.execute(command);

      // Then: Verify save called with same aggregate instance (updated)
      const savedAggregate = mockLagekarteRepo.save.mock.calls[0][0];
      expect(savedAggregate).toBe(aggregate); // Same instance
      expect(savedAggregate.pois.length).toBe(1); // POI still present
    });
  });

  describe('Edge Cases', () => {
    it('should handle updating POI 2 in multi-POI aggregate (POI 1 + 3 unchanged)', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkr22');

      // Create aggregate with 3 POIs
      const einsatzId = EinsatzId.create(generateTestCuid('ein22')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const hamburgMgrs = MgrsCoordinate.fromLatLng(53.55, 9.99).value!;
      const munichMgrs = MgrsCoordinate.fromLatLng(48.14, 11.58).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = UserId.create().value!;

      // Add 3 POIs
      aggregate.addPoi('POI 1', berlinMgrs, category, userId);
      const poi2Result = aggregate.addPoi('POI 2', hamburgMgrs, category, userId);
      const poi2 = poi2Result.value!;
      aggregate.addPoi('POI 3', munichMgrs, category, userId);

      // Create command to update POI 2 with actual POI 2 ID
      const actualCommand = UpdatePoiPositionCommand.create(lagekarteId, poi2.id.value, { lat: 53.55, lng: 10.0 }).value!;

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // When
      const result = await handler.execute(actualCommand);

      // Then
      expect(result.isSuccess).toBe(true);

      // Verify only POI 2 was updated
      const savedAggregate = mockLagekarteRepo.save.mock.calls[0][0];
      expect(savedAggregate.pois.length).toBe(3);
      expect(savedAggregate.pois[0].coordinate.toString()).toBe(berlinMgrs.toString()); // POI 1 unchanged
      expect(savedAggregate.pois[2].coordinate.toString()).toBe(munichMgrs.toString()); // POI 3 unchanged
    });

    it('should succeed when updating to same coordinate (position unchanged)', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkr23');
      const sameCoordinate = { lat: 52.5163, lng: 13.3777 }; // Same as initial

      // Create existing aggregate with POI at Berlin
      const einsatzId = EinsatzId.create(generateTestCuid('ein23')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const userId = UserId.create().value!;
      const addResult = aggregate.addPoi('Test POI', berlinMgrs, category, userId);
      const poi = addResult.value!;

      // Create command with actual POI ID
      const command = UpdatePoiPositionCommand.create(lagekarteId, poi.id.value, sameCoordinate).value!;

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // When
      const result = await handler.execute(command);

      // Then: Still returns success even though position didn't change
      expect(result.isSuccess).toBe(true);
    });
  });
});
