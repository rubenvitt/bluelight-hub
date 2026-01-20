import { Test, type TestingModule } from '@nestjs/testing';
import { TriggerErinnerungHandler } from '../trigger-erinnerung.handler';
import { TriggerErinnerungCommand } from '../trigger-erinnerung.command';
import { Result } from '@domain/common/result';
import { Erinnerung } from '@domain/entities/erinnerung.entity';
import { ErinnerungAusgeloestEvent } from '@domain/events/erinnerung-ausgeloest.event';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { ErinnerungStatus } from '@domain/value-objects/erinnerung-status';
import { ErinnerungTitel } from '@domain/value-objects/erinnerung-titel';
import { UserId } from '@domain/value-objects/user-id';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ERINNERUNG_REPOSITORY, OUTBOX_REPOSITORY, LOGGER } from '@/infrastructure/di-tokens';
import { ERINNERUNG_ERROR_CODES } from '../../../errors/erinnerung-error.codes';
import type { IErinnerungRepository } from '@domain/repositories/i-erinnerung.repository';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import type { ILogger } from '@domain/ports/i-logger.port';

/**
 * Unit Tests fuer TriggerErinnerungHandler.
 *
 * Testet die Handler-Orchestrierung gemaess AAA Pattern mit Given-When-Then Kommentaren.
 * Nutzt Mock Repositories fuer Unit Test Isolation (AC6 Compliance).
 *
 * **Story 1.5:** Alarm bei Faelligkeit ausloesen
 * - AC1: Status wechselt zu AUSGELOEST
 * - AC4: WebSocket Event wird emittiert (via Outbox)
 * - AC5: ETB-Eintrag wird automatisch erstellt (via Event Handler)
 *
 * **Test Coverage:**
 * - Happy Path: Erinnerung mit GEPLANT Status erfolgreich ausloesen
 * - Error Handling: NOT_FOUND, NOT_TRIGGERABLE, Validation Errors
 * - Event Emission: ErinnerungAusgeloestEvent in Outbox
 * - Transaction Behavior: Atomare Persistierung
 */
describe('TriggerErinnerungHandler', () => {
  let handler: TriggerErinnerungHandler;
  let mockErinnerungRepository: jest.Mocked<IErinnerungRepository>;
  let mockOutboxRepository: jest.Mocked<IOutboxRepository>;
  let mockPrismaService: { $transaction: jest.Mock };
  let mockLogger: jest.Mocked<ILogger>;

  /**
   * Generiert gueltige CUID2 IDs fuer Tests.
   */
  const generateValidErinnerungId = () => ErinnerungId.create().value!.toString();

  /**
   * Erstellt ein gueltiges Erinnerung Aggregate fuer Tests.
   * Status ist per Default GEPLANT, was Ausloesen erlaubt.
   */
  const createMockErinnerung = (status: ErinnerungStatus = ErinnerungStatus.GEPLANT()): Erinnerung => {
    return Erinnerung.reconstruct({
      id: ErinnerungId.create().value!,
      einsatzId: EinsatzId.create().value!,
      titel: ErinnerungTitel.create('Test Erinnerung').value!,
      beschreibung: 'Test Beschreibung',
      faelligAm: new Date(Date.now() + 60 * 60 * 1000), // 1 Stunde in der Zukunft
      status,
      erstelltVon: UserId.create().value!,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  /**
   * Erstellt einen gueltigen TriggerErinnerungCommand fuer Tests.
   */
  const createValidCommand = (erinnerungId?: string) => {
    return TriggerErinnerungCommand.create({
      erinnerungId: erinnerungId ?? generateValidErinnerungId(),
    });
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock Repository fuer Erinnerungen
    mockErinnerungRepository = {
      save: jest.fn().mockResolvedValue(Result.ok(undefined)),
      findById: jest.fn().mockResolvedValue(Result.ok(createMockErinnerung())),
      findByEinsatzId: jest.fn(),
      exists: jest.fn(),
    } as jest.Mocked<IErinnerungRepository>;

    // Mock Repository fuer Outbox Events
    mockOutboxRepository = {
      save: jest.fn().mockResolvedValue(undefined),
      findPendingEvents: jest.fn(),
      markAsPublished: jest.fn(),
      markAsFailed: jest.fn(),
      getRetryCount: jest.fn(),
    } as unknown as jest.Mocked<IOutboxRepository>;

    // Mock Logger
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<ILogger>;

    // Mock PrismaService mit Transaction-Support
    mockPrismaService = {
      $transaction: jest.fn().mockImplementation(async (callback) => {
        const txMock = {};
        return callback(txMock);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TriggerErinnerungHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OUTBOX_REPOSITORY, useValue: mockOutboxRepository },
        { provide: ERINNERUNG_REPOSITORY, useValue: mockErinnerungRepository },
        { provide: LOGGER, useValue: mockLogger },
      ],
    }).compile();

    handler = module.get<TriggerErinnerungHandler>(TriggerErinnerungHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should trigger erinnerung with GEPLANT status successfully', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung(ErinnerungStatus.GEPLANT());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = TriggerErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
      });
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockErinnerungRepository.findById).toHaveBeenCalledTimes(1);
      expect(mockErinnerungRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should save ErinnerungAusgeloestEvent to outbox', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung(ErinnerungStatus.GEPLANT());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = createValidCommand(mockErinnerung.id.toString());
      const command = commandResult.value!;

      // When (Act)
      await handler.execute(command);

      // Then (Assert)
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
      const savedEvents = mockOutboxRepository.save.mock.calls[0][0] as unknown[];
      expect(savedEvents.length).toBe(1);
      expect(savedEvents[0]).toBeInstanceOf(ErinnerungAusgeloestEvent);
    });

    it('should change erinnerung status to AUSGELOEST', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung(ErinnerungStatus.GEPLANT());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      let savedErinnerung: Erinnerung | undefined;
      mockErinnerungRepository.save.mockImplementation(async (erinnerung) => {
        savedErinnerung = erinnerung;
        return Result.ok(undefined);
      });

      const commandResult = createValidCommand(mockErinnerung.id.toString());
      const command = commandResult.value!;

      // When (Act)
      await handler.execute(command);

      // Then (Assert)
      expect(savedErinnerung).toBeDefined();
      expect(savedErinnerung!.status.isAusgeloest()).toBe(true);
      expect(savedErinnerung!.ausgeloestAm).toBeInstanceOf(Date);
    });

    it('should log successful trigger', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung(ErinnerungStatus.GEPLANT());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = createValidCommand(mockErinnerung.id.toString());
      const command = commandResult.value!;

      // When (Act)
      await handler.execute(command);

      // Then (Assert)
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Erinnerung ausgeloest'), 'TriggerErinnerungHandler');
    });
  });

  describe('error handling', () => {
    it('should return NOT_FOUND when erinnerung does not exist', async () => {
      // Given (Arrange)
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(null));

      const commandResult = createValidCommand();
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_FOUND);
    });

    it('should return NOT_TRIGGERABLE when erinnerung has AUSGELOEST status', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung(ErinnerungStatus.AUSGELOEST());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = createValidCommand(mockErinnerung.id.toString());
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_TRIGGERABLE);
    });

    it('should return NOT_TRIGGERABLE when erinnerung has ACKNOWLEDGED status', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung(ErinnerungStatus.ACKNOWLEDGED());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = createValidCommand(mockErinnerung.id.toString());
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_TRIGGERABLE);
    });

    it('should return NOT_TRIGGERABLE when erinnerung has SNOOZED status', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung(ErinnerungStatus.SNOOZED());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = createValidCommand(mockErinnerung.id.toString());
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_TRIGGERABLE);
    });

    it('should return NOT_TRIGGERABLE when erinnerung has ERLEDIGT status', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung(ErinnerungStatus.ERLEDIGT());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = createValidCommand(mockErinnerung.id.toString());
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_TRIGGERABLE);
    });

    it('should return NOT_FOUND when repository returns deleted erinnerung (soft-deleted)', async () => {
      // Given (Arrange)
      // Repository sollte gelöschte Erinnerungen NICHT zurückgeben (findById filtern nach isDeleted=false)
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(null));

      const commandResult = createValidCommand();
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_FOUND);
    });

    it('should return SAVE_FAILED when repository save fails', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung(ErinnerungStatus.GEPLANT());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));
      mockErinnerungRepository.save.mockResolvedValue(Result.fail('DB_ERROR'));

      const commandResult = createValidCommand(mockErinnerung.id.toString());
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('DB_ERROR');
    });

    it('should log warning when trigger fails', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung(ErinnerungStatus.AUSGELOEST());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = createValidCommand(mockErinnerung.id.toString());
      const command = commandResult.value!;

      // When (Act)
      await handler.execute(command);

      // Then (Assert)
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Trigger failed'), 'TriggerErinnerungHandler');
    });
  });

  describe('command validation', () => {
    it('should reject command with empty erinnerungId', () => {
      // Given/When (Act)
      const result = TriggerErinnerungCommand.create({
        erinnerungId: '',
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.ID_REQUIRED);
    });

    it('should reject command with invalid erinnerungId format', () => {
      // Given/When (Act)
      const result = TriggerErinnerungCommand.create({
        erinnerungId: 'invalid-id',
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.ID_INVALID);
    });

    it('should accept command with valid CUID2 erinnerungId', () => {
      // Given/When (Act)
      const result = TriggerErinnerungCommand.create({
        erinnerungId: generateValidErinnerungId(),
      });

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
    });
  });

  describe('event data', () => {
    it('should include correct data in ErinnerungAusgeloestEvent', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung(ErinnerungStatus.GEPLANT());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = createValidCommand(mockErinnerung.id.toString());
      const command = commandResult.value!;

      // When (Act)
      await handler.execute(command);

      // Then (Assert)
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
      const savedEvents = mockOutboxRepository.save.mock.calls[0][0] as ErinnerungAusgeloestEvent[];
      expect(savedEvents.length).toBe(1);

      const event = savedEvents[0];
      expect(event.erinnerungId).toBe(mockErinnerung.id);
      expect(event.einsatzId).toBe(mockErinnerung.einsatzId);
      expect(event.titel).toBe('Test Erinnerung');
      expect(event.erstelltVon).toBe(mockErinnerung.erstelltVon);
      expect(event.ausgeloestAm).toBeInstanceOf(Date);
    });
  });
});
