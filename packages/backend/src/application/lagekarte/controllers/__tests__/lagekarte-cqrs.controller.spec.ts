import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LagekarteCqrsController } from '@/modules/lagekarte/controllers/lagekarte.controller';
import { Result } from '@/domain/common/result';
import { LagekarteId } from '@/domain/value-objects/lagekarte-id';
import { PoiId } from '@/domain/value-objects/poi-id';
import type { ILagekarteRepository } from '@/domain/repositories/i-lagekarte.repository';
import type { CreateLagekarteDto, AddPoiDto, UpdatePoiPositionDto } from '@/application/lagekarte/dto';
import type { LagekarteDto, PoiDto } from '@/application/lagekarte/dtos';

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
 * Helper function: Generates valid CUID2-format test ID.
 * CUID2 format: 20-30 chars, lowercase a-z0-9, starts with lowercase letter.
 */
function createValidTestId(suffix = ''): string {
  const base = 'clw3h8x9y0000qwertyui';
  const safeSuffix = suffix
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .padEnd(5, '0')
    .slice(0, 5);
  return base + safeSuffix;
}

/**
 * Unit Tests für LagekarteCqrsController.
 *
 * **Test Strategy:**
 * - Mocked CommandBus/QueryBus mit jest.fn() (NO NestJS Test Module)
 * - Focus: Controller-Orchestration, Result-Mapping, Exception-Handling
 * - NO Handler-Logic Testing (out of scope)
 *
 * **Coverage Target:** >80% für LagekarteCqrsController
 *
 * **Test Groups:**
 * 1. createLagekarte() - POST /lagekarte
 * 2. addPoi() - POST /lagekarte/:id/poi
 * 3. updatePoiPosition() - PUT /lagekarte/:id/poi/:poiId
 * 4. removePoi() - DELETE /lagekarte/:id/poi/:poiId
 * 5. getLagekarteByEinsatzId() - GET /lagekarte/einsatz/:id
 * 6. getPois() - GET /lagekarte/:id/pois
 */
describe('LagekarteCqrsController', () => {
  let controller: LagekarteCqrsController;
  let mockCommandBus: jest.Mocked<CommandBus>;
  let mockQueryBus: jest.Mocked<QueryBus>;
  let mockRepository: jest.Mocked<ILagekarteRepository>;

  beforeEach(() => {
    // Create mock buses
    mockCommandBus = {
      execute: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    mockQueryBus = {
      execute: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    // Create mock repository
    mockRepository = {
      findById: jest.fn(),
      findByEinsatzId: jest.fn(),
      save: jest.fn(),
      exists: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    // Instantiate controller with mocks (Direct Instantiation Pattern)
    controller = new LagekarteCqrsController(mockCommandBus, mockQueryBus, mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // Test Group 1: createLagekarte() - POST /lagekarte
  // ============================================
  describe('createLagekarte()', () => {
    it('should execute CreateLagekarteCommand and return LagekarteDto', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const dto: CreateLagekarteDto = { einsatzId, initialPoi: undefined };
      const lagekarteId = LagekarteId.create(createValidTestId('lagekarte')).value!;
      const expectedDto: LagekarteDto = {
        id: lagekarteId.value,
        einsatzId,
        pois: [],
        createdAt: new Date(),
      };

      mockCommandBus.execute.mockResolvedValueOnce(Result.ok(lagekarteId));
      mockQueryBus.execute.mockResolvedValueOnce(Result.ok(expectedDto));

      // When
      const result = await controller.createLagekarte(dto);

      // Then
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
      expect(mockQueryBus.execute).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedDto);
    });

    it('should throw BadRequestException when command creation fails (empty einsatzId)', async () => {
      // Given
      const dto: CreateLagekarteDto = { einsatzId: '', initialPoi: undefined };

      // When/Then
      await expect(controller.createLagekarte(dto)).rejects.toThrow(BadRequestException);
      expect(mockCommandBus.execute).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when command execution fails', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const dto: CreateLagekarteDto = { einsatzId, initialPoi: undefined };

      mockCommandBus.execute.mockResolvedValueOnce(Result.fail('Einsatz nicht gefunden'));

      // When/Then
      await expect(controller.createLagekarte(dto)).rejects.toThrow(BadRequestException);
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
      expect(mockQueryBus.execute).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when retrieving created Lagekarte fails', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const dto: CreateLagekarteDto = { einsatzId, initialPoi: undefined };
      const lagekarteId = LagekarteId.create(createValidTestId('lagekarte')).value!;

      mockCommandBus.execute.mockResolvedValueOnce(Result.ok(lagekarteId));
      mockQueryBus.execute.mockResolvedValueOnce(Result.fail('Lagekarte nicht gefunden'));

      // When/Then
      await expect(controller.createLagekarte(dto)).rejects.toThrow(BadRequestException);
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
      expect(mockQueryBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should create Lagekarte with initialPoi', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const dto: CreateLagekarteDto = {
        einsatzId,
        initialPoi: {
          name: 'Einsatzstelle',
          coordinate: { lat: 52.52, lng: 13.4 },
          category: 'EINSATZSTELLE',
        },
      };
      const lagekarteId = LagekarteId.create(createValidTestId('lagekarte')).value!;
      const expectedDto: LagekarteDto = {
        id: lagekarteId.value,
        einsatzId,
        pois: [
          {
            id: createValidTestId('poi'),
            name: 'Einsatzstelle',
            coordinate: { lat: 52.52, lng: 13.4, mgrs: '33U VU 12345 67890' },
            category: { value: 'EINSATZSTELLE' },
          },
        ],
        createdAt: new Date(),
      };

      mockCommandBus.execute.mockResolvedValueOnce(Result.ok(lagekarteId));
      mockQueryBus.execute.mockResolvedValueOnce(Result.ok(expectedDto));

      // When
      const result = await controller.createLagekarte(dto);

      // Then
      expect(result.pois).toHaveLength(1);
      expect(result.pois[0].name).toBe('Einsatzstelle');
    });
  });

  // ============================================
  // Test Group 2: addPoi() - POST /lagekarte/:id/poi
  // ============================================
  describe('addPoi()', () => {
    it('should execute AddPoiCommand and return PoiDto', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const poiId = PoiId.create(createValidTestId('poi')).value!;
      const dto: AddPoiDto = {
        name: 'Test POI',
        coordinate: { lat: 52.52, lng: 13.4 },
        category: 'EINSATZSTELLE',
      };

      const mockAggregate = {
        id: LagekarteId.create(lagekarteId).value!,
        pois: [
          {
            id: poiId,
            name: 'Test POI',
            coordinate: {
              value: '33U VU 12345 67890',
              toLatLng: () => ({ latitude: 52.52, longitude: 13.4 }),
            },
            category: { value: 'EINSATZSTELLE' },
          },
        ],
      };

      mockCommandBus.execute.mockResolvedValueOnce(Result.ok(poiId));
      // biome-ignore lint/suspicious/noExplicitAny: Test mock aggregate
      mockRepository.findById.mockResolvedValueOnce(mockAggregate as any);

      // When
      const result = await controller.addPoi(lagekarteId, dto);

      // Then
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
      expect(mockRepository.findById).toHaveBeenCalledWith(expect.any(LagekarteId));
      expect(result).toMatchObject({ id: poiId.value, name: 'Test POI' });
    });

    it('should throw NotFoundException when Lagekarte not found', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const dto: AddPoiDto = {
        name: 'Test POI',
        coordinate: { lat: 52.52, lng: 13.4 },
        category: 'EINSATZSTELLE',
      };

      mockCommandBus.execute.mockResolvedValueOnce(Result.fail('Lagekarte nicht gefunden'));

      // When/Then
      await expect(controller.addPoi(lagekarteId, dto)).rejects.toThrow(NotFoundException);
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when DTO validation fails (name too short)', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const dto: AddPoiDto = {
        name: 'AB', // Too short (minLength: 3)
        coordinate: { lat: 52.52, lng: 13.4 },
        category: 'EINSATZSTELLE',
      };

      mockCommandBus.execute.mockResolvedValueOnce(Result.fail('Invalid name length'));

      // When/Then
      await expect(controller.addPoi(lagekarteId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should add POI with beschreibung', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const poiId = PoiId.create(createValidTestId('poi')).value!;
      const dto: AddPoiDto = {
        name: 'Test POI',
        coordinate: { lat: 52.52, lng: 13.4 },
        category: 'EINSATZSTELLE',
        beschreibung: 'Test Beschreibung',
      };

      const mockAggregate = {
        id: LagekarteId.create(lagekarteId).value!,
        pois: [
          {
            id: poiId,
            name: 'Test POI',
            coordinate: {
              value: '33U VU 12345 67890',
              toLatLng: () => ({ latitude: 52.52, longitude: 13.4 }),
            },
            category: { value: 'EINSATZSTELLE' },
            beschreibung: 'Test Beschreibung',
          },
        ],
      };

      mockCommandBus.execute.mockResolvedValueOnce(Result.ok(poiId));
      // biome-ignore lint/suspicious/noExplicitAny: Test mock aggregate
      mockRepository.findById.mockResolvedValueOnce(mockAggregate as any);

      // When
      const result = await controller.addPoi(lagekarteId, dto);

      // Then
      expect(result.beschreibung).toBe('Test Beschreibung');
    });

    it('should throw BadRequestException when command returns no POI ID', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const dto: AddPoiDto = {
        name: 'Test POI',
        coordinate: { lat: 52.52, lng: 13.4 },
        category: 'EINSATZSTELLE',
      };

      mockCommandBus.execute.mockResolvedValueOnce(Result.ok(undefined));

      // When/Then
      await expect(controller.addPoi(lagekarteId, dto)).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================
  // Test Group 3: updatePoiPosition() - PUT /lagekarte/:id/poi/:poiId
  // ============================================
  describe('updatePoiPosition()', () => {
    it('should execute UpdatePoiPositionCommand and return updated PoiDto', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const poiId = createValidTestId('poi');
      const dto: UpdatePoiPositionDto = { newCoordinate: { lat: 53.0, lng: 14.0 } };

      const mockAggregate = {
        id: LagekarteId.create(lagekarteId).value!,
        pois: [
          {
            id: PoiId.create(poiId).value!,
            name: 'Test POI',
            coordinate: {
              value: '33U VU 99999 88888',
              toLatLng: () => ({ latitude: 53.0, longitude: 14.0 }),
            },
            category: { value: 'EINSATZSTELLE' },
          },
        ],
      };

      mockCommandBus.execute.mockResolvedValueOnce(Result.ok(undefined));
      // biome-ignore lint/suspicious/noExplicitAny: Test mock aggregate
      mockRepository.findById.mockResolvedValueOnce(mockAggregate as any);

      // When
      const result = await controller.updatePoiPosition(lagekarteId, poiId, dto);

      // Then
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
      expect(mockRepository.findById).toHaveBeenCalledWith(expect.any(LagekarteId));
      expect(result).toMatchObject({ id: poiId, coordinate: { lat: 53.0, lng: 14.0 } });
    });

    it('should throw NotFoundException when POI not found', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const poiId = createValidTestId('poi');
      const dto: UpdatePoiPositionDto = { newCoordinate: { lat: 53.0, lng: 14.0 } };

      mockCommandBus.execute.mockResolvedValueOnce(Result.fail('POI nicht gefunden'));

      // When/Then
      await expect(controller.updatePoiPosition(lagekarteId, poiId, dto)).rejects.toThrow(NotFoundException);
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when Lagekarte ID invalid', async () => {
      // Given
      const lagekarteId = 'invalid-id';
      const poiId = createValidTestId('poi');
      const dto: UpdatePoiPositionDto = { newCoordinate: { lat: 53.0, lng: 14.0 } };

      // Command creation succeeds (only checks empty), but command execution fails (invalid ID format)
      mockCommandBus.execute.mockResolvedValueOnce(Result.fail('Invalid Lagekarte ID format'));

      // When/Then
      await expect(controller.updatePoiPosition(lagekarteId, poiId, dto)).rejects.toThrow(BadRequestException);
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should update POI position with MGRS coordinate', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const poiId = createValidTestId('poi');
      const dto: UpdatePoiPositionDto = { newCoordinate: { mgrs: '33U VU 99999 88888' } };

      const mockAggregate = {
        id: LagekarteId.create(lagekarteId).value!,
        pois: [
          {
            id: PoiId.create(poiId).value!,
            name: 'Test POI',
            coordinate: {
              value: '33U VU 99999 88888',
              toLatLng: () => ({ latitude: 53.0, longitude: 14.0 }),
            },
            category: { value: 'EINSATZSTELLE' },
          },
        ],
      };

      mockCommandBus.execute.mockResolvedValueOnce(Result.ok(undefined));
      // biome-ignore lint/suspicious/noExplicitAny: Test mock aggregate
      mockRepository.findById.mockResolvedValueOnce(mockAggregate as any);

      // When
      const result = await controller.updatePoiPosition(lagekarteId, poiId, dto);

      // Then
      expect(result.coordinate.mgrs).toBe('33U VU 99999 88888');
    });
  });

  // ============================================
  // Test Group 4: removePoi() - DELETE /lagekarte/:id/poi/:poiId
  // ============================================
  describe('removePoi()', () => {
    it('should execute RemovePoiCommand and return void', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const poiId = createValidTestId('poi');

      mockCommandBus.execute.mockResolvedValueOnce(Result.ok(undefined));

      // When
      const result = await controller.removePoi(lagekarteId, poiId);

      // Then
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });

    it('should throw NotFoundException when POI not found', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const poiId = createValidTestId('poi');

      mockCommandBus.execute.mockResolvedValueOnce(Result.fail('POI nicht gefunden'));

      // When/Then
      await expect(controller.removePoi(lagekarteId, poiId)).rejects.toThrow(NotFoundException);
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when Lagekarte ID invalid', async () => {
      // Given
      const lagekarteId = 'invalid-id';
      const poiId = createValidTestId('poi');

      // Command creation succeeds (only checks empty), but command execution fails (invalid ID format)
      mockCommandBus.execute.mockResolvedValueOnce(Result.fail('Invalid Lagekarte ID format'));

      // When/Then
      await expect(controller.removePoi(lagekarteId, poiId)).rejects.toThrow(BadRequestException);
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when Lagekarte not found', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const poiId = createValidTestId('poi');

      mockCommandBus.execute.mockResolvedValueOnce(Result.fail('Lagekarte nicht gefunden'));

      // When/Then
      await expect(controller.removePoi(lagekarteId, poiId)).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================
  // Test Group 5: getLagekarteByEinsatzId() - GET /lagekarte/einsatz/:id
  // ============================================
  describe('getLagekarteByEinsatzId()', () => {
    it('should execute GetLagekarteQuery and return LagekarteDto', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const expectedDto: LagekarteDto = {
        id: createValidTestId('lagekarte'),
        einsatzId,
        pois: [],
        createdAt: new Date(),
      };

      mockQueryBus.execute.mockResolvedValueOnce(Result.ok(expectedDto));

      // When
      const result = await controller.getLagekarteByEinsatzId(einsatzId);

      // Then
      expect(mockQueryBus.execute).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedDto);
    });

    it('should throw NotFoundException when Lagekarte not found', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');

      mockQueryBus.execute.mockResolvedValueOnce(Result.fail('Lagekarte nicht gefunden'));

      // When/Then
      await expect(controller.getLagekarteByEinsatzId(einsatzId)).rejects.toThrow(NotFoundException);
      expect(mockQueryBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should return null when query returns null', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');

      mockQueryBus.execute.mockResolvedValueOnce(Result.ok(null));

      // When
      const result = await controller.getLagekarteByEinsatzId(einsatzId);

      // Then
      expect(result).toBeNull();
      expect(mockQueryBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should return Lagekarte with multiple POIs', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const expectedDto: LagekarteDto = {
        id: createValidTestId('lagekarte'),
        einsatzId,
        pois: [
          {
            id: createValidTestId('poi1'),
            name: 'POI 1',
            coordinate: { lat: 52.52, lng: 13.4, mgrs: '33U VU 12345 67890' },
            category: { value: 'EINSATZSTELLE' },
          },
          {
            id: createValidTestId('poi2'),
            name: 'POI 2',
            coordinate: { lat: 52.53, lng: 13.41, mgrs: '33U VU 12346 67891' },
            category: 'SAMMELPLATZ',
          },
        ],
        createdAt: new Date(),
      };

      mockQueryBus.execute.mockResolvedValueOnce(Result.ok(expectedDto));

      // When
      const result = await controller.getLagekarteByEinsatzId(einsatzId);

      // Then
      expect(result!.pois).toHaveLength(2);
    });
  });

  // ============================================
  // Test Group 6: getPois() - GET /lagekarte/:id/pois
  // ============================================
  describe('getPois()', () => {
    it('should execute GetPoisQuery and return PoiDto array', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const expectedPois: PoiDto[] = [
        {
          id: createValidTestId('poi1'),
          name: 'POI 1',
          coordinate: { lat: 52.52, lng: 13.4, mgrs: '33U VU 12345 67890' },
          category: 'EINSATZSTELLE',
        },
        {
          id: createValidTestId('poi2'),
          name: 'POI 2',
          coordinate: { lat: 52.53, lng: 13.41, mgrs: '33U VU 12346 67891' },
          category: 'SAMMELPLATZ',
        },
      ];

      mockQueryBus.execute.mockResolvedValueOnce(Result.ok(expectedPois));

      // When
      const result = await controller.getPois(lagekarteId);

      // Then
      expect(mockQueryBus.execute).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedPois);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no POIs exist', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');

      mockQueryBus.execute.mockResolvedValueOnce(Result.ok([]));

      // When
      const result = await controller.getPois(lagekarteId);

      // Then
      expect(result).toEqual([]);
      expect(mockQueryBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when Lagekarte not found', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');

      mockQueryBus.execute.mockResolvedValueOnce(Result.fail('Lagekarte nicht gefunden'));

      // When/Then
      await expect(controller.getPois(lagekarteId)).rejects.toThrow(NotFoundException);
      expect(mockQueryBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when query returns undefined value', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');

      mockQueryBus.execute.mockResolvedValueOnce(Result.ok(undefined));

      // When/Then
      await expect(controller.getPois(lagekarteId)).rejects.toThrow(NotFoundException);
    });

    it('should return POIs with beschreibung', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const expectedPois: PoiDto[] = [
        {
          id: createValidTestId('poi1'),
          name: 'POI 1',
          coordinate: { lat: 52.52, lng: 13.4, mgrs: '33U VU 12345 67890' },
          category: 'EINSATZSTELLE',
          beschreibung: 'Test Beschreibung',
        },
      ];

      mockQueryBus.execute.mockResolvedValueOnce(Result.ok(expectedPois));

      // When
      const result = await controller.getPois(lagekarteId);

      // Then
      expect(result[0].beschreibung).toBe('Test Beschreibung');
    });
  });
});
