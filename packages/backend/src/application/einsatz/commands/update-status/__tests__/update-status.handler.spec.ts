import { Result } from '@domain/common/result';
import { UpdateEinsatzStatusHandler } from '../update-status.handler';
import { UpdateEinsatzStatusCommand } from '../update-status.command';
import type { IEinsatzRepository } from '@domain/repositories';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { PrismaService } from '@/prisma/prisma.service';
import { Test, type TestingModule } from '@nestjs/testing';
import { EinsatzNotFoundException, EinsatzValidationException, EinsatzBusinessRuleException, EinsatzPersistenceException } from '@domain/common/exceptions';
import { EINSATZ_REPOSITORY, OUTBOX_REPOSITORY } from '@/infrastructure/di-tokens';

/**
 * Helper: Erstellt Mock-Einsatz mit spezifischem Status.
 * Führt korrekte State Machine Transitions durch um gewünschten Status zu erreichen.
 */
const createMockEinsatz = (status: EinsatzStatus = EinsatzStatus.ANGELEGT()): Einsatz => {
  const userId = UserId.create().value!;
  const einsatz = Einsatz.create({
    alarmstichwort: 'Testbrand',
    createdBy: userId,
  }).value!;

  // Set status through valid transitions
  if (status.equals(EinsatzStatus.IN_BEARBEITUNG())) {
    einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
  } else if (status.equals(EinsatzStatus.ABGESCHLOSSEN())) {
    einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
    einsatz.complete(userId);
  } else if (status.equals(EinsatzStatus.ARCHIVIERT())) {
    einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
    einsatz.complete(userId);
    einsatz.archive(userId);
  }

  einsatz.clearDomainEvents();
  return einsatz;
};

describe('UpdateEinsatzStatusHandler', () => {
  let handler: UpdateEinsatzStatusHandler;
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
    } as jest.Mocked<IEinsatzRepository>;

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
        UpdateEinsatzStatusHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OUTBOX_REPOSITORY, useValue: mockOutboxRepository },
        { provide: EINSATZ_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    handler = module.get<UpdateEinsatzStatusHandler>(UpdateEinsatzStatusHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute - gültige Transitions', () => {
    it('sollte ANGELEGT → IN_BEARBEITUNG erfolgreich durchführen', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ANGELEGT());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act & Assert
      await expect(handler.execute(command)).resolves.not.toThrow();
      expect(einsatz.status.value).toBe('IN_BEARBEITUNG');
      expect(mockRepository.save).toHaveBeenCalledWith(einsatz, {});
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
    });

    it('sollte IN_BEARBEITUNG → ABGESCHLOSSEN erfolgreich durchführen', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.IN_BEARBEITUNG());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'ABGESCHLOSSEN').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act & Assert
      await expect(handler.execute(command)).resolves.not.toThrow();
      expect(einsatz.status.value).toBe('ABGESCHLOSSEN');
      expect(mockRepository.save).toHaveBeenCalledWith(einsatz, {});
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
    });

    it('sollte ABGESCHLOSSEN → ARCHIVIERT erfolgreich durchführen', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ABGESCHLOSSEN());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'ARCHIVIERT').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act & Assert
      await expect(handler.execute(command)).resolves.not.toThrow();
      expect(einsatz.status.value).toBe('ARCHIVIERT');
      expect(mockRepository.save).toHaveBeenCalledWith(einsatz, {});
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
    });

    it('sollte ANGELEGT → ABGESCHLOSSEN direkt durchführen (Skip-Transition)', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ANGELEGT());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'ABGESCHLOSSEN').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act & Assert
      await expect(handler.execute(command)).resolves.not.toThrow();
      expect(einsatz.status.value).toBe('ABGESCHLOSSEN');
      expect(mockRepository.save).toHaveBeenCalledWith(einsatz, {});
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('execute - ungültige Transitions', () => {
    it('sollte ABGESCHLOSSEN → ANGELEGT ablehnen (Rückwärts-Transition)', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ABGESCHLOSSEN());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'ANGELEGT').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow('Ungültige Status-Transition');
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('sollte ABGESCHLOSSEN → IN_BEARBEITUNG ablehnen (Rückwärts-Transition)', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ABGESCHLOSSEN());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow('Ungültige Status-Transition');
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('sollte ARCHIVIERT → IN_BEARBEITUNG ablehnen (immutable)', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ARCHIVIERT());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow('Archivierte Einsätze');
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('sollte ARCHIVIERT → ABGESCHLOSSEN ablehnen (immutable)', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ARCHIVIERT());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'ABGESCHLOSSEN').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow('Archivierte Einsätze');
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('sollte ungültigen Status-String ablehnen', async () => {
      // Arrange
      const einsatz = createMockEinsatz();
      const einsatzId = einsatz.id.value;
      const command = UpdateEinsatzStatusCommand.create(einsatzId, 'INVALID_STATUS').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow('Ungültiger Status');
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('execute - Fehlerbehandlung', () => {
    it('sollte Exception werfen wenn Einsatz nicht gefunden', async () => {
      // Arrange
      const validEinsatzId = EinsatzId.create().value!.value;
      const command = UpdateEinsatzStatusCommand.create(validEinsatzId, 'IN_BEARBEITUNG').value!;
      mockRepository.findById.mockResolvedValue(Result.ok(null));

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow('nicht gefunden');
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('sollte Exception werfen bei ungültiger EinsatzId', async () => {
      // Arrange
      const command = UpdateEinsatzStatusCommand.create('invalid-id-format', 'IN_BEARBEITUNG').value!;

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(/Invalid CUID format|Ungültige Einsatz-ID/);
      expect(mockRepository.findById).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('sollte Exception werfen bei Repository.save() Fehler', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ANGELEGT());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.fail('Database connection error'));

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow('Database connection error');
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('sollte Exception werfen bei Repository.findById() Fehler', async () => {
      // Arrange
      const einsatz = createMockEinsatz();
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.fail('Database connection error'));

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow('Database connection error');
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('execute - Event Publishing', () => {
    it('sollte EinsatzStatusChangedEvent in Outbox persistieren', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ANGELEGT());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      await handler.execute(command);

      // Assert
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
      const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
      expect(savedEvents).toHaveLength(1);
      expect(savedEvents[0].constructor.name).toBe('EinsatzStatusChangedEvent');
    });

    it('sollte Events in Outbox speichern nach save(), nicht vorher', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ANGELEGT());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      await handler.execute(command);

      // Assert - Reihenfolge wichtig: save() vor Outbox save()
      const outboxCalls = mockOutboxRepository.save.mock.invocationCallOrder;
      const saveCalls = mockRepository.save.mock.invocationCallOrder;
      expect(saveCalls[0]).toBeLessThan(outboxCalls[0]);
    });

    it('sollte keine Events in Outbox speichern bei save() Fehler', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ANGELEGT());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.fail('Database error'));

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow('Database error');
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('sollte Domain Events nach Outbox Persistierung leeren', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ANGELEGT());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      // Repository.save() simuliert das Clearen der Events (wie in der echten Implementierung)
      mockRepository.save.mockImplementation(async (aggregate) => {
        aggregate.clearDomainEvents(); // Repository ist für Event-Clearing zuständig
        return Result.ok(undefined);
      });

      // Act
      await handler.execute(command);

      // Assert: Nach Repository.save() sollten Events gecleared sein (vom Repository)
      expect(einsatz.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('execute - No-Op Szenarien', () => {
    it('sollte No-Op durchführen bei gleichem Status (keine Events)', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.IN_BEARBEITUNG());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      await expect(handler.execute(command)).resolves.not.toThrow();

      // Assert
      expect(mockRepository.save).toHaveBeenCalledWith(einsatz, {});
      // No-Op: Aggregate erzeugt kein Event bei gleichem Status
      expect(einsatz.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    describe('Validation Errors', () => {
      it('sollte EinsatzValidationException werfen bei ungültiger EinsatzId', async () => {
        // Arrange
        const command = UpdateEinsatzStatusCommand.create('invalid-id-format', 'IN_BEARBEITUNG').value!;

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(EinsatzValidationException);
        expect(mockRepository.findById).not.toHaveBeenCalled();
        expect(mockRepository.save).not.toHaveBeenCalled();
      });

      it('sollte EinsatzValidationException werfen bei ungültigem Status-String', async () => {
        // Arrange
        const einsatz = createMockEinsatz();
        const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'INVALID_STATUS').value!;

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(EinsatzValidationException);
        expect(mockRepository.findById).not.toHaveBeenCalled();
        expect(mockRepository.save).not.toHaveBeenCalled();
      });

      it('sollte Command-Erstellung fehlschlagen bei leerem Status-String', async () => {
        // Arrange
        const einsatz = createMockEinsatz();
        const commandResult = UpdateEinsatzStatusCommand.create(einsatz.id.value, '');

        // Act & Assert
        expect(commandResult.isFailure).toBe(true);
        expect(commandResult.error).toContain('newStatus');
      });
    });

    describe('Entity Not Found', () => {
      it('sollte EinsatzNotFoundException werfen wenn Einsatz nicht existiert', async () => {
        // Arrange
        const validEinsatzId = EinsatzId.create().value!.value;
        const command = UpdateEinsatzStatusCommand.create(validEinsatzId, 'IN_BEARBEITUNG').value!;
        mockRepository.findById.mockResolvedValue(Result.ok(null));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(EinsatzNotFoundException);
        expect(mockRepository.save).not.toHaveBeenCalled();
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('Business Rule Violations - Status Transitions', () => {
      it('sollte EinsatzBusinessRuleException werfen bei ungültiger Rückwärts-Transition (ABGESCHLOSSEN → ANGELEGT)', async () => {
        // Arrange
        const einsatz = createMockEinsatz(EinsatzStatus.ABGESCHLOSSEN());
        const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'ANGELEGT').value!;

        mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(EinsatzBusinessRuleException);
        expect(mockRepository.save).not.toHaveBeenCalled();
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      });

      it('sollte EinsatzBusinessRuleException werfen bei ungültiger Rückwärts-Transition (ABGESCHLOSSEN → IN_BEARBEITUNG)', async () => {
        // Arrange
        const einsatz = createMockEinsatz(EinsatzStatus.ABGESCHLOSSEN());
        const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

        mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(EinsatzBusinessRuleException);
        expect(mockRepository.save).not.toHaveBeenCalled();
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      });

      it('sollte EinsatzBusinessRuleException werfen bei Änderung von ARCHIVIERT (immutable)', async () => {
        // Arrange
        const einsatz = createMockEinsatz(EinsatzStatus.ARCHIVIERT());
        const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

        mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(EinsatzBusinessRuleException);
        expect(mockRepository.save).not.toHaveBeenCalled();
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      });

      it('sollte EinsatzBusinessRuleException werfen bei ungültiger Transition (IN_BEARBEITUNG → ANGELEGT)', async () => {
        // Arrange
        const einsatz = createMockEinsatz(EinsatzStatus.IN_BEARBEITUNG());
        const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'ANGELEGT').value!;

        mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(EinsatzBusinessRuleException);
        expect(mockRepository.save).not.toHaveBeenCalled();
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('Repository/DB Errors', () => {
      it('sollte EinsatzPersistenceException werfen bei Repository.save() Fehler', async () => {
        // Arrange
        const einsatz = createMockEinsatz(EinsatzStatus.ANGELEGT());
        const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

        mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
        mockRepository.save.mockResolvedValue(Result.fail('Database connection error'));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(EinsatzPersistenceException);
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      });

      it('sollte EinsatzPersistenceException werfen bei Repository.findById() Fehler', async () => {
        // Arrange
        const einsatz = createMockEinsatz();
        const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

        mockRepository.findById.mockResolvedValue(Result.fail('Database connection error'));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(EinsatzPersistenceException);
        expect(mockRepository.save).not.toHaveBeenCalled();
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      });

      it('sollte EinsatzPersistenceException werfen bei Datenbank-Timeout', async () => {
        // Arrange
        const einsatz = createMockEinsatz(EinsatzStatus.ANGELEGT());
        const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

        mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
        mockRepository.save.mockResolvedValue(Result.fail('Query timeout'));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(EinsatzPersistenceException);
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      });
    });
  });
});
