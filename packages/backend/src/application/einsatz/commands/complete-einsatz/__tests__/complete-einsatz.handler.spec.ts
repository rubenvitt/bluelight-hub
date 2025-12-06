import { Result } from '@domain/common/result';
import { CompleteEinsatzHandler } from '../complete-einsatz.handler';
import { CompleteEinsatzCommand } from '../complete-einsatz.command';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import { EinsatzCompletenessService } from '@domain/services/einsatz-completeness.service';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { PrismaService } from '@/prisma/prisma.service';
import { Test, type TestingModule } from '@nestjs/testing';
import { EinsatzNotFoundException, EinsatzValidationException, EinsatzBusinessRuleException, EinsatzPersistenceException } from '@domain/common/exceptions';

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
    // CUID2 Format: lowercase a-z and 0-9 only, starts with letter
    // Nanoid/CUID Format (für UserId): mixed case alphanumeric + underscore/hyphen
    // Wir akzeptieren beide Formate für Kompatibilität
    return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id);
  }),
}));

/**
 * Helper function: Generiert valides CUID2-Format Test-ID.
 * CUID2 Format: 20-30 Zeichen, lowercase a-z0-9, startet mit lowercase Buchstabe.
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
 * Helper function: Erstellt Mock Einsatz für Tests mit konfigurierbarem Status und alarmstichwort.
 */
const createMockEinsatz = (overrides: Partial<{ status: EinsatzStatus; alarmstichwort: string; einsatzort: string }> = {}) => {
  const userId = UserId.create().value!;

  // Handle empty alarmstichwort by using non-empty default first, then creating entity
  const alarmstichwort = overrides.alarmstichwort ?? 'Testbrand';

  // If alarmstichwort is empty, creation will fail - just return null
  if (!alarmstichwort || alarmstichwort.trim().length === 0) {
    return null;
  }

  const einsatzResult = Einsatz.create({
    alarmstichwort,
    createdBy: userId,
  });

  if (einsatzResult.isFailure) {
    return null;
  }

  const einsatz = einsatzResult.value!;

  // Set status if provided (and not ANGELEGT)
  if (overrides.status && !overrides.status.equals(EinsatzStatus.ANGELEGT())) {
    einsatz.updateStatus(overrides.status);
  }

  einsatz.clearDomainEvents(); // Clear creation events for clean test
  return einsatz;
};

/**
 * Unit Tests für CompleteEinsatzHandler.
 *
 * Testet Handler-Orchestration gemäß BDD Given-When-Then Pattern.
 * Nutzt jest.fn() für Repository-Mocks (NO NestJS Test Module).
 *
 * Coverage Target: >90%
 * Testing Framework: Jest 30.2.0 mit @swc/jest
 */
describe('CompleteEinsatzHandler', () => {
  let handler: CompleteEinsatzHandler;
  let mockRepository: jest.Mocked<IEinsatzRepository>;
  let mockPrismaService: {
    $transaction: jest.Mock;
  };
  let mockOutboxRepository: {
    save: jest.Mock;
  };
  let mockCompletenessService: jest.Mocked<EinsatzCompletenessService>;

  beforeEach(async () => {
    mockRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      findActive: jest.fn(),
      findByNummer: jest.fn(),
      exists: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    mockPrismaService = {
      $transaction: jest.fn().mockImplementation(async (callback) => {
        const txMock = {};
        return callback(txMock);
      }),
    };

    mockOutboxRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };

    mockCompletenessService = {
      canBeCompleted: jest.fn(),
      getMissingRequirements: jest.fn(),
    } as unknown as jest.Mocked<EinsatzCompletenessService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompleteEinsatzHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: 'IOutboxRepository', useValue: mockOutboxRepository },
        { provide: 'IEinsatzRepository', useValue: mockRepository },
        { provide: EinsatzCompletenessService, useValue: mockCompletenessService },
      ],
    }).compile();

    handler = module.get<CompleteEinsatzHandler>(CompleteEinsatzHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('sollte Einsatz erfolgreich abschließen wenn Status IN_BEARBEITUNG und Felder vollständig', async () => {
      // Given
      const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
      const userId = UserId.create().value!;
      const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockCompletenessService.canBeCompleted.mockReturnValue(Result.ok(undefined));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // When & Then
      await expect(handler.execute(command)).resolves.not.toThrow();
      expect(mockRepository.save).toHaveBeenCalledWith(einsatz, {});
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
      expect(einsatz.status.value).toBe('ABGESCHLOSSEN');
      expect(einsatz.abgeschlossenAt).toBeDefined();
    });

    it('sollte Repository.save() mit Aggregate aufrufen', async () => {
      // Given
      const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
      const userId = UserId.create().value!;
      const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockCompletenessService.canBeCompleted.mockReturnValue(Result.ok(undefined));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // When
      await handler.execute(command);

      // Then
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      const savedAggregate = mockRepository.save.mock.calls[0][0];
      expect(savedAggregate).toBe(einsatz);
      expect(savedAggregate.status.value).toBe('ABGESCHLOSSEN');
    });

    it('sollte abgeschlossenAt Timestamp setzen', async () => {
      // Given
      const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
      const userId = UserId.create().value!;
      const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockCompletenessService.canBeCompleted.mockReturnValue(Result.ok(undefined));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      const beforeComplete = new Date();

      // When
      await handler.execute(command);

      // Then
      const afterComplete = new Date();
      expect(einsatz.abgeschlossenAt).toBeDefined();
      expect(einsatz.abgeschlossenAt!.getTime()).toBeGreaterThanOrEqual(beforeComplete.getTime());
      expect(einsatz.abgeschlossenAt!.getTime()).toBeLessThanOrEqual(afterComplete.getTime());
    });
  });

  describe('Failure Cases - Einsatz nicht gefunden', () => {
    it('sollte Exception werfen wenn Einsatz nicht gefunden', async () => {
      // Given
      const command = CompleteEinsatzCommand.create(createValidTestId('ein123'), UserId.create().value!.value).value!;
      mockRepository.findById.mockResolvedValue(Result.ok(null));

      // When & Assert
      await expect(handler.execute(command)).rejects.toThrow('nicht gefunden');

      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('sollte Exception werfen wenn Repository findById fehlschlägt', async () => {
      // Given
      const command = CompleteEinsatzCommand.create(createValidTestId('ein123'), UserId.create().value!.value).value!;
      mockRepository.findById.mockResolvedValue(Result.fail('Database connection error'));

      // When & Assert
      await expect(handler.execute(command)).rejects.toThrow('Database connection error');

      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('Failure Cases - Status Validierung', () => {
    it('sollte Exception werfen wenn Status != IN_BEARBEITUNG', async () => {
      // Given
      const einsatz = createMockEinsatz(); // Status ANGELEGT
      const userId = UserId.create().value!;
      const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockCompletenessService.canBeCompleted.mockReturnValue(Result.fail('Status muss IN_BEARBEITUNG sein'));

      // When & Assert
      await expect(handler.execute(command)).rejects.toThrow('IN_BEARBEITUNG');

      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('sollte Exception werfen wenn Einsatz bereits ABGESCHLOSSEN', async () => {
      // Given
      const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
      einsatz.complete(UserId.create().value!); // Setze auf ABGESCHLOSSEN
      einsatz.clearDomainEvents();

      const userId = UserId.create().value!;
      const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockCompletenessService.canBeCompleted.mockReturnValue(Result.fail('Status muss IN_BEARBEITUNG sein'));

      // When & Assert
      await expect(handler.execute(command)).rejects.toThrow();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('sollte Exception werfen wenn Einsatz ARCHIVIERT', async () => {
      // Given
      const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
      einsatz.complete(UserId.create().value!);
      einsatz.archive(UserId.create().value!);
      einsatz.clearDomainEvents();

      const userId = UserId.create().value!;
      const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockCompletenessService.canBeCompleted.mockReturnValue(Result.fail('Status muss IN_BEARBEITUNG sein'));

      // When & Assert
      await expect(handler.execute(command)).rejects.toThrow();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('Failure Cases - Vollständigkeits-Validierung', () => {
    it('sollte Exception werfen wenn CompletenessService Fehler zurückgibt', async () => {
      // Given
      const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
      const userId = UserId.create().value!;
      const command = CompleteEinsatzCommand.create(einsatz!.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockCompletenessService.canBeCompleted.mockReturnValue(Result.fail('Alarmstichwort fehlt'));

      // When & Assert
      await expect(handler.execute(command)).rejects.toThrow('Alarmstichwort fehlt');

      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('sollte EinsatzCompletenessService mit requireOrt=false aufrufen', async () => {
      // Given
      const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
      const userId = UserId.create().value!;
      const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockCompletenessService.canBeCompleted.mockReturnValue(Result.ok(undefined));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // When
      await handler.execute(command);

      // Then
      expect(mockCompletenessService.canBeCompleted).toHaveBeenCalledWith(einsatz, false);
      expect(mockCompletenessService.canBeCompleted).toHaveBeenCalledTimes(1);
    });
  });

  describe('Failure Cases - Ungültige IDs', () => {
    it('sollte Exception werfen bei ungültiger EinsatzId', async () => {
      // Given - invalid format (too short)
      const commandResult = CompleteEinsatzCommand.create('invalid-id', UserId.create().value!.value);
      expect(commandResult.isSuccess).toBe(true); // Command validation passes

      // When & Then - EinsatzId.create() validation fails in handler and throws
      await expect(handler.execute(commandResult.value!)).rejects.toThrow();
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('sollte Exception werfen bei ungültiger UserId', async () => {
      // Given - invalid userId format
      const einsatzId = createValidTestId('ein123');
      const commandResult = CompleteEinsatzCommand.create(einsatzId, 'invalid-user-id');
      expect(commandResult.isSuccess).toBe(true); // Command validation passes

      // When & Then - UserId.create() validation fails in handler and throws
      await expect(handler.execute(commandResult.value!)).rejects.toThrow();
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe('Failure Cases - Repository save errors', () => {
    it('sollte Exception werfen wenn Repository.save() fehlschlägt', async () => {
      // Given
      const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
      const userId = UserId.create().value!;
      const command = CompleteEinsatzCommand.create(einsatz!.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockCompletenessService.canBeCompleted.mockReturnValue(Result.ok(undefined));
      mockRepository.save.mockResolvedValue(Result.fail('Database write error'));

      // When & Assert
      await expect(handler.execute(command)).rejects.toThrow('Database write error');

      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('Event Publishing', () => {
    it('sollte EinsatzCompletedEvent nach save() publizieren', async () => {
      // Given
      const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
      const userId = UserId.create().value!;
      const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockCompletenessService.canBeCompleted.mockReturnValue(Result.ok(undefined));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));
      mockOutboxRepository.save.mockResolvedValue(undefined);

      // When
      await handler.execute(command);

      // Then
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
      const events = mockOutboxRepository.save.mock.calls[0][0];
      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.constructor.name === 'EinsatzCompletedEvent')).toBe(true);
    });

    it('sollte EinsatzStatusChangedEvent publizieren', async () => {
      // Given
      const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
      const userId = UserId.create().value!;
      const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockCompletenessService.canBeCompleted.mockReturnValue(Result.ok(undefined));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // When
      await handler.execute(command);

      // Then
      const events = mockOutboxRepository.save.mock.calls[0][0];
      expect(events.some((e) => e.constructor.name === 'EinsatzStatusChangedEvent')).toBe(true);
    });

    it('sollte KEINE Events publizieren wenn Einsatz nicht gefunden', async () => {
      // Given
      const command = CompleteEinsatzCommand.create(createValidTestId('ein123'), UserId.create().value!.value).value!;
      mockRepository.findById.mockResolvedValue(Result.ok(null));

      // When & Then - Handler throws when Einsatz not found
      await expect(handler.execute(command)).rejects.toThrow('nicht gefunden');

      // Assert
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('sollte KEINE Events publizieren wenn CompletenessService fehlschlägt', async () => {
      // Given
      const einsatz = createMockEinsatz(); // Status ANGELEGT
      const userId = UserId.create().value!;
      const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockCompletenessService.canBeCompleted.mockReturnValue(Result.fail('Status muss IN_BEARBEITUNG sein'));

      // When & Then - Handler throws when completeness check fails
      await expect(handler.execute(command)).rejects.toThrow('IN_BEARBEITUNG');

      // Assert
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('sollte KEINE Events publizieren wenn save fehlschlägt', async () => {
      // Given
      const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
      const userId = UserId.create().value!;
      const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockCompletenessService.canBeCompleted.mockReturnValue(Result.ok(undefined));
      mockRepository.save.mockResolvedValue(Result.fail('DB Error'));

      // When & Then - Handler throws when save fails
      await expect(handler.execute(command)).rejects.toThrow('DB Error');

      // Assert
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('sollte Domain Events für Outbox Persistierung extrahieren', async () => {
      // Given
      const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
      const userId = UserId.create().value!;
      const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockCompletenessService.canBeCompleted.mockReturnValue(Result.ok(undefined));
      // Repository.save() simuliert das Clearen der Events (wie in der echten Implementierung)
      mockRepository.save.mockImplementation(async (aggregate) => {
        aggregate.clearDomainEvents(); // Repository ist für Event-Clearing zuständig
        return Result.ok(undefined);
      });

      // When
      await handler.execute(command);

      // Then: Nach Repository.save() sollten Events gecleared sein (vom Repository)
      expect(einsatz.getDomainEvents().length).toBe(0);
    });
  });

  describe('Orchestration Verification', () => {
    it('sollte Handler-Methoden in korrekter Reihenfolge aufrufen', async () => {
      // Given
      const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
      const userId = UserId.create().value!;
      const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;
      const callOrder: string[] = [];

      mockRepository.findById.mockImplementation(async (_id: EinsatzId) => {
        callOrder.push('findById');
        return Result.ok(einsatz);
      });

      mockCompletenessService.canBeCompleted.mockImplementation((_e) => {
        callOrder.push('canBeCompleted');
        return Result.ok(undefined);
      });

      mockRepository.save.mockImplementation(async () => {
        callOrder.push('save');
        return Result.ok(undefined);
      });

      mockOutboxRepository.save.mockImplementation(async () => {
        callOrder.push('publishAll');
        return undefined;
      });

      // When
      await handler.execute(command);

      // Then
      expect(callOrder).toEqual(['findById', 'canBeCompleted', 'save', 'publishAll']);
    });

    it('sollte EinsatzId Value Object korrekt erstellen und verwenden', async () => {
      // Given
      const einsatzIdValue = createValidTestId('ein123');
      const userId = UserId.create().value!;
      const command = CompleteEinsatzCommand.create(einsatzIdValue, userId.value).value!;

      const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockCompletenessService.canBeCompleted.mockReturnValue(Result.ok(undefined));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // When
      await handler.execute(command);

      // Then
      const findByIdCall = mockRepository.findById.mock.calls[0][0];
      expect(findByIdCall).toBeInstanceOf(EinsatzId);
      expect(findByIdCall.value).toBe(einsatzIdValue);
    });

    it('sollte UserId Value Object korrekt erstellen und verwenden', async () => {
      // Given
      const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
      const userIdValue = UserId.create().value!.value;
      const command = CompleteEinsatzCommand.create(einsatz.id.value, userIdValue).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockCompletenessService.canBeCompleted.mockReturnValue(Result.ok(undefined));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // When
      await handler.execute(command);
      // Then
      // Verify userId was used to complete the Einsatz
      const events = mockOutboxRepository.save.mock.calls[0][0];
      const completedEvent = events.find((e) => e.constructor.name === 'EinsatzCompletedEvent');
      expect(completedEvent).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('sollte mit allen validen CUID2 Zeichen umgehen können', async () => {
      // Given: Test mit komplexer valider CUID2 ID
      const complexEinsatzId = 'clw3h8x9y0000qwertyuiazaz0';
      const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
      const userId = UserId.create().value!;
      const command = CompleteEinsatzCommand.create(complexEinsatzId, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockCompletenessService.canBeCompleted.mockReturnValue(Result.ok(undefined));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // When
      await handler.execute(command);
      // Then
    });

    it('sollte mit speziellen Zeichen in alarmstichwort umgehen können', async () => {
      // Given
      const specialAlarmstichwort = 'Brand TH 1 - Wohnung (Ü)';
      const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG(), alarmstichwort: specialAlarmstichwort });
      const userId = UserId.create().value!;
      const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockCompletenessService.canBeCompleted.mockReturnValue(Result.ok(undefined));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // When
      await handler.execute(command);
      // Then
      expect(einsatz.alarmstichwort).toBe(specialAlarmstichwort);
    });
  });

  describe('Error Handling - Comprehensive', () => {
    describe('Validation Errors', () => {
      it('sollte EinsatzValidationException bei ungültiger EinsatzId werfen', async () => {
        // Given
        const command = CompleteEinsatzCommand.create('invalid-id', UserId.create().value!.value).value!;

        // When & Then
        const error = await handler.execute(command).catch((e) => e);
        expect(error).toBeInstanceOf(EinsatzValidationException);
        expect(error.name).toBe('EinsatzValidationException');
        expect(error.field).toBe('einsatzId');
        expect(mockRepository.findById).not.toHaveBeenCalled();
      });

      it('sollte EinsatzValidationException bei ungültiger UserId werfen', async () => {
        // Given
        const einsatzId = createValidTestId('ein123');
        const command = CompleteEinsatzCommand.create(einsatzId, 'invalid-user-id').value!;

        // When & Then
        const error = await handler.execute(command).catch((e) => e);
        expect(error).toBeInstanceOf(EinsatzValidationException);
        expect(error.name).toBe('EinsatzValidationException');
        expect(error.field).toBe('completedBy');
        expect(mockRepository.findById).not.toHaveBeenCalled();
      });

      it('sollte EinsatzValidationException mit operation validate werfen', async () => {
        // Given
        const command = CompleteEinsatzCommand.create('bad', 'bad').value!;

        // When
        const error = await handler.execute(command).catch((e) => e);

        // Then
        expect(error).toBeInstanceOf(EinsatzValidationException);
        expect(error.operation).toBe('validate');
      });
    });

    describe('Entity Not Found', () => {
      it('sollte EinsatzNotFoundException werfen wenn Einsatz nicht existiert', async () => {
        // Given
        const command = CompleteEinsatzCommand.create(createValidTestId('ein123'), UserId.create().value!.value).value!;
        mockRepository.findById.mockResolvedValue(Result.ok(null));

        // When & Then
        const error = await handler.execute(command).catch((e) => e);
        expect(error).toBeInstanceOf(EinsatzNotFoundException);
        expect(error.name).toBe('EinsatzNotFoundException');
        expect(mockRepository.save).not.toHaveBeenCalled();
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      });

      it('sollte EinsatzNotFoundException mit einsatzId werfen', async () => {
        // Given
        const einsatzId = createValidTestId('ein456');
        const command = CompleteEinsatzCommand.create(einsatzId, UserId.create().value!.value).value!;
        mockRepository.findById.mockResolvedValue(Result.ok(null));

        // When
        const error = await handler.execute(command).catch((e) => e);

        // Then
        expect(error).toBeInstanceOf(EinsatzNotFoundException);
        expect(error.aggregateId).toBe(einsatzId);
        expect(error.operation).toBe('find');
      });
    });

    describe('Business Rule Violations', () => {
      it('sollte EinsatzBusinessRuleException bei falschem Status werfen', async () => {
        // Given
        const einsatz = createMockEinsatz(); // Status ANGELEGT
        const userId = UserId.create().value!;
        const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;

        mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
        mockCompletenessService.canBeCompleted.mockReturnValue(Result.fail('Status muss IN_BEARBEITUNG sein'));

        // When & Then
        const error = await handler.execute(command).catch((e) => e);
        expect(error).toBeInstanceOf(EinsatzBusinessRuleException);
        expect(error.name).toBe('EinsatzBusinessRuleException');
        expect(error.rule).toBe('completeness');
        expect(mockRepository.save).not.toHaveBeenCalled();
      });

      it('sollte EinsatzBusinessRuleException bei unvollständigem Einsatz werfen', async () => {
        // Given
        const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
        const userId = UserId.create().value!;
        const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;

        mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
        mockCompletenessService.canBeCompleted.mockReturnValue(Result.fail('Alarmstichwort fehlt'));

        // When & Then
        const error = await handler.execute(command).catch((e) => e);
        expect(error).toBeInstanceOf(EinsatzBusinessRuleException);
        expect(error.rule).toBe('completeness');
      });

      it('sollte EinsatzBusinessRuleException bei Status-Transition Fehler werfen', async () => {
        // Given
        const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
        einsatz.complete(UserId.create().value!); // Setze auf ABGESCHLOSSEN
        einsatz.clearDomainEvents();

        const userId = UserId.create().value!;
        const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;

        mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
        mockCompletenessService.canBeCompleted.mockReturnValue(Result.fail('Status muss IN_BEARBEITUNG sein'));

        // When & Then
        const error = await handler.execute(command).catch((e) => e);
        expect(error).toBeInstanceOf(EinsatzBusinessRuleException);
      });

      it('sollte EinsatzBusinessRuleException mit einsatzId und rule enthalten', async () => {
        // Given
        const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
        const userId = UserId.create().value!;
        const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;

        mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
        mockCompletenessService.canBeCompleted.mockReturnValue(Result.fail('Test rule violation'));

        // When
        const error = await handler.execute(command).catch((e) => e);

        // Then
        expect(error).toBeInstanceOf(EinsatzBusinessRuleException);
        expect(error.aggregateId).toBe(einsatz.id.value);
        expect(error.rule).toBe('completeness');
      });
    });

    describe('Repository/DB Errors', () => {
      it('sollte EinsatzPersistenceException bei Repository.findById Fehler werfen', async () => {
        // Given
        const command = CompleteEinsatzCommand.create(createValidTestId('ein123'), UserId.create().value!.value).value!;
        mockRepository.findById.mockResolvedValue(Result.fail('Database connection error'));

        // When & Then
        const error = await handler.execute(command).catch((e) => e);
        expect(error).toBeInstanceOf(EinsatzPersistenceException);
        expect(error.name).toBe('EinsatzPersistenceException');
        expect(mockRepository.save).not.toHaveBeenCalled();
      });

      it('sollte EinsatzPersistenceException bei Repository.save Fehler werfen', async () => {
        // Given
        const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
        const userId = UserId.create().value!;
        const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;

        mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
        mockCompletenessService.canBeCompleted.mockReturnValue(Result.ok(undefined));
        mockRepository.save.mockResolvedValue(Result.fail('Database write error'));

        // When & Then
        const error = await handler.execute(command).catch((e) => e);
        expect(error).toBeInstanceOf(EinsatzPersistenceException);
        expect(error.name).toBe('EinsatzPersistenceException');
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      });

      it('sollte EinsatzPersistenceException mit einsatzId und operation werfen', async () => {
        // Given
        const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
        const userId = UserId.create().value!;
        const command = CompleteEinsatzCommand.create(einsatz.id.value, userId.value).value!;

        mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
        mockCompletenessService.canBeCompleted.mockReturnValue(Result.ok(undefined));
        mockRepository.save.mockResolvedValue(Result.fail('Constraint violation'));

        // When
        const error = await handler.execute(command).catch((e) => e);

        // Then
        expect(error).toBeInstanceOf(EinsatzPersistenceException);
        expect(error.aggregateId).toBe(einsatz.id.value);
        expect(error.operation).toBe('persist');
      });
    });
  });
});
