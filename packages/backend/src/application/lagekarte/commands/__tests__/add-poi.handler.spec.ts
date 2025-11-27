import { AddPoiCommandHandler } from '../add-poi.handler';
import { AddPoiCommand } from '../add-poi.command';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
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
 * Unit Tests für AddPoiCommandHandler.
 *
 * Testet Handler-Orchestration gemäß BDD Given-When-Then Pattern.
 * Nutzt jest.fn() für Repository-Mocks (NO NestJS Test Module).
 *
 * Coverage Target: >90%
 * Testing Framework: Jest 30.2.0 mit @swc/jest
 */
describe('AddPoiCommandHandler', () => {
  let handler: AddPoiCommandHandler;
  let mockLagekarteRepo: jest.Mocked<ILagekarteRepository>;

  beforeEach(() => {
    // Create mock repository with all required methods
    mockLagekarteRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEinsatzId: jest.fn(),
      exists: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    // Instantiate handler with mocks (Direct Instantiation Pattern)
    handler = new AddPoiCommandHandler(mockLagekarteRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should add POI with Lat/Lng coordinate and convert to MGRS', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkart');
      const command = AddPoiCommand.create(lagekarteId, 'Brandenburger Tor', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE').value!;

      // Create existing aggregate
      const einsatzId = EinsatzId.create(generateTestCuid('einsz')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.value).toBeDefined(); // PoiId

      // Verify MGRS conversion happened
      const savedAggregate = mockLagekarteRepo.save.mock.calls[0][0];
      expect(savedAggregate.pois.length).toBe(1);
      expect(savedAggregate.pois[0].name).toBe('Brandenburger Tor');
      expect(savedAggregate.pois[0].coordinate.toString()).toContain('33UUU'); // MGRS zone for Berlin
      expect(savedAggregate.pois[0].category.value).toBe('EINSATZSTELLE');
    });

    it('should add POI with MGRS string used directly', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkrt2');
      const command = AddPoiCommand.create(lagekarteId, 'Rathaus Hamburg', { mgrs: '32UNE8934004990' }, 'BEREITSTELLUNGSRAUM').value!;

      // Create existing aggregate
      const einsatzId = EinsatzId.create(generateTestCuid('eins2')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);

      // Verify MGRS string was parsed
      const savedAggregate = mockLagekarteRepo.save.mock.calls[0][0];
      expect(savedAggregate.pois.length).toBe(1);
      expect(savedAggregate.pois[0].name).toBe('Rathaus Hamburg');
      expect(savedAggregate.pois[0].coordinate.toString()).toBe('32UNE8934004990'); // Normalized MGRS
      expect(savedAggregate.pois[0].category.value).toBe('BEREITSTELLUNGSRAUM');
    });

    it('should add POI with optional beschreibung', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkrt3');
      const command = AddPoiCommand.create(lagekarteId, 'Gefahrenstelle', { lat: 52.5163, lng: 13.3777 }, 'GEFAHRENSTELLE', 'Überflutete Straße, nicht befahrbar').value!;

      // Create existing aggregate
      const einsatzId = EinsatzId.create(generateTestCuid('eins3')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);

      // Verify beschreibung was passed to aggregate
      const savedAggregate = mockLagekarteRepo.save.mock.calls[0][0];
      expect(savedAggregate.pois.length).toBe(1);
      expect(savedAggregate.pois[0].name).toBe('Gefahrenstelle');
      expect(savedAggregate.pois[0].beschreibung).toBe('Überflutete Straße, nicht befahrbar');
    });

    it('should add POI without beschreibung when omitted', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkrt4');
      const command = AddPoiCommand.create(lagekarteId, 'Test POI', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE').value!;

      // Create existing aggregate
      const einsatzId = EinsatzId.create(generateTestCuid('eins4')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);

      // Verify undefined beschreibung was passed to aggregate
      const savedAggregate = mockLagekarteRepo.save.mock.calls[0][0];
      expect(savedAggregate.pois.length).toBe(1);
      expect(savedAggregate.pois[0].beschreibung).toBeUndefined();
    });
  });

  describe('Failure Cases - LagekarteId validation', () => {
    it('should fail when LagekarteId format is invalid', async () => {
      // Given
      const invalidLagekarteId = 'INVALID-ID-SHORT'; // Invalid: uppercase and too short
      const command = AddPoiCommand.create(invalidLagekarteId, 'Test POI', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE').value!;

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
      const lagekarteId = generateTestCuid('lkrt6');
      const command = AddPoiCommand.create(lagekarteId, 'Test POI', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE').value!;

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

  describe('Failure Cases - Invalid coordinates', () => {
    it('should fail when MGRS string is invalid', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkrt7');
      const command = AddPoiCommand.create(lagekarteId, 'Invalid POI', { mgrs: 'INVALID_MGRS_STRING' }, 'EINSATZSTELLE').value!;

      // Create existing aggregate
      const einsatzId = EinsatzId.create(generateTestCuid('eins7')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

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
      const lagekarteId = generateTestCuid('lkrt8');
      const command = AddPoiCommand.create(lagekarteId, 'Invalid Latitude', { lat: 91, lng: 13.3777 }, 'EINSATZSTELLE').value!;

      // Create existing aggregate
      const einsatzId = EinsatzId.create(generateTestCuid('eins8')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

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
      const lagekarteId = generateTestCuid('lkrt9');
      const command = AddPoiCommand.create(lagekarteId, 'Invalid Latitude', { lat: -91, lng: 13.3777 }, 'EINSATZSTELLE').value!;

      // Create existing aggregate
      const einsatzId = EinsatzId.create(generateTestCuid('eins9')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

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
      const lagekarteId = generateTestCuid('lkr10');
      const command = AddPoiCommand.create(lagekarteId, 'Invalid Longitude', { lat: 52.5163, lng: 181 }, 'EINSATZSTELLE').value!;

      // Create existing aggregate
      const einsatzId = EinsatzId.create(generateTestCuid('ein10')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

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
      const lagekarteId = generateTestCuid('lkr11');
      const command = AddPoiCommand.create(lagekarteId, 'Invalid Longitude', { lat: 52.5163, lng: -181 }, 'EINSATZSTELLE').value!;

      // Create existing aggregate
      const einsatzId = EinsatzId.create(generateTestCuid('ein11')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

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

  describe('Failure Cases - Invalid POI category', () => {
    it('should fail when category is invalid', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkr12');
      const command = AddPoiCommand.create(lagekarteId, 'Test POI', { lat: 52.5163, lng: 13.3777 }, 'INVALID_CATEGORY').value!;

      // Create existing aggregate
      const einsatzId = EinsatzId.create(generateTestCuid('ein12')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid POI category');

      // Verify save was NOT called
      expect(mockLagekarteRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('Failure Cases - Aggregate business rule violations', () => {
    it('should fail when duplicate POI name exists in aggregate', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkr13');
      const command = AddPoiCommand.create(lagekarteId, 'Duplicate POI', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE').value!;

      // Create aggregate with existing POI
      const einsatzId = EinsatzId.create(generateTestCuid('ein13')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Add POI with same name
      const berlinMgrs = MgrsCoordinate.fromLatLng(52.5163, 13.3777).value!;
      const category = PoiCategory.create('EINSATZSTELLE').value!;
      const existingLagekarteId = LagekarteId.create(lagekarteId).value!;

      // Add initial POI
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing - LagekarteId used as UserId
      aggregate.addPoi('Duplicate POI', berlinMgrs, category, existingLagekarteId as any);

      // Mock: Lagekarte exists with POI
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already exists');

      // Verify save was NOT called
      expect(mockLagekarteRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('Failure Cases - Repository save errors', () => {
    it('should fail when repository.save() throws error', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkr14');
      const command = AddPoiCommand.create(lagekarteId, 'Test POI', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE').value!;

      // Create existing aggregate
      const einsatzId = EinsatzId.create(generateTestCuid('ein14')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

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
      const lagekarteId = generateTestCuid('lkr15');
      const command = AddPoiCommand.create(lagekarteId, 'Test POI', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE').value!;

      // Create existing aggregate
      const einsatzId = EinsatzId.create(generateTestCuid('ein15')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

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
    it('should call repository methods in correct order', async () => {
      // Given
      const lagekarteId = generateTestCuid('lkr16');
      const command = AddPoiCommand.create(lagekarteId, 'Test POI', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE').value!;
      const callOrder: string[] = [];

      // Create existing aggregate
      const einsatzId = EinsatzId.create(generateTestCuid('ein16')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

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
      const lagekarteId = generateTestCuid('lkr17');
      const command = AddPoiCommand.create(lagekarteId, 'Test POI', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE').value!;

      // Create existing aggregate
      const einsatzId = EinsatzId.create(generateTestCuid('ein17')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

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
      const lagekarteId = generateTestCuid('lkr18');
      const command = AddPoiCommand.create(lagekarteId, 'Test POI', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE').value!;

      // Create existing aggregate
      const einsatzId = EinsatzId.create(generateTestCuid('ein18')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // When
      await handler.execute(command);

      // Then: Verify save called with same aggregate instance (updated)
      const savedAggregate = mockLagekarteRepo.save.mock.calls[0][0];
      expect(savedAggregate).toBe(aggregate); // Same instance
      expect(savedAggregate.pois.length).toBe(1); // POI was added
    });
  });

  describe('Edge Cases', () => {
    it('should handle lagekarteId with all valid CUID2 characters', async () => {
      // Given: Test with valid CUID2 format (lowercase alphanumeric, starts with letter)
      const complexLagekarteId = 'clw3h8x9y0000qwertyu12345'; // Exactly 25 chars, valid CUID2
      const command = AddPoiCommand.create(complexLagekarteId, 'Test POI', { lat: 52.5163, lng: 13.3777 }, 'EINSATZSTELLE').value!;

      // Create existing aggregate
      const einsatzId = EinsatzId.create(generateTestCuid('ein24')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

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

    it('should handle POI at northern Germany boundary (Flensburg)', async () => {
      // Given: Northern Germany boundary coordinates (Flensburg)
      const lagekarteId = generateTestCuid('lkr25');
      const command = AddPoiCommand.create(lagekarteId, 'Flensburg North', { lat: 54.78, lng: 9.44 }, 'SONSTIGES').value!;

      // Create existing aggregate
      const einsatzId = EinsatzId.create(generateTestCuid('ein25')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      const savedAggregate = mockLagekarteRepo.save.mock.calls[0][0];
      expect(savedAggregate.pois.length).toBe(1);
      expect(savedAggregate.pois[0].name).toBe('Flensburg North');
    });

    it('should handle POI at southern Germany boundary (Munich)', async () => {
      // Given: Southern Germany coordinates (Munich - Zone 33U)
      const lagekarteId = generateTestCuid('lkr26');
      const command = AddPoiCommand.create(lagekarteId, 'Munich Marienplatz', { lat: 48.1371, lng: 11.5754 }, 'SONSTIGES').value!;

      // Create existing aggregate
      const einsatzId = EinsatzId.create(generateTestCuid('ein26')).value!;
      const createdBy = UserId.create().value!;
      const aggregate = LagekarteAggregate.create(einsatzId, createdBy).value!;

      // Mock: Lagekarte exists
      mockLagekarteRepo.findById.mockResolvedValue(aggregate);
      mockLagekarteRepo.save.mockResolvedValue(undefined);

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      const savedAggregate = mockLagekarteRepo.save.mock.calls[0][0];
      expect(savedAggregate.pois.length).toBe(1);
      expect(savedAggregate.pois[0].name).toBe('Munich Marienplatz');
    });
  });
});
