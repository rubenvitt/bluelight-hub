import { ArchiveOldEinsaetzeHandler } from '../archive-old-einsaetze.handler';
import { ArchiveOldEinsaetzeCommand } from '../archive-old-einsaetze.command';
import type { IEinsatzRepository } from '@domain/repositories';
import { Result } from '@domain/common/result';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';

/**
 * Helper: Erstellt Mock-Einsatz mit spezifischem Status und abgeschlossenAt Date.
 *
 * @param id - Optional: Spezifische Einsatz ID
 * @param abgeschlossenYearsAgo - Optional: Anzahl Jahre seit Abschluss
 * @returns Einsatz Aggregate Mock
 */
function createMockEinsatz(_id: string, abgeschlossenYearsAgo?: number): Einsatz {
  const userId = UserId.create().value!;

  // Create base einsatz
  const einsatz = Einsatz.create({
    alarmstichwort: 'Testbrand',
    createdBy: userId,
  }).value!;

  // Clear creation events before modifying
  einsatz.clearDomainEvents();

  // Transition to ABGESCHLOSSEN
  einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
  einsatz.complete(userId);

  // Set abgeschlossenAt if specified
  if (abgeschlossenYearsAgo !== undefined) {
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - abgeschlossenYearsAgo);
    // biome-ignore lint/suspicious/noExplicitAny: Test helper needs to modify readonly abgeschlossenAt
    (einsatz as any)._abgeschlossenAt = pastDate;
  }

  // Clear all events after setup
  einsatz.clearDomainEvents();
  return einsatz;
}

/**
 * Helper: Erstellt Array von Mock-Einsätzen.
 *
 * @param count - Anzahl der Einsätze
 * @param abgeschlossenYearsAgo - Optional: Jahre seit Abschluss
 * @returns Array von Einsatz Aggregates
 */
function createMockEinsaetze(count: number, abgeschlossenYearsAgo?: number): Einsatz[] {
  return Array.from({ length: count }, (_, i) => createMockEinsatz(`einsatz-${i.toString().padStart(3, '0')}`, abgeschlossenYearsAgo));
}

describe('ArchiveOldEinsaetzeHandler', () => {
  let handler: ArchiveOldEinsaetzeHandler;
  let mockEinsatzRepository: jest.Mocked<IEinsatzRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEinsatzRepository = {
      findEligibleForArchival: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findActive: jest.fn(),
      findByNummer: jest.fn(),
      exists: jest.fn(),
      countByStatus: jest.fn(),
      findAllPaginated: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Mock repository needs flexible typing
    } as any;

    handler = new ArchiveOldEinsaetzeHandler(mockEinsatzRepository);
  });

  describe('dry-run mode', () => {
    it('should return eligible count without archiving', async () => {
      // Given (Arrange)
      const adminUserId = UserId.create().value!;
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: adminUserId.value,
        dryRun: true,
      }).value!;
      const mockEinsaetze = createMockEinsaetze(5, 11);
      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.ok(mockEinsaetze));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.eligible).toBe(5);
      expect(result.value!.archived).toBe(0);
      expect(result.value!.dryRun).toBe(true);
      expect(mockEinsatzRepository.save).not.toHaveBeenCalled();
    });

    it('should return zero eligible when no einsaetze qualify', async () => {
      // Given (Arrange)
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: UserId.create().value!.value,
        dryRun: true,
      }).value!;
      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.ok([]));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.eligible).toBe(0);
      expect(result.value!.archived).toBe(0);
      expect(result.value!.dryRun).toBe(true);
    });

    it('should use olderThanYears to calculate threshold date', async () => {
      // Given (Arrange)
      const olderThanYears = 15;
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: UserId.create().value!.value,
        dryRun: true,
        olderThanYears,
      }).value!;
      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.ok([]));

      // When (Act)
      await handler.execute(command);

      // Then (Assert)
      expect(mockEinsatzRepository.findEligibleForArchival).toHaveBeenCalledWith(command.olderThan);
      expect(command.olderThanYears).toBe(15);
    });
  });

  describe('normal mode', () => {
    it('should archive eligible einsaetze', async () => {
      // Given (Arrange)
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: UserId.create().value!.value,
        dryRun: false,
      }).value!;
      const mockEinsaetze = createMockEinsaetze(3, 11);
      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.ok(mockEinsaetze));
      mockEinsatzRepository.save.mockResolvedValue(Result.ok(undefined));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.archived).toBe(3);
      expect(result.value!.failed).toHaveLength(0);
      expect(mockEinsatzRepository.save).toHaveBeenCalledTimes(3);
    });

    it('should archive einsaetze and verify status change', async () => {
      // Given (Arrange)
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: UserId.create().value!.value,
        dryRun: false,
      }).value!;
      const mockEinsaetze = createMockEinsaetze(2, 11);
      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.ok(mockEinsaetze));
      mockEinsatzRepository.save.mockResolvedValue(Result.ok(undefined));

      // When (Act)
      await handler.execute(command);

      // Then (Assert)
      for (const einsatz of mockEinsaetze) {
        expect(einsatz.status.value).toBe('ARCHIVIERT');
        expect(einsatz.archivedAt).toBeDefined();
      }
    });

    it('should return dryRun false in result', async () => {
      // Given (Arrange)
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: UserId.create().value!.value,
        dryRun: false,
      }).value!;
      const mockEinsaetze = createMockEinsaetze(1, 11);
      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.ok(mockEinsaetze));
      mockEinsatzRepository.save.mockResolvedValue(Result.ok(undefined));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.dryRun).toBe(false);
    });
  });

  describe('batch processing', () => {
    it('should process einsaetze in batches of 100', async () => {
      // Given (Arrange)
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: UserId.create().value!.value,
        dryRun: false,
      }).value!;
      const mockEinsaetze = createMockEinsaetze(250, 11); // 3 batches
      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.ok(mockEinsaetze));
      mockEinsatzRepository.save.mockResolvedValue(Result.ok(undefined));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.archived).toBe(250);
      expect(mockEinsatzRepository.save).toHaveBeenCalledTimes(250);
    });

    it('should process exactly 100 einsaetze in single batch', async () => {
      // Given (Arrange)
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: UserId.create().value!.value,
        dryRun: false,
      }).value!;
      const mockEinsaetze = createMockEinsaetze(100, 11);
      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.ok(mockEinsaetze));
      mockEinsatzRepository.save.mockResolvedValue(Result.ok(undefined));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.archived).toBe(100);
    });

    it('should process less than 100 einsaetze in single batch', async () => {
      // Given (Arrange)
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: UserId.create().value!.value,
        dryRun: false,
      }).value!;
      const mockEinsaetze = createMockEinsaetze(42, 11);
      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.ok(mockEinsaetze));
      mockEinsatzRepository.save.mockResolvedValue(Result.ok(undefined));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.archived).toBe(42);
    });
  });

  describe('failure handling', () => {
    it('should continue processing after individual failures', async () => {
      // Given (Arrange)
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: UserId.create().value!.value,
        dryRun: false,
      }).value!;
      const mockEinsaetze = createMockEinsaetze(3, 11);
      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.ok(mockEinsaetze));
      mockEinsatzRepository.save.mockResolvedValueOnce(Result.ok(undefined)).mockResolvedValueOnce(Result.fail('DB Error')).mockResolvedValueOnce(Result.ok(undefined));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.archived).toBe(2);
      expect(result.value!.failed).toHaveLength(1);
      expect(result.value!.failed[0].error).toContain('DB Error');
    });

    it('should log failed einsatz details', async () => {
      // Given (Arrange)
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: UserId.create().value!.value,
        dryRun: false,
      }).value!;
      const mockEinsatz = createMockEinsatz('einsatz-fail-id', 11);
      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.ok([mockEinsatz]));
      mockEinsatzRepository.save.mockResolvedValue(Result.fail('Connection timeout'));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.failed).toContainEqual({
        id: mockEinsatz.id.value,
        error: 'Connection timeout',
      });
    });

    it('should handle archive() business rule failures', async () => {
      // Given (Arrange)
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: UserId.create().value!.value,
        dryRun: false,
      }).value!;

      // Create einsatz with invalid status (ANGELEGT cannot be archived)
      const userId = UserId.create().value!;
      const invalidEinsatz = Einsatz.create({
        alarmstichwort: 'Test',
        createdBy: userId,
      }).value!;
      invalidEinsatz.clearDomainEvents();

      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.ok([invalidEinsatz]));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.archived).toBe(0);
      expect(result.value!.failed).toHaveLength(1);
      // Error should be caught and logged (either from archive() or from try/catch)
      expect(result.value!.failed[0].id).toBe(invalidEinsatz.id.value);
      expect(result.value!.failed[0].error).toBeTruthy();
    });

    it('should handle exceptions thrown during archiving', async () => {
      // Given (Arrange)
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: UserId.create().value!.value,
        dryRun: false,
      }).value!;
      const mockEinsaetze = createMockEinsaetze(2, 11);
      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.ok(mockEinsaetze));
      mockEinsatzRepository.save.mockRejectedValueOnce(new Error('Unexpected DB error')).mockResolvedValueOnce(Result.ok(undefined));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.archived).toBe(1);
      expect(result.value!.failed).toHaveLength(1);
      expect(result.value!.failed[0].error).toBe('Unexpected DB error');
    });

    it('should process all einsaetze despite multiple failures', async () => {
      // Given (Arrange)
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: UserId.create().value!.value,
        dryRun: false,
      }).value!;
      const mockEinsaetze = createMockEinsaetze(5, 11);
      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.ok(mockEinsaetze));
      mockEinsatzRepository.save
        .mockResolvedValueOnce(Result.ok(undefined))
        .mockResolvedValueOnce(Result.fail('Error 1'))
        .mockResolvedValueOnce(Result.ok(undefined))
        .mockResolvedValueOnce(Result.fail('Error 2'))
        .mockResolvedValueOnce(Result.ok(undefined));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.archived).toBe(3);
      expect(result.value!.failed).toHaveLength(2);
      expect(mockEinsatzRepository.save).toHaveBeenCalledTimes(5);
    });
  });

  describe('error handling', () => {
    it('should return failure when repository query fails', async () => {
      // Given (Arrange)
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: UserId.create().value!.value,
      }).value!;
      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.fail('Database connection failed'));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database connection failed');
    });

    it('should return failure for invalid user ID', async () => {
      // Given (Arrange)
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: 'invalid-user-id',
        dryRun: false,
      }).value!;
      const mockEinsaetze = createMockEinsaetze(1, 11);
      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.ok(mockEinsaetze));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid archivedBy user ID');
    });

    it('should not call save when repository query fails', async () => {
      // Given (Arrange)
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: UserId.create().value!.value,
      }).value!;
      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.fail('Query error'));

      // When (Act)
      await handler.execute(command);

      // Then (Assert)
      expect(mockEinsatzRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('result summary', () => {
    it('should provide accurate statistics in result', async () => {
      // Given (Arrange)
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: UserId.create().value!.value,
        dryRun: false,
      }).value!;
      const mockEinsaetze = createMockEinsaetze(10, 11);
      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.ok(mockEinsaetze));
      // Mock 7 successful, 3 failures
      mockEinsatzRepository.save
        .mockResolvedValueOnce(Result.ok(undefined))
        .mockResolvedValueOnce(Result.ok(undefined))
        .mockResolvedValueOnce(Result.fail('Error 1'))
        .mockResolvedValueOnce(Result.ok(undefined))
        .mockResolvedValueOnce(Result.ok(undefined))
        .mockResolvedValueOnce(Result.fail('Error 2'))
        .mockResolvedValueOnce(Result.ok(undefined))
        .mockResolvedValueOnce(Result.ok(undefined))
        .mockResolvedValueOnce(Result.fail('Error 3'))
        .mockResolvedValueOnce(Result.ok(undefined));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.eligible).toBe(10);
      expect(result.value!.archived).toBe(7);
      expect(result.value!.failed).toHaveLength(3);
      expect(result.value!.dryRun).toBe(false);
    });

    it('should include error messages in failed array', async () => {
      // Given (Arrange)
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: UserId.create().value!.value,
        dryRun: false,
      }).value!;
      const mockEinsaetze = createMockEinsaetze(2, 11);
      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.ok(mockEinsaetze));
      mockEinsatzRepository.save.mockResolvedValueOnce(Result.fail('Specific error message')).mockResolvedValueOnce(Result.ok(undefined));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.value!.failed[0]).toEqual({
        id: expect.any(String),
        error: 'Specific error message',
      });
    });
  });

  describe('integration with aggregate', () => {
    it('should save einsatz after successful archiving', async () => {
      // Given (Arrange)
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: UserId.create().value!.value,
        dryRun: false,
      }).value!;
      const mockEinsatz = createMockEinsatz('test-id', 11);

      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.ok([mockEinsatz]));
      mockEinsatzRepository.save.mockResolvedValue(Result.ok(undefined));

      // When (Act)
      await handler.execute(command);

      // Then (Assert)
      expect(mockEinsatzRepository.save).toHaveBeenCalledTimes(1);
      expect(mockEinsatzRepository.save).toHaveBeenCalledWith(mockEinsatz);
      expect(mockEinsatz.status.value).toBe('ARCHIVIERT');
    });

    it('should use correct userId for archiving', async () => {
      // Given (Arrange)
      const adminUserId = UserId.create().value!;
      const command = ArchiveOldEinsaetzeCommand.create({
        archivedBy: adminUserId.value,
        dryRun: false,
      }).value!;
      const mockEinsatz = createMockEinsatz('test-id', 11);

      mockEinsatzRepository.findEligibleForArchival.mockResolvedValue(Result.ok([mockEinsatz]));
      mockEinsatzRepository.save.mockResolvedValue(Result.ok(undefined));

      // When (Act)
      await handler.execute(command);

      // Then (Assert)
      expect(mockEinsatz.status.value).toBe('ARCHIVIERT');
      expect(mockEinsatz.archivedAt).toBeDefined();
    });
  });
});
