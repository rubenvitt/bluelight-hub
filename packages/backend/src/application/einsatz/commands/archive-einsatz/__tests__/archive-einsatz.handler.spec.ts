import { Result } from '@domain/common/result';
import { ArchiveEinsatzHandler } from '../archive-einsatz.handler';
import { ArchiveEinsatzCommand } from '../archive-einsatz.command';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzArchivedEvent } from '@domain/events/einsatz-archived.event';
import { PrismaService } from '@/prisma/prisma.service';
import { Test, type TestingModule } from '@nestjs/testing';
import { EinsatzNotFoundException, EinsatzValidationException, EinsatzBusinessRuleException, EinsatzPersistenceException } from '@domain/common/exceptions';

/**
 * Helper: Erstellt Mock-Einsatz mit spezifischem Status und abgeschlossenAt Date.
 *
 * @param options - Konfiguration für Status und Abschluss-Datum
 * @returns Einsatz Aggregate mit konfiguriertem Zustand
 */
const createMockEinsatz = (options: { status?: EinsatzStatus; abgeschlossenYearsAgo?: number } = {}) => {
  const userId = UserId.create().value!;
  const einsatz = Einsatz.create({
    alarmstichwort: 'Testbrand',
    createdBy: userId,
  }).value!;

  // Transition zu IN_BEARBEITUNG dann ABGESCHLOSSEN wenn nötig
  if (options.status?.equals(EinsatzStatus.ABGESCHLOSSEN()) || options.status?.equals(EinsatzStatus.ARCHIVIERT())) {
    einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
    einsatz.complete(userId);

    // Mock abgeschlossenAt date falls spezifiziert
    if (options.abgeschlossenYearsAgo !== undefined) {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - options.abgeschlossenYearsAgo);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (einsatz as any)._abgeschlossenAt = pastDate;
    }
  } else if (options.status) {
    if (!options.status.equals(EinsatzStatus.ANGELEGT())) {
      einsatz.updateStatus(options.status);
    }
  }

  einsatz.clearDomainEvents();
  return einsatz;
};

describe('ArchiveEinsatzHandler', () => {
  let handler: ArchiveEinsatzHandler;
  let mockRepository: jest.Mocked<IEinsatzRepository>;
  let mockPrismaService: {
    $transaction: jest.Mock;
  };
  let mockOutboxRepository: {
    save: jest.Mock;
  };

  beforeEach(async () => {
    mockRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      findActive: jest.fn(),
      findByNummer: jest.fn(),
      exists: jest.fn(),
    };

    mockPrismaService = {
      $transaction: jest.fn().mockImplementation(async (callback) => {
        const txMock = {};
        return callback(txMock);
      }),
    };

    mockOutboxRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchiveEinsatzHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OUTBOX_REPOSITORY, useValue: mockOutboxRepository },
        { provide: EINSATZ_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    handler = module.get<ArchiveEinsatzHandler>(ArchiveEinsatzHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('sollte Einsatz erfolgreich archivieren wenn Status ABGESCHLOSSEN und 10 Jahre alt', async () => {
      // Arrange
      const einsatz = createMockEinsatz({
        status: EinsatzStatus.ABGESCHLOSSEN(),
        abgeschlossenYearsAgo: 11,
      });
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));
      mockOutboxRepository.save.mockResolvedValue(undefined);

      // Act
      await handler.execute(command);
      // Assert
      expect(mockRepository.save).toHaveBeenCalledWith(einsatz, {});
      expect(einsatz.status.value).toBe('ARCHIVIERT');
      expect(einsatz.archivedAt).toBeDefined();
    });

    it('sollte Exception werfen wenn Einsatz nicht gefunden', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create('clxxxxxxxxxxxxxxxxxx01', userId.value).value!;
      mockRepository.findById.mockResolvedValue(Result.ok(null));

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow('nicht gefunden');
    });

    it('sollte Exception werfen wenn Status != ABGESCHLOSSEN', async () => {
      // Arrange
      const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow('ABGESCHLOSSEN');
    });

    it('sollte Exception werfen wenn 10-Jahres-Frist nicht abgelaufen', async () => {
      // Arrange
      const einsatz = createMockEinsatz({
        status: EinsatzStatus.ABGESCHLOSSEN(),
        abgeschlossenYearsAgo: 5,
      });
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow('10-Jahres');
    });

    it('sollte Exception werfen wenn Einsatz bereits ARCHIVIERT', async () => {
      // Arrange
      const einsatz = createMockEinsatz({
        status: EinsatzStatus.ABGESCHLOSSEN(),
        abgeschlossenYearsAgo: 11,
      });
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));
      mockOutboxRepository.save.mockResolvedValue(undefined);

      // Einsatz archivieren (erster Aufruf)
      await handler.execute(command);
      einsatz.clearDomainEvents();

      // Act & Assert: Versuche erneut zu archivieren - Handler wirft Exception
      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      await expect(handler.execute(command)).rejects.toThrow('ABGESCHLOSSEN');
      // Fehlermeldung prüft Status (ARCHIVIERT ist nicht ABGESCHLOSSEN)
    });

    it('sollte EinsatzArchivedEvent nach save() publizieren', async () => {
      // Arrange
      const einsatz = createMockEinsatz({
        status: EinsatzStatus.ABGESCHLOSSEN(),
        abgeschlossenYearsAgo: 11,
      });
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));
      mockOutboxRepository.save.mockResolvedValue(undefined);

      // Act
      await handler.execute(command);

      // Assert
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
      const events = mockOutboxRepository.save.mock.calls[0][0];
      expect(events.some((e) => e instanceof EinsatzArchivedEvent)).toBe(true);
    });

    it('sollte Repository.save() mit archiviertem Einsatz aufrufen', async () => {
      // Arrange
      const einsatz = createMockEinsatz({
        status: EinsatzStatus.ABGESCHLOSSEN(),
        abgeschlossenYearsAgo: 11,
      });
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));
      mockOutboxRepository.save.mockResolvedValue(undefined);

      // Act
      await handler.execute(command);

      // Assert
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      expect(mockRepository.save).toHaveBeenCalledWith(einsatz, {});
    });

    it('sollte archivedAt Timestamp setzen bei erfolgreicher Archivierung', async () => {
      // Arrange
      const einsatz = createMockEinsatz({
        status: EinsatzStatus.ABGESCHLOSSEN(),
        abgeschlossenYearsAgo: 11,
      });
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));
      mockOutboxRepository.save.mockResolvedValue(undefined);

      // Act
      const beforeArchive = new Date();
      await handler.execute(command);

      // Assert
      expect(einsatz.archivedAt).toBeDefined();
      expect(einsatz.archivedAt!.getTime()).toBeGreaterThanOrEqual(beforeArchive.getTime());
    });

    it('sollte Exception werfen bei Repository save Fehler', async () => {
      // Arrange
      const einsatz = createMockEinsatz({
        status: EinsatzStatus.ABGESCHLOSSEN(),
        abgeschlossenYearsAgo: 11,
      });
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.fail('Database error'));

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow('Database error');
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('sollte Exception werfen bei ungültiger EinsatzId', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create('invalid-id', userId.value).value!;

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow();
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('sollte Exception werfen bei ungültiger UserId', async () => {
      // Arrange
      const einsatz = createMockEinsatz({
        status: EinsatzStatus.ABGESCHLOSSEN(),
        abgeschlossenYearsAgo: 11,
      });
      const command = ArchiveEinsatzCommand.create(einsatz.id.value, 'invalid-user-id').value!;

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow();
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    describe('Validation Errors', () => {
      it('sollte EinsatzValidationException werfen bei ungültiger EinsatzId', async () => {
        // Arrange
        const userId = UserId.create().value!;
        const command = ArchiveEinsatzCommand.create('invalid-id-format', userId.value).value!;

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(EinsatzValidationException);
        expect(mockRepository.findById).not.toHaveBeenCalled();
      });

      it('sollte EinsatzValidationException werfen bei ungültiger UserId', async () => {
        // Arrange
        const einsatz = createMockEinsatz({
          status: EinsatzStatus.ABGESCHLOSSEN(),
          abgeschlossenYearsAgo: 11,
        });
        const command = ArchiveEinsatzCommand.create(einsatz.id.value, 'invalid-user-id').value!;

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(EinsatzValidationException);
        expect(mockRepository.findById).not.toHaveBeenCalled();
      });
    });

    describe('Entity Not Found', () => {
      it('sollte EinsatzNotFoundException werfen wenn Einsatz nicht existiert', async () => {
        // Arrange
        const userId = UserId.create().value!;
        const command = ArchiveEinsatzCommand.create('clxxxxxxxxxxxxxxxxxx01', userId.value).value!;
        mockRepository.findById.mockResolvedValue(Result.ok(null));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(EinsatzNotFoundException);
        expect(mockRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('Business Rule Violations', () => {
      it('sollte EinsatzBusinessRuleException werfen wenn Status nicht ABGESCHLOSSEN', async () => {
        // Arrange
        const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
        const userId = UserId.create().value!;
        const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

        mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(EinsatzBusinessRuleException);
        expect(mockRepository.save).not.toHaveBeenCalled();
      });

      it('sollte EinsatzBusinessRuleException werfen wenn 10-Jahres-Frist nicht erreicht', async () => {
        // Arrange
        const einsatz = createMockEinsatz({
          status: EinsatzStatus.ABGESCHLOSSEN(),
          abgeschlossenYearsAgo: 5,
        });
        const userId = UserId.create().value!;
        const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

        mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(EinsatzBusinessRuleException);
        expect(mockRepository.save).not.toHaveBeenCalled();
      });

      it('sollte EinsatzBusinessRuleException werfen bei bereits archiviertem Einsatz', async () => {
        // Arrange
        const einsatz = createMockEinsatz({
          status: EinsatzStatus.ABGESCHLOSSEN(),
          abgeschlossenYearsAgo: 11,
        });
        const userId = UserId.create().value!;
        const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

        mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
        mockRepository.save.mockResolvedValue(Result.ok(undefined));
        mockOutboxRepository.save.mockResolvedValue(undefined);

        // Einsatz archivieren (erster Aufruf)
        await handler.execute(command);
        einsatz.clearDomainEvents();

        // Act & Assert: Versuche erneut zu archivieren
        mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
        await expect(handler.execute(command)).rejects.toThrow(EinsatzBusinessRuleException);
      });
    });

    describe('Repository/DB Errors', () => {
      it('sollte EinsatzPersistenceException werfen bei Repository.save() Fehler', async () => {
        // Arrange
        const einsatz = createMockEinsatz({
          status: EinsatzStatus.ABGESCHLOSSEN(),
          abgeschlossenYearsAgo: 11,
        });
        const userId = UserId.create().value!;
        const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

        mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
        mockRepository.save.mockResolvedValue(Result.fail('Database error'));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(EinsatzPersistenceException);
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      });

      it('sollte EinsatzPersistenceException werfen bei Repository.findById() Fehler', async () => {
        // Arrange
        const userId = UserId.create().value!;
        const command = ArchiveEinsatzCommand.create('clxxxxxxxxxxxxxxxxxx01', userId.value).value!;
        mockRepository.findById.mockResolvedValue(Result.fail('Database connection error'));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(EinsatzPersistenceException);
        expect(mockRepository.save).not.toHaveBeenCalled();
      });
    });
  });
});
