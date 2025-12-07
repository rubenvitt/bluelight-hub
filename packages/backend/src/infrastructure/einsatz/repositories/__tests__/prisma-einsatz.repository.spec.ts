import type { PrismaService } from '@/infrastructure/database/prisma.service';
import type { PrismaOutboxRepository } from '@/infrastructure/outbox/prisma-outbox.repository';
import { PrismaEinsatzRepository } from '../prisma-einsatz.repository';
import { PrismaEinsatzMapper } from '../../mappers/prisma-einsatz.mapper';
import type { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { UserId } from '@domain/value-objects/user-id';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import type { Address } from '@domain/value-objects/address';
import { Result } from '@domain/common/result';
import type { Einsatz as PrismaEinsatz, EinsatzStatus as PrismaEinsatzStatus } from '@prisma/client';

/**
 * Unit Tests für PrismaEinsatzRepository.
 *
 * Diese Tests validieren die Infrastructure Layer Implementation des
 * IEinsatzRepository Ports mit gemocktem PrismaService.
 *
 * **Test Coverage:**
 * - save() Method: Create-Fall, Update-Fall, Outbox Integration, Error Cases
 * - findById() Method: Gefunden, nicht gefunden
 * - findByNummer() Method: Gefunden, nicht gefunden, ungültiges Format
 * - findActive() Method: Mehrere Ergebnisse, leeres Array
 * - exists() Method: true wenn count > 0, false wenn count === 0
 *
 * **Mocking Strategy:**
 * - PrismaService: Vollständig gemockt (einsatz.upsert, findUnique, findMany, count, $transaction)
 * - PrismaOutboxRepository: Mock mit save() → jest.fn().mockResolvedValue(undefined)
 * - PrismaEinsatzMapper: Spy auf statische Methoden (toPersistence, toAggregate)
 *
 * **Test Patterns:**
 * - AAA Pattern: Arrange → Act → Assert
 * - Mock Reset: beforeEach() cleared alle Mocks
 * - Helper Functions: createMockAggregate(), createMockPrismaData()
 */
describe('PrismaEinsatzRepository', () => {
  // Mock Instances
  let repository: PrismaEinsatzRepository;
  let mockPrismaService: jest.Mocked<PrismaService>;
  let mockOutboxRepository: jest.Mocked<PrismaOutboxRepository>;

  // Mock Data Helpers
  const mockUserId = 'user_abc123';
  const mockEinsatzId = 'einsatz_xyz789';

  /**
   * Helper: Erstellt ein Mock Einsatz Aggregate.
   */
  const createMockAggregate = (overrides?: {
    id?: string;
    nummer?: string;
    alarmstichwort?: string;
    status?: EinsatzStatus;
    einsatzort?: Address;
    bemerkung?: string;
    createdAt?: Date;
    updatedAt?: Date;
    archivedAt?: Date;
  }): Einsatz => {
    // Create mock Value Objects with .value property
    const createdBy = { value: mockUserId, equals: jest.fn() } as UserId;

    // Create mock EinsatzId with .value property
    const idValue = overrides?.id ?? mockEinsatzId;
    // biome-ignore lint/suspicious/noExplicitAny: Mock object für Test
    const einsatzId = { value: idValue, equals: (other: any) => other?.value === idValue } as EinsatzId;

    // Create a FULLY MOCKED aggregate (don't use Factory to avoid complications)
    const mockAggregate = {
      id: einsatzId,
      nummer: overrides?.nummer ?? 'E2024-xyz789ab',
      alarmstichwort: overrides?.alarmstichwort ?? 'Wohnungsbrand',
      status: overrides?.status ?? EinsatzStatus.ANGELEGT(),
      createdBy,
      einsatzort: overrides?.einsatzort,
      bemerkung: overrides?.bemerkung,
      createdAt: overrides?.createdAt ?? new Date('2024-01-01T10:00:00Z'),
      updatedAt: overrides?.updatedAt ?? new Date('2024-01-01T10:00:00Z'),
      archivedAt: overrides?.archivedAt,
      abgeschlossenAt: undefined,
      getDomainEvents: jest.fn().mockReturnValue([]),
      clearDomainEvents: jest.fn(),
      update: jest.fn().mockReturnValue(Result.ok(undefined)),
      equals: jest.fn(),
    } as unknown as Einsatz;

    return mockAggregate;
  };

  /**
   * Helper: Erstellt Mock Prisma Einsatz Daten.
   */
  const createMockPrismaData = (overrides?: Partial<PrismaEinsatz>): PrismaEinsatz => {
    return {
      id: overrides?.id ?? mockEinsatzId,
      alarmstichwort: overrides?.alarmstichwort ?? 'Wohnungsbrand',
      einsatzort: overrides?.einsatzort ?? null,
      beschreibung: overrides?.beschreibung ?? null,
      status: overrides?.status ?? ('ANGELEGT' as PrismaEinsatzStatus),
      createdAt: overrides?.createdAt ?? new Date('2024-01-01T10:00:00Z'),
      updatedAt: overrides?.updatedAt ?? new Date('2024-01-01T10:00:00Z'),
      createdBy: overrides?.createdBy ?? mockUserId,
      updatedBy: overrides?.updatedBy ?? null,
      archivedAt: overrides?.archivedAt ?? null,
      archivedBy: overrides?.archivedBy ?? null,
      alarmierungszeit: overrides?.alarmierungszeit ?? null,
      einsatzleiter: overrides?.einsatzleiter ?? null,
      metadata: overrides?.metadata ?? null,
    };
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Create PrismaService Mock
    mockPrismaService = {
      einsatz: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrismaService)),
    } as unknown as jest.Mocked<PrismaService>;

    // Create OutboxRepository Mock
    mockOutboxRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PrismaOutboxRepository>;

    // Instantiate Repository
    repository = new PrismaEinsatzRepository(mockPrismaService, mockOutboxRepository);
  });

  describe('save()', () => {
    describe('Create-Fall (Neues Aggregate)', () => {
      it('sollte upsert aufrufen mit korrekten CREATE Daten', async () => {
        // Arrange
        const aggregate = createMockAggregate();
        const persistenceData = {
          id: mockEinsatzId,
          alarmstichwort: 'Wohnungsbrand',
          einsatzort: null,
          beschreibung: null,
          status: 'ANGELEGT',
          createdAt: aggregate.createdAt,
          updatedAt: aggregate.updatedAt,
          createdBy: mockUserId,
          updatedBy: null,
          archivedAt: null,
          archivedBy: null,
          alarmierungszeit: null,
          einsatzleiter: null,
          metadata: null,
        };

        jest.spyOn(PrismaEinsatzMapper, 'toPersistence').mockReturnValue(persistenceData);
        mockPrismaService.einsatz.upsert.mockResolvedValue(createMockPrismaData());

        // Act
        const result = await repository.save(aggregate);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(PrismaEinsatzMapper.toPersistence).toHaveBeenCalledWith(aggregate, mockUserId);
        expect(mockPrismaService.einsatz.upsert).toHaveBeenCalledWith({
          where: { id: mockEinsatzId },
          create: expect.objectContaining({
            id: mockEinsatzId,
            alarmstichwort: 'Wohnungsbrand',
            status: 'ANGELEGT',
            createdBy: mockUserId,
          }),
          update: expect.objectContaining({
            alarmstichwort: 'Wohnungsbrand',
            status: 'ANGELEGT',
            updatedBy: null,
          }),
        });
      });
    });

    describe('Update-Fall (Bestehendes Aggregate)', () => {
      it('sollte upsert aufrufen mit UPDATE Daten', async () => {
        // Arrange
        const aggregate = createMockAggregate({
          alarmstichwort: 'Großbrand',
          status: EinsatzStatus.IN_BEARBEITUNG(),
        });
        const persistenceData = {
          id: mockEinsatzId,
          alarmstichwort: 'Großbrand',
          einsatzort: null,
          beschreibung: null,
          status: 'IN_BEARBEITUNG',
          createdAt: aggregate.createdAt,
          updatedAt: new Date('2024-01-01T11:00:00Z'),
          createdBy: mockUserId,
          updatedBy: mockUserId,
          archivedAt: null,
          archivedBy: null,
          alarmierungszeit: null,
          einsatzleiter: null,
          metadata: null,
        };

        jest.spyOn(PrismaEinsatzMapper, 'toPersistence').mockReturnValue(persistenceData);
        mockPrismaService.einsatz.upsert.mockResolvedValue(
          createMockPrismaData({
            alarmstichwort: 'Großbrand',
            status: 'IN_BEARBEITUNG' as PrismaEinsatzStatus,
            updatedBy: mockUserId,
          }),
        );

        // Act
        const result = await repository.save(aggregate);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(mockPrismaService.einsatz.upsert).toHaveBeenCalledWith({
          where: { id: mockEinsatzId },
          create: expect.objectContaining({
            alarmstichwort: 'Großbrand',
            status: 'IN_BEARBEITUNG',
          }),
          update: expect.objectContaining({
            alarmstichwort: 'Großbrand',
            status: 'IN_BEARBEITUNG',
            updatedBy: mockUserId,
          }),
        });
      });
    });

    describe('Outbox Integration', () => {
      it('sollte Domain Events an OutboxRepository übergeben', async () => {
        // Arrange
        const aggregate = createMockAggregate();

        // Mock getDomainEvents to return a test event
        const mockEvent = {
          eventId: 'event_123',
          occurredAt: new Date(),
          aggregateId: mockEinsatzId,
        };
        (aggregate.getDomainEvents as jest.Mock).mockReturnValue([mockEvent]);

        jest.spyOn(PrismaEinsatzMapper, 'toPersistence').mockReturnValue({
          id: mockEinsatzId,
          alarmstichwort: 'Großbrand',
          einsatzort: null,
          beschreibung: null,
          status: 'ANGELEGT',
          createdAt: aggregate.createdAt,
          updatedAt: aggregate.updatedAt,
          createdBy: mockUserId,
          updatedBy: null,
          archivedAt: null,
          archivedBy: null,
          alarmierungszeit: null,
          einsatzleiter: null,
          metadata: null,
        });
        mockPrismaService.einsatz.upsert.mockResolvedValue(createMockPrismaData());

        // Act
        await repository.save(aggregate);

        // Assert
        expect(mockOutboxRepository.save).toHaveBeenCalledWith([mockEvent], mockPrismaService);
      });

      it('sollte clearDomainEvents() NUR NACH erfolgreicher Transaction aufrufen', async () => {
        // Arrange
        const aggregate = createMockAggregate();
        aggregate.update({ alarmstichwort: 'Großbrand' }); // Emittiert Event

        jest.spyOn(PrismaEinsatzMapper, 'toPersistence').mockReturnValue({
          id: mockEinsatzId,
          alarmstichwort: 'Großbrand',
          einsatzort: null,
          beschreibung: null,
          status: 'ANGELEGT',
          createdAt: aggregate.createdAt,
          updatedAt: aggregate.updatedAt,
          createdBy: mockUserId,
          updatedBy: null,
          archivedAt: null,
          archivedBy: null,
          alarmierungszeit: null,
          einsatzleiter: null,
          metadata: null,
        });
        mockPrismaService.einsatz.upsert.mockResolvedValue(createMockPrismaData());

        const clearSpy = jest.spyOn(aggregate, 'clearDomainEvents');

        // Act
        await repository.save(aggregate);

        // Assert
        expect(clearSpy).toHaveBeenCalledTimes(1);
        expect(aggregate.getDomainEvents()).toHaveLength(0);
      });
    });

    describe('Error Cases', () => {
      it('sollte Prisma Fehler als Promise.reject() propagieren', async () => {
        // Arrange
        const aggregate = createMockAggregate();
        jest.spyOn(PrismaEinsatzMapper, 'toPersistence').mockReturnValue({
          id: mockEinsatzId,
          alarmstichwort: 'Wohnungsbrand',
          einsatzort: null,
          beschreibung: null,
          status: 'ANGELEGT',
          createdAt: aggregate.createdAt,
          updatedAt: aggregate.updatedAt,
          createdBy: mockUserId,
          updatedBy: null,
          archivedAt: null,
          archivedBy: null,
          alarmierungszeit: null,
          einsatzleiter: null,
          metadata: null,
        });

        const dbError = new Error('Database connection failed');
        mockPrismaService.einsatz.upsert.mockRejectedValue(dbError);

        // Act & Assert
        await expect(repository.save(aggregate)).rejects.toThrow('Database connection failed');
      });

      it('sollte Outbox Fehler als Promise.reject() propagieren (Transaction Rollback)', async () => {
        // Arrange
        const aggregate = createMockAggregate();

        // Mock getDomainEvents to return a test event
        const mockEvent = { eventId: 'event_123', occurredAt: new Date(), aggregateId: mockEinsatzId };
        (aggregate.getDomainEvents as jest.Mock).mockReturnValue([mockEvent]);

        jest.spyOn(PrismaEinsatzMapper, 'toPersistence').mockReturnValue({
          id: mockEinsatzId,
          alarmstichwort: 'Großbrand',
          einsatzort: null,
          beschreibung: null,
          status: 'ANGELEGT',
          createdAt: aggregate.createdAt,
          updatedAt: aggregate.updatedAt,
          createdBy: mockUserId,
          updatedBy: null,
          archivedAt: null,
          archivedBy: null,
          alarmierungszeit: null,
          einsatzleiter: null,
          metadata: null,
        });
        mockPrismaService.einsatz.upsert.mockResolvedValue(createMockPrismaData());

        const outboxError = new Error('Outbox persistence failed');
        mockOutboxRepository.save.mockRejectedValue(outboxError);

        // Act & Assert
        await expect(repository.save(aggregate)).rejects.toThrow('Outbox persistence failed');
      });

      it('sollte clearDomainEvents() NICHT aufrufen bei Transaction Rollback', async () => {
        // Arrange
        const aggregate = createMockAggregate();

        // Mock getDomainEvents to return a test event
        const mockEvent = { eventId: 'event_456', occurredAt: new Date(), aggregateId: mockEinsatzId };
        (aggregate.getDomainEvents as jest.Mock).mockReturnValue([mockEvent]);

        jest.spyOn(PrismaEinsatzMapper, 'toPersistence').mockReturnValue({
          id: mockEinsatzId,
          alarmstichwort: 'Großbrand',
          einsatzort: null,
          beschreibung: null,
          status: 'ANGELEGT',
          createdAt: aggregate.createdAt,
          updatedAt: aggregate.updatedAt,
          createdBy: mockUserId,
          updatedBy: null,
          archivedAt: null,
          archivedBy: null,
          alarmierungszeit: null,
          einsatzleiter: null,
          metadata: null,
        });

        const dbError = new Error('Database error');
        mockPrismaService.einsatz.upsert.mockRejectedValue(dbError);

        const clearSpy = jest.spyOn(aggregate, 'clearDomainEvents');

        // Act
        try {
          await repository.save(aggregate);
        } catch {
          // Expected error
        }

        // Assert
        expect(clearSpy).not.toHaveBeenCalled();
        expect(aggregate.getDomainEvents()).toHaveLength(1); // Event bleibt erhalten
      });
    });
  });

  describe('findById()', () => {
    it('sollte Aggregate zurückgeben wenn gefunden', async () => {
      // Arrange
      const prismaData = createMockPrismaData();
      const mockAggregate = createMockAggregate();

      mockPrismaService.einsatz.findUnique.mockResolvedValue(prismaData);
      jest.spyOn(PrismaEinsatzMapper, 'toAggregate').mockReturnValue(mockAggregate);

      // Use mock object with .value property
      const einsatzId = { value: mockEinsatzId } as EinsatzId;

      // Act
      const result = await repository.findById(einsatzId);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(mockAggregate);
      expect(mockPrismaService.einsatz.findUnique).toHaveBeenCalledWith({
        where: { id: mockEinsatzId },
      });
      expect(PrismaEinsatzMapper.toAggregate).toHaveBeenCalledWith(prismaData);
    });

    it('sollte Result.ok(null) zurückgeben wenn nicht gefunden', async () => {
      // Arrange
      mockPrismaService.einsatz.findUnique.mockResolvedValue(null);

      // Use mock object with .value property
      const einsatzId = { value: mockEinsatzId } as EinsatzId;

      // Act
      const result = await repository.findById(einsatzId);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('sollte Result.fail() zurückgeben bei DB Fehler', async () => {
      // Arrange
      const dbError = new Error('Connection timeout');
      mockPrismaService.einsatz.findUnique.mockRejectedValue(dbError);

      // Use mock object with .value property
      const einsatzId = { value: mockEinsatzId } as EinsatzId;

      // Act
      const result = await repository.findById(einsatzId);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error');
      expect(result.error).toContain('Connection timeout');
    });
  });

  describe('findByNummer()', () => {
    it('sollte Aggregate zurückgeben wenn gefunden', async () => {
      // Arrange
      const nummer = 'E2024-xyz789ab';
      const prismaData = createMockPrismaData({ id: 'xyz789abcdefghijklmnopqrst' });
      const mockAggregate = createMockAggregate({ nummer });

      mockPrismaService.einsatz.findMany.mockResolvedValue([prismaData]);
      jest.spyOn(PrismaEinsatzMapper, 'toAggregate').mockReturnValue(mockAggregate);

      // Act
      const result = await repository.findByNummer(nummer);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(mockAggregate);
      expect(mockPrismaService.einsatz.findMany).toHaveBeenCalledWith({
        where: { id: { startsWith: 'xyz789ab' } },
        take: 1,
      });
    });

    it('sollte Result.ok(null) zurückgeben wenn nicht gefunden', async () => {
      // Arrange
      const nummer = 'E2024-notfound';
      mockPrismaService.einsatz.findMany.mockResolvedValue([]);

      // Act
      const result = await repository.findByNummer(nummer);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('sollte Result.ok(null) zurückgeben bei ungültigem nummer Format', async () => {
      // Arrange
      const invalidNummer = 'INVALID-FORMAT';

      // Act
      const result = await repository.findByNummer(invalidNummer);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
      expect(mockPrismaService.einsatz.findMany).not.toHaveBeenCalled();
    });

    it('sollte Result.ok(null) zurückgeben wenn rekonstruierte nummer nicht übereinstimmt', async () => {
      // Arrange
      const nummer = 'E2024-xyz789ab';
      const prismaData = createMockPrismaData({ id: 'xyz789abcdefghijklmnopqrst' });
      const mockAggregate = createMockAggregate({ nummer: 'E2024-different' }); // Unterschiedliche nummer

      mockPrismaService.einsatz.findMany.mockResolvedValue([prismaData]);
      jest.spyOn(PrismaEinsatzMapper, 'toAggregate').mockReturnValue(mockAggregate);

      // Act
      const result = await repository.findByNummer(nummer);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('sollte Result.fail() zurückgeben bei DB Fehler', async () => {
      // Arrange
      const nummer = 'E2024-xyz789ab';
      const dbError = new Error('Query timeout');
      mockPrismaService.einsatz.findMany.mockRejectedValue(dbError);

      // Act
      const result = await repository.findByNummer(nummer);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error');
      expect(result.error).toContain('Query timeout');
    });
  });

  describe('findActive()', () => {
    it('sollte mehrere Aggregates zurückgeben', async () => {
      // Arrange
      const prismaData1 = createMockPrismaData({ id: 'einsatz_1', alarmstichwort: 'Brand' });
      const prismaData2 = createMockPrismaData({
        id: 'einsatz_2',
        alarmstichwort: 'Unfall',
        status: 'IN_BEARBEITUNG' as PrismaEinsatzStatus,
      });
      const prismaData3 = createMockPrismaData({
        id: 'einsatz_3',
        alarmstichwort: 'Rettung',
        status: 'ABGESCHLOSSEN' as PrismaEinsatzStatus,
      });

      const mockAggregate1 = createMockAggregate({ id: 'einsatz_1', alarmstichwort: 'Brand' });
      const mockAggregate2 = createMockAggregate({
        id: 'einsatz_2',
        alarmstichwort: 'Unfall',
        status: EinsatzStatus.IN_BEARBEITUNG(),
      });
      const mockAggregate3 = createMockAggregate({
        id: 'einsatz_3',
        alarmstichwort: 'Rettung',
        status: EinsatzStatus.ABGESCHLOSSEN(),
      });

      mockPrismaService.einsatz.findMany.mockResolvedValue([prismaData1, prismaData2, prismaData3]);

      const toAggregateSpy = jest.spyOn(PrismaEinsatzMapper, 'toAggregate');
      toAggregateSpy.mockReturnValueOnce(mockAggregate1).mockReturnValueOnce(mockAggregate2).mockReturnValueOnce(mockAggregate3);

      // Act
      const result = await repository.findActive();

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(3);
      expect(result.value).toEqual([mockAggregate1, mockAggregate2, mockAggregate3]);
      expect(mockPrismaService.einsatz.findMany).toHaveBeenCalledWith({
        where: { status: { not: 'ARCHIVIERT' } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('sollte leeres Array zurückgeben wenn keine aktiven Einsätze', async () => {
      // Arrange
      mockPrismaService.einsatz.findMany.mockResolvedValue([]);

      // Act
      const result = await repository.findActive();

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
    });

    it('sollte archivierte Einsätze ausfiltern', async () => {
      // Arrange
      const prismaData1 = createMockPrismaData({ id: 'einsatz_1', status: 'ANGELEGT' as PrismaEinsatzStatus });
      const mockAggregate1 = createMockAggregate({ id: 'einsatz_1' });

      // Archivierter Einsatz wird von DB nicht zurückgegeben (WHERE filter)
      mockPrismaService.einsatz.findMany.mockResolvedValue([prismaData1]);
      jest.spyOn(PrismaEinsatzMapper, 'toAggregate').mockReturnValue(mockAggregate1);

      // Act
      const result = await repository.findActive();

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(mockPrismaService.einsatz.findMany).toHaveBeenCalledWith({
        where: { status: { not: 'ARCHIVIERT' } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('sollte Result.fail() zurückgeben bei DB Fehler', async () => {
      // Arrange
      const dbError = new Error('Query failed');
      mockPrismaService.einsatz.findMany.mockRejectedValue(dbError);

      // Act
      const result = await repository.findActive();

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error');
      expect(result.error).toContain('Query failed');
    });
  });

  describe('exists()', () => {
    it('sollte true zurückgeben wenn count > 0', async () => {
      // Arrange
      mockPrismaService.einsatz.count.mockResolvedValue(1);

      // Use mock object with .value property
      const einsatzId = { value: mockEinsatzId } as EinsatzId;

      // Act
      const result = await repository.exists(einsatzId);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(true);
      expect(mockPrismaService.einsatz.count).toHaveBeenCalledWith({
        where: { id: mockEinsatzId },
      });
    });

    it('sollte false zurückgeben wenn count === 0', async () => {
      // Arrange
      mockPrismaService.einsatz.count.mockResolvedValue(0);

      // Use mock object with .value property
      const einsatzId = { value: mockEinsatzId } as EinsatzId;

      // Act
      const result = await repository.exists(einsatzId);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(false);
    });

    it('sollte Result.fail() zurückgeben bei DB Fehler', async () => {
      // Arrange
      const dbError = new Error('Count query failed');
      mockPrismaService.einsatz.count.mockRejectedValue(dbError);

      // Use mock object with .value property
      const einsatzId = { value: mockEinsatzId } as EinsatzId;

      // Act
      const result = await repository.exists(einsatzId);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error');
      expect(result.error).toContain('Count query failed');
    });
  });

  describe('findEligibleForArchival()', () => {
    it('sollte Einsaetze mit status ABGESCHLOSSEN aelter als threshold zurueckgeben', async () => {
      // Given (Arrange)
      const olderThan = new Date('2015-01-01T00:00:00Z');

      const prismaData1 = createMockPrismaData({
        id: 'einsatz_old_1',
        status: 'ABGESCHLOSSEN' as PrismaEinsatzStatus,
        createdAt: new Date('2014-01-01T10:00:00Z'),
        updatedAt: new Date('2014-06-15T14:00:00Z'),
      });

      const prismaData2 = createMockPrismaData({
        id: 'einsatz_old_2',
        status: 'ABGESCHLOSSEN' as PrismaEinsatzStatus,
        createdAt: new Date('2013-03-10T08:00:00Z'),
        updatedAt: new Date('2013-12-20T16:30:00Z'),
      });

      const mockAggregate1 = createMockAggregate({
        id: 'einsatz_old_1',
        status: EinsatzStatus.ABGESCHLOSSEN(),
        createdAt: new Date('2014-01-01T10:00:00Z'),
      });

      const mockAggregate2 = createMockAggregate({
        id: 'einsatz_old_2',
        status: EinsatzStatus.ABGESCHLOSSEN(),
        createdAt: new Date('2013-03-10T08:00:00Z'),
      });

      mockPrismaService.einsatz.findMany.mockResolvedValue([prismaData2, prismaData1]); // Sortiert: aelteste zuerst

      const toAggregateSpy = jest.spyOn(PrismaEinsatzMapper, 'toAggregate');
      toAggregateSpy.mockReturnValueOnce(mockAggregate2).mockReturnValueOnce(mockAggregate1);

      // When (Act)
      const result = await repository.findEligibleForArchival(olderThan);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(2);
      expect(result.value).toEqual([mockAggregate2, mockAggregate1]);

      expect(mockPrismaService.einsatz.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ABGESCHLOSSEN',
          createdAt: { lte: olderThan },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('sollte leeres Array zurueckgeben wenn keine eligible Einsaetze existieren', async () => {
      // Given (Arrange)
      const olderThan = new Date('2025-01-01T00:00:00Z'); // Future date
      mockPrismaService.einsatz.findMany.mockResolvedValue([]);

      // When (Act)
      const result = await repository.findEligibleForArchival(olderThan);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
      expect(mockPrismaService.einsatz.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ABGESCHLOSSEN',
          createdAt: { lte: olderThan },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('sollte NUR Einsaetze mit status ABGESCHLOSSEN zurueckgeben (nicht ANGELEGT, IN_BEARBEITUNG, ARCHIVIERT)', async () => {
      // Given (Arrange)
      const olderThan = new Date('2015-01-01T00:00:00Z');

      // NUR abgeschlossene Einsaetze werden von DB zurueckgegeben (WHERE filter)
      const prismaData = createMockPrismaData({
        id: 'einsatz_abgeschlossen',
        status: 'ABGESCHLOSSEN' as PrismaEinsatzStatus,
      });

      const mockAggregate = createMockAggregate({
        id: 'einsatz_abgeschlossen',
        status: EinsatzStatus.ABGESCHLOSSEN(),
      });

      mockPrismaService.einsatz.findMany.mockResolvedValue([prismaData]);
      jest.spyOn(PrismaEinsatzMapper, 'toAggregate').mockReturnValue(mockAggregate);

      // When (Act)
      const result = await repository.findEligibleForArchival(olderThan);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);

      // Verify WHERE clause: NUR status ABGESCHLOSSEN
      expect(mockPrismaService.einsatz.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ABGESCHLOSSEN',
          createdAt: { lte: olderThan },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('sollte Result.fail() zurueckgeben bei DB Fehler', async () => {
      // Given (Arrange)
      const olderThan = new Date('2015-01-01T00:00:00Z');
      const dbError = new Error('DB connection failed');
      mockPrismaService.einsatz.findMany.mockRejectedValue(dbError);

      // When (Act)
      const result = await repository.findEligibleForArchival(olderThan);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error');
      expect(result.error).toContain('DB connection failed');
    });

    it('sollte Einsaetze nach createdAt ASC sortieren (aelteste zuerst)', async () => {
      // Given (Arrange)
      const olderThan = new Date('2015-01-01T00:00:00Z');

      const prismaDataOldest = createMockPrismaData({
        id: 'einsatz_oldest',
        status: 'ABGESCHLOSSEN' as PrismaEinsatzStatus,
        createdAt: new Date('2012-01-01T10:00:00Z'),
      });

      const prismaDataNewer = createMockPrismaData({
        id: 'einsatz_newer',
        status: 'ABGESCHLOSSEN' as PrismaEinsatzStatus,
        createdAt: new Date('2014-06-15T14:00:00Z'),
      });

      // Mock returns in ASCENDING order (oldest first)
      mockPrismaService.einsatz.findMany.mockResolvedValue([prismaDataOldest, prismaDataNewer]);

      const mockAggregateOldest = createMockAggregate({
        id: 'einsatz_oldest',
        status: EinsatzStatus.ABGESCHLOSSEN(),
        createdAt: new Date('2012-01-01T10:00:00Z'),
      });

      const mockAggregateNewer = createMockAggregate({
        id: 'einsatz_newer',
        status: EinsatzStatus.ABGESCHLOSSEN(),
        createdAt: new Date('2014-06-15T14:00:00Z'),
      });

      const toAggregateSpy = jest.spyOn(PrismaEinsatzMapper, 'toAggregate');
      toAggregateSpy.mockReturnValueOnce(mockAggregateOldest).mockReturnValueOnce(mockAggregateNewer);

      // When (Act)
      const result = await repository.findEligibleForArchival(olderThan);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value[0]?.id.value).toBe('einsatz_oldest');
      expect(result.value[1]?.id.value).toBe('einsatz_newer');

      // Verify ORDER BY clause
      expect(mockPrismaService.einsatz.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ABGESCHLOSSEN',
          createdAt: { lte: olderThan },
        },
        orderBy: { createdAt: 'asc' },
      });
    });
  });
});
