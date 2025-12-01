import type { PrismaService } from '@/prisma/prisma.service';
import { PrismaEinsatzRepositoryAdapter } from '../prisma-einsatz.repository';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import type { PrismaTransaction } from '@/infrastructure/outbox/prisma-outbox.repository';
import { EinsatzStatus as PrismaEinsatzStatus } from '@prisma/client';

/**
 * Unit Tests für PrismaEinsatzRepositoryAdapter.save() Method.
 *
 * Diese Tests validieren Subtask 1.4 von Story 0-1:
 * - save() ohne Transaction Parameter (nutzt this.prisma)
 * - save() mit Transaction Parameter (nutzt tx)
 * - Domain Aggregate → Prisma Model Mapping
 * - Error Handling (DB Connection Failed, etc.)
 *
 * **Test Strategy:**
 * - Mocking: PrismaService wird vollständig gemockt
 * - AAA Pattern: Arrange → Act → Assert
 * - Mock Reset: beforeEach() cleared alle Mocks
 *
 * **Acceptance Criteria (AC2.1, AC2.2, AC2.3):**
 * - AC2.1: save() accepts optional `PrismaTransaction` parameter
 * - AC2.2: save() uses provided transaction context when available
 * - AC2.3: Repository exposes ONLY persistence methods - NO event handling
 */
describe('PrismaEinsatzRepositoryAdapter.save()', () => {
  let repository: PrismaEinsatzRepositoryAdapter;
  let mockPrismaService: jest.Mocked<PrismaService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create PrismaService Mock
    mockPrismaService = {
      einsatz: {
        upsert: jest.fn(),
        count: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    // Instantiate Repository (NO OutboxRepository - AC2.3!)
    repository = new PrismaEinsatzRepositoryAdapter(mockPrismaService);
  });

  describe('AC2.1 - save() accepts optional PrismaTransaction parameter', () => {
    it('sollte save() ohne tx Parameter aufrufen koennen', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const einsatzResult = Einsatz.create({
        alarmstichwort: 'Wohnungsbrand',
        createdBy: userId,
      });
      expect(einsatzResult.isSuccess).toBe(true);
      const einsatz = einsatzResult.value!;

      mockPrismaService.einsatz.upsert.mockResolvedValue({
        id: einsatz.id.value,
        alarmstichwort: 'Wohnungsbrand',
        einsatzort: null,
        beschreibung: null,
        status: 'ANGELEGT' as PrismaEinsatzStatus,
        createdAt: einsatz.createdAt,
        updatedAt: einsatz.updatedAt,
        createdBy: userId.value,
        updatedBy: userId.value,
        archivedAt: null,
        archivedBy: null,
        alarmierungszeit: null,
        einsatzleiter: null,
        metadata: null,
      });

      // Act
      const result = await repository.save(einsatz); // NO tx parameter

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(mockPrismaService.einsatz.upsert).toHaveBeenCalledTimes(1);
    });

    it('sollte save() mit tx Parameter aufrufen koennen', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const einsatzResult = Einsatz.create({
        alarmstichwort: 'Wohnungsbrand',
        createdBy: userId,
      });
      expect(einsatzResult.isSuccess).toBe(true);
      const einsatz = einsatzResult.value!;

      // Mock Transaction Client
      const mockTx = {
        einsatz: {
          upsert: jest.fn().mockResolvedValue({
            id: einsatz.id.value,
            alarmstichwort: 'Wohnungsbrand',
            einsatzort: null,
            beschreibung: null,
            status: 'ANGELEGT' as PrismaEinsatzStatus,
            createdAt: einsatz.createdAt,
            updatedAt: einsatz.updatedAt,
            createdBy: userId.value,
            updatedBy: userId.value,
            archivedAt: null,
            archivedBy: null,
            alarmierungszeit: null,
            einsatzleiter: null,
            metadata: null,
          }),
        },
      } as unknown as PrismaTransaction;

      // Act
      const result = await repository.save(einsatz, mockTx); // WITH tx parameter

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(mockTx.einsatz.upsert).toHaveBeenCalledTimes(1);
      // Standard prisma.einsatz.upsert should NOT be called
      expect(mockPrismaService.einsatz.upsert).not.toHaveBeenCalled();
    });
  });

  describe('AC2.2 - save() uses provided transaction context when available', () => {
    it('sollte this.prisma nutzen wenn tx NICHT vorhanden', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const einsatzResult = Einsatz.create({
        alarmstichwort: 'Grossbrand',
        createdBy: userId,
      });
      const einsatz = einsatzResult.value!;

      mockPrismaService.einsatz.upsert.mockResolvedValue({
        id: einsatz.id.value,
        alarmstichwort: 'Grossbrand',
        einsatzort: null,
        beschreibung: null,
        status: 'ANGELEGT' as PrismaEinsatzStatus,
        createdAt: einsatz.createdAt,
        updatedAt: einsatz.updatedAt,
        createdBy: userId.value,
        updatedBy: userId.value,
        archivedAt: null,
        archivedBy: null,
        alarmierungszeit: null,
        einsatzleiter: null,
        metadata: null,
      });

      // Act
      await repository.save(einsatz); // NO tx

      // Assert: Standard PrismaService wurde verwendet
      expect(mockPrismaService.einsatz.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.einsatz.upsert).toHaveBeenCalledWith({
        where: { id: einsatz.id.value },
        create: expect.objectContaining({
          id: einsatz.id.value,
          alarmstichwort: 'Grossbrand',
          status: PrismaEinsatzStatus.ANGELEGT,
        }),
        update: expect.objectContaining({
          alarmstichwort: 'Grossbrand',
          status: PrismaEinsatzStatus.ANGELEGT,
        }),
      });
    });

    it('sollte tx Client nutzen wenn tx vorhanden', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const einsatzResult = Einsatz.create({
        alarmstichwort: 'Verkehrsunfall',
        createdBy: userId,
      });
      const einsatz = einsatzResult.value!;

      // Mock Transaction Client
      const mockTx = {
        einsatz: {
          upsert: jest.fn().mockResolvedValue({
            id: einsatz.id.value,
            alarmstichwort: 'Verkehrsunfall',
            einsatzort: null,
            beschreibung: null,
            status: 'ANGELEGT' as PrismaEinsatzStatus,
            createdAt: einsatz.createdAt,
            updatedAt: einsatz.updatedAt,
            createdBy: userId.value,
            updatedBy: userId.value,
            archivedAt: null,
            archivedBy: null,
            alarmierungszeit: null,
            einsatzleiter: null,
            metadata: null,
          }),
        },
      } as unknown as PrismaTransaction;

      // Act
      await repository.save(einsatz, mockTx); // WITH tx

      // Assert: Transaction Client wurde verwendet
      expect(mockTx.einsatz.upsert).toHaveBeenCalledTimes(1);
      expect(mockTx.einsatz.upsert).toHaveBeenCalledWith({
        where: { id: einsatz.id.value },
        create: expect.objectContaining({
          id: einsatz.id.value,
          alarmstichwort: 'Verkehrsunfall',
          status: PrismaEinsatzStatus.ANGELEGT,
        }),
        update: expect.objectContaining({
          alarmstichwort: 'Verkehrsunfall',
          status: PrismaEinsatzStatus.ANGELEGT,
        }),
      });

      // Assert: Standard PrismaService wurde NICHT verwendet
      expect(mockPrismaService.einsatz.upsert).not.toHaveBeenCalled();
    });
  });

  describe('AC2.3 - Repository exposes ONLY persistence methods - NO event handling', () => {
    it('sollte KEINE Event-Serialisierung/Publishing im Repository durchfuehren', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const einsatzResult = Einsatz.create({
        alarmstichwort: 'Rettung',
        createdBy: userId,
      });
      const einsatz = einsatzResult.value!;

      // Verify Aggregate has Domain Events
      const events = einsatz.getDomainEvents();
      expect(events.length).toBeGreaterThan(0);

      mockPrismaService.einsatz.upsert.mockResolvedValue({
        id: einsatz.id.value,
        alarmstichwort: 'Rettung',
        einsatzort: null,
        beschreibung: null,
        status: 'ANGELEGT' as PrismaEinsatzStatus,
        createdAt: einsatz.createdAt,
        updatedAt: einsatz.updatedAt,
        createdBy: userId.value,
        updatedBy: userId.value,
        archivedAt: null,
        archivedBy: null,
        alarmierungszeit: null,
        einsatzleiter: null,
        metadata: null,
      });

      // Act
      await repository.save(einsatz);

      // Assert: Domain Events bleiben im Aggregate (Repository loescht sie NICHT)
      const eventsAfterSave = einsatz.getDomainEvents();
      expect(eventsAfterSave.length).toBe(events.length);

      // Assert: Repository hat NUR persistence operations durchgefuehrt
      expect(mockPrismaService.einsatz.upsert).toHaveBeenCalledTimes(1);
      // Keine Outbox-Calls, keine Event-Serialization, etc.
    });
  });

  describe('Domain Aggregate → Prisma Model Mapping', () => {
    it('sollte Einsatz Status korrekt mappen', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const einsatzResult = Einsatz.create({
        alarmstichwort: 'Test',
        createdBy: userId,
      });
      const einsatz = einsatzResult.value!;

      // Transition zu IN_BEARBEITUNG
      const statusResult = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
      expect(statusResult.isSuccess).toBe(true);

      mockPrismaService.einsatz.upsert.mockResolvedValue({
        id: einsatz.id.value,
        alarmstichwort: 'Test',
        einsatzort: null,
        beschreibung: null,
        status: 'IN_BEARBEITUNG' as PrismaEinsatzStatus,
        createdAt: einsatz.createdAt,
        updatedAt: einsatz.updatedAt,
        createdBy: userId.value,
        updatedBy: userId.value,
        archivedAt: null,
        archivedBy: null,
        alarmierungszeit: null,
        einsatzleiter: null,
        metadata: null,
      });

      // Act
      await repository.save(einsatz);

      // Assert
      expect(mockPrismaService.einsatz.upsert).toHaveBeenCalledWith({
        where: { id: einsatz.id.value },
        create: expect.objectContaining({
          status: PrismaEinsatzStatus.IN_BEARBEITUNG,
        }),
        update: expect.objectContaining({
          status: PrismaEinsatzStatus.IN_BEARBEITUNG,
        }),
      });
    });

    it('sollte bemerkung als beschreibung mappen', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const einsatzResult = Einsatz.create({
        alarmstichwort: 'Test',
        createdBy: userId,
        bemerkung: 'Wichtige Bemerkung',
      });
      const einsatz = einsatzResult.value!;

      mockPrismaService.einsatz.upsert.mockResolvedValue({
        id: einsatz.id.value,
        alarmstichwort: 'Test',
        einsatzort: null,
        beschreibung: 'Wichtige Bemerkung',
        status: 'ANGELEGT' as PrismaEinsatzStatus,
        createdAt: einsatz.createdAt,
        updatedAt: einsatz.updatedAt,
        createdBy: userId.value,
        updatedBy: userId.value,
        archivedAt: null,
        archivedBy: null,
        alarmierungszeit: null,
        einsatzleiter: null,
        metadata: null,
      });

      // Act
      await repository.save(einsatz);

      // Assert
      expect(mockPrismaService.einsatz.upsert).toHaveBeenCalledWith({
        where: { id: einsatz.id.value },
        create: expect.objectContaining({
          beschreibung: 'Wichtige Bemerkung',
        }),
        update: expect.objectContaining({
          beschreibung: 'Wichtige Bemerkung',
        }),
      });
    });

    it('sollte archivedAt korrekt setzen wenn archiviert', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const einsatzResult = Einsatz.create({
        alarmstichwort: 'Test',
        createdBy: userId,
      });
      const einsatz = einsatzResult.value!;

      // Archive Einsatz
      const archiveResult = einsatz.archive(userId);
      expect(archiveResult.isSuccess).toBe(true);

      mockPrismaService.einsatz.upsert.mockResolvedValue({
        id: einsatz.id.value,
        alarmstichwort: 'Test',
        einsatzort: null,
        beschreibung: null,
        status: 'ARCHIVIERT' as PrismaEinsatzStatus,
        createdAt: einsatz.createdAt,
        updatedAt: einsatz.updatedAt,
        createdBy: userId.value,
        updatedBy: userId.value,
        archivedAt: einsatz.archivedAt!,
        archivedBy: userId.value,
        alarmierungszeit: null,
        einsatzleiter: null,
        metadata: null,
      });

      // Act
      await repository.save(einsatz);

      // Assert
      expect(mockPrismaService.einsatz.upsert).toHaveBeenCalledWith({
        where: { id: einsatz.id.value },
        create: expect.objectContaining({
          status: PrismaEinsatzStatus.ARCHIVIERT,
          archivedAt: expect.any(Date),
          archivedBy: userId.value,
        }),
        update: expect.objectContaining({
          status: PrismaEinsatzStatus.ARCHIVIERT,
          archivedAt: expect.any(Date),
          archivedBy: userId.value,
        }),
      });
    });
  });

  describe('Error Handling', () => {
    it('sollte Result.fail() zurueckgeben bei DB Fehler', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const einsatzResult = Einsatz.create({
        alarmstichwort: 'Test',
        createdBy: userId,
      });
      const einsatz = einsatzResult.value!;

      const dbError = new Error('Database connection failed');
      mockPrismaService.einsatz.upsert.mockRejectedValue(dbError);

      // Act
      const result = await repository.save(einsatz);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error');
      expect(result.error).toContain('Database connection failed');
    });

    it('sollte Result.fail() zurueckgeben bei Transaction Client Fehler', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const einsatzResult = Einsatz.create({
        alarmstichwort: 'Test',
        createdBy: userId,
      });
      const einsatz = einsatzResult.value!;

      const txError = new Error('Transaction aborted');
      const mockTx = {
        einsatz: {
          upsert: jest.fn().mockRejectedValue(txError),
        },
      } as unknown as PrismaTransaction;

      // Act
      const result = await repository.save(einsatz, mockTx);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error');
      expect(result.error).toContain('Transaction aborted');
    });
  });

  describe('exists() - Baseline Test (pre-existing method)', () => {
    it('sollte true zurueckgeben wenn Einsatz existiert', async () => {
      // Arrange
      const einsatzId = EinsatzId.create().value!;
      mockPrismaService.einsatz.count.mockResolvedValue(1);

      // Act
      const result = await repository.exists(einsatzId);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(true);
      expect(mockPrismaService.einsatz.count).toHaveBeenCalledWith({
        where: { id: einsatzId.value },
      });
    });

    it('sollte false zurueckgeben wenn Einsatz nicht existiert', async () => {
      // Arrange
      const einsatzId = EinsatzId.create().value!;
      mockPrismaService.einsatz.count.mockResolvedValue(0);

      // Act
      const result = await repository.exists(einsatzId);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(false);
    });
  });
});
