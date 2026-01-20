import { Test, type TestingModule } from '@nestjs/testing';
import { DeleteErinnerungHandler } from '../delete-erinnerung.handler';
import { DeleteErinnerungCommand } from '../delete-erinnerung.command';
import { Result } from '@domain/common/result';
import { Erinnerung } from '@domain/entities/erinnerung.entity';
import { ErinnerungGeloeschtEvent } from '@domain/events/erinnerung-geloescht.event';
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
 * Unit Tests für DeleteErinnerungHandler.
 *
 * Testet die Handler-Orchestrierung gemäß AAA Pattern mit Given-When-Then Kommentaren.
 * Nutzt Mock Repositories für Unit Test Isolation (AC6 Compliance).
 *
 * **Story 1.4:** Erinnerung loeschen
 * - AC1: Nur GEPLANT oder AUSGELOEST Status loeschbar
 * - AC3: Soft-Delete (deletedAt, deletedBy werden gesetzt)
 * - AC4: ErinnerungGeloeschtEvent wird emittiert
 * - AC5: ETB-Eintrag wird automatisch erstellt (via Event Handler)
 *
 * **Test Coverage:**
 * - Happy Path: Erinnerung mit GEPLANT/AUSGELOEST Status erfolgreich loeschen
 * - Error Handling: NOT_FOUND, NOT_DELETABLE, ALREADY_DELETED, Validation Errors
 * - Event Emission: ErinnerungGeloeschtEvent in Outbox
 * - Transaction Behavior: Atomare Persistierung
 */
describe('DeleteErinnerungHandler', () => {
  let handler: DeleteErinnerungHandler;
  let mockErinnerungRepository: jest.Mocked<IErinnerungRepository>;
  let mockOutboxRepository: jest.Mocked<IOutboxRepository>;
  let mockPrismaService: { $transaction: jest.Mock };
  let mockLogger: jest.Mocked<ILogger>;

  /**
   * Generiert gültige CUID2 IDs für Tests.
   */
  const generateValidErinnerungId = () => ErinnerungId.create().value!.toString();
  const generateValidUserId = () => UserId.create().value!.toString();

  /**
   * Erstellt ein gültiges Erinnerung Aggregate für Tests.
   * Status ist per Default GEPLANT, was Loeschen erlaubt.
   */
  const createMockErinnerung = (status: ErinnerungStatus = ErinnerungStatus.GEPLANT(), isDeleted = false): Erinnerung => {
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
      // Soft-Delete Felder
      isDeleted,
      deletedAt: isDeleted ? new Date() : null,
      deletedBy: isDeleted ? UserId.create().value! : null,
    });
  };

  /**
   * Erstellt einen gültigen DeleteErinnerungCommand für Tests.
   */
  const createValidCommand = (erinnerungId?: string) => {
    return DeleteErinnerungCommand.create({
      erinnerungId: erinnerungId ?? generateValidErinnerungId(),
      geloeschtVon: generateValidUserId(),
    });
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock Repository für Erinnerungen
    mockErinnerungRepository = {
      save: jest.fn().mockResolvedValue(Result.ok(undefined)),
      findById: jest.fn().mockResolvedValue(Result.ok(createMockErinnerung())),
      findByEinsatzId: jest.fn(),
      exists: jest.fn(),
    } as jest.Mocked<IErinnerungRepository>;

    // Mock Repository für Outbox Events
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
        DeleteErinnerungHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OUTBOX_REPOSITORY, useValue: mockOutboxRepository },
        { provide: ERINNERUNG_REPOSITORY, useValue: mockErinnerungRepository },
        { provide: LOGGER, useValue: mockLogger },
      ],
    }).compile();

    handler = module.get<DeleteErinnerungHandler>(DeleteErinnerungHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should delete erinnerung with GEPLANT status successfully', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung(ErinnerungStatus.GEPLANT());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockErinnerungRepository.findById).toHaveBeenCalledTimes(1);
      expect(mockErinnerungRepository.save).toHaveBeenCalledTimes(1);
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should delete erinnerung with AUSGELOEST status successfully', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung(ErinnerungStatus.AUSGELOEST());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockErinnerungRepository.save).toHaveBeenCalledTimes(1);
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should fail when erinnerung not found', async () => {
      // Given (Arrange)
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(null));
      const commandResult = createValidCommand();
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_FOUND);
      expect(mockErinnerungRepository.save).not.toHaveBeenCalled();
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('should fail when erinnerung is not deletable (status = ACKNOWLEDGED)', async () => {
      // Given (Arrange)
      const nonDeletableErinnerung = createMockErinnerung(ErinnerungStatus.ACKNOWLEDGED());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(nonDeletableErinnerung));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: nonDeletableErinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_DELETABLE);
      expect(mockErinnerungRepository.save).not.toHaveBeenCalled();
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('should fail when erinnerung is not deletable (status = ERLEDIGT)', async () => {
      // Given (Arrange)
      const nonDeletableErinnerung = createMockErinnerung(ErinnerungStatus.ERLEDIGT());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(nonDeletableErinnerung));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: nonDeletableErinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_DELETABLE);
    });

    it('should fail when erinnerung is not deletable (status = SNOOZED)', async () => {
      // Given (Arrange)
      const nonDeletableErinnerung = createMockErinnerung(ErinnerungStatus.SNOOZED());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(nonDeletableErinnerung));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: nonDeletableErinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_DELETABLE);
    });

    it('should fail when erinnerung is not deletable (status = ESKALIERT)', async () => {
      // Given (Arrange)
      const nonDeletableErinnerung = createMockErinnerung(ErinnerungStatus.ESKALIERT());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(nonDeletableErinnerung));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: nonDeletableErinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_DELETABLE);
    });

    it('should fail when erinnerung is already deleted', async () => {
      // Given (Arrange)
      const alreadyDeletedErinnerung = createMockErinnerung(ErinnerungStatus.GEPLANT(), true);
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(alreadyDeletedErinnerung));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: alreadyDeletedErinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.ALREADY_DELETED);
      expect(mockErinnerungRepository.save).not.toHaveBeenCalled();
    });

    it('should fail when repository findById fails', async () => {
      // Given (Arrange)
      mockErinnerungRepository.findById.mockResolvedValue(Result.fail('Database error'));
      const commandResult = createValidCommand();
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('Database error');
      expect(mockErinnerungRepository.save).not.toHaveBeenCalled();
    });

    it('should fail when repository save fails', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));
      mockErinnerungRepository.save.mockResolvedValue(Result.fail('Save failed'));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('Save failed');
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('should emit ErinnerungGeloeschtEvent', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);

      const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
      expect(savedEvents.length).toBeGreaterThan(0);

      const deletedEvent = savedEvents[0];
      expect(deletedEvent).toBeInstanceOf(ErinnerungGeloeschtEvent);
      expect(deletedEvent.erinnerungId.toString()).toBe(mockErinnerung.id.toString());
      expect(deletedEvent.einsatzId.toString()).toBe(mockErinnerung.einsatzId.toString());
      expect(deletedEvent.titel).toBe(mockErinnerung.titel.value);
    });
  });

  describe('Command Validation', () => {
    it('should fail when erinnerungId is empty', () => {
      // Given & When (Arrange & Act)
      const result = DeleteErinnerungCommand.create({
        erinnerungId: '',
        geloeschtVon: generateValidUserId(),
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.ID_REQUIRED);
    });

    it('should fail when erinnerungId is whitespace only', () => {
      // Given & When (Arrange & Act)
      const result = DeleteErinnerungCommand.create({
        erinnerungId: '   ',
        geloeschtVon: generateValidUserId(),
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.ID_REQUIRED);
    });

    it('should fail when erinnerungId is invalid CUID2', () => {
      // Given & When (Arrange & Act)
      const result = DeleteErinnerungCommand.create({
        erinnerungId: 'invalid-id',
        geloeschtVon: generateValidUserId(),
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.ID_INVALID);
    });

    it('should fail when geloeschtVon is empty', () => {
      // Given & When (Arrange & Act)
      const result = DeleteErinnerungCommand.create({
        erinnerungId: generateValidErinnerungId(),
        geloeschtVon: '',
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.GELOESCHT_VON_REQUIRED);
    });

    it('should fail when geloeschtVon is invalid CUID2', () => {
      // Given & When (Arrange & Act)
      const result = DeleteErinnerungCommand.create({
        erinnerungId: generateValidErinnerungId(),
        geloeschtVon: 'invalid-user-id',
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.ID_INVALID);
    });

    it('should succeed with valid CUID2 IDs', () => {
      // Given & When (Arrange & Act)
      const result = DeleteErinnerungCommand.create({
        erinnerungId: generateValidErinnerungId(),
        geloeschtVon: generateValidUserId(),
      });

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.erinnerungId).toBeDefined();
      expect(result.value!.geloeschtVon).toBeDefined();
    });

    it('should reject IDs with leading/trailing whitespace', () => {
      // Given (Arrange)
      const erinnerungId = generateValidErinnerungId();
      const geloeschtVon = generateValidUserId();

      // When (Act) - IDs mit Whitespace sind ungültige CUID2
      const result = DeleteErinnerungCommand.create({
        erinnerungId: `  ${erinnerungId}  `,
        geloeschtVon: `  ${geloeschtVon}  `,
      });

      // Then (Assert) - CUID2 Pattern erwartet keine Whitespace
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.ID_INVALID);
    });
  });

  describe('Transaction Behavior', () => {
    it('should execute within prisma transaction', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should pass transaction context to repository findById', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const txMarker = { txId: 'test-tx' };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(txMarker));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockErinnerungRepository.findById).toHaveBeenCalledTimes(1);
      const txContext = mockErinnerungRepository.findById.mock.calls[0][1];
      expect(txContext).toBe(txMarker);
    });

    it('should pass transaction context to repository save', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const txMarker = { txId: 'save-tx' };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(txMarker));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockErinnerungRepository.save).toHaveBeenCalledTimes(1);
      const txContext = mockErinnerungRepository.save.mock.calls[0][1];
      expect(txContext).toBe(txMarker);
    });

    it('should not save events when repository save fails', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));
      mockErinnerungRepository.save.mockResolvedValue(Result.fail('DB error'));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('Outbox Integration', () => {
    it('should save exactly one ErinnerungGeloeschtEvent', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
      expect(savedEvents.length).toBe(1);
      expect(savedEvents[0]).toBeInstanceOf(ErinnerungGeloeschtEvent);
    });

    it('should save event with correct geloeschtVon UserId', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const geloeschtVon = generateValidUserId();
      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        geloeschtVon,
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
      const deletedEvent = savedEvents[0] as ErinnerungGeloeschtEvent;

      expect(deletedEvent.geloeschtVon.toString()).toBe(geloeschtVon);
    });

    it('should save event within same transaction as aggregate', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const txMarker = { txId: 'same-tx' };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(txMarker));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const repoTxContext = mockErinnerungRepository.save.mock.calls[0][1];
      const outboxTxContext = mockOutboxRepository.save.mock.calls[0][1];
      expect(repoTxContext).toBe(txMarker);
      expect(outboxTxContext).toBe(txMarker);
    });
  });

  describe('Logging', () => {
    it('should log successful delete', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockLogger.log).toHaveBeenCalled();
      const logCall = mockLogger.log.mock.calls[0][0];
      expect(logCall).toContain('Erinnerung geloescht');
    });

    it('should log warning when erinnerung not found', async () => {
      // Given (Arrange)
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(null));
      const commandResult = createValidCommand();
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
      const warnCall = mockLogger.warn.mock.calls[0][0];
      expect(warnCall).toContain('not found');
    });

    it('should log warning when delete not allowed', async () => {
      // Given (Arrange)
      const nonDeletableErinnerung = createMockErinnerung(ErinnerungStatus.ERLEDIGT());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(nonDeletableErinnerung));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: nonDeletableErinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
      const warnCall = mockLogger.warn.mock.calls[0][0];
      expect(warnCall).toContain('Delete failed');
    });

    it('should log error on repository failure', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));
      mockErinnerungRepository.save.mockResolvedValue(Result.fail('DB connection failed'));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
      const errorCall = mockLogger.error.mock.calls[0][0];
      expect(errorCall).toContain('Failed to save deleted Erinnerung');
    });
  });

  describe('Deletable Status Tests (AC1)', () => {
    it('should succeed for GEPLANT status', async () => {
      // Given (Arrange)
      const erinnerung = createMockErinnerung(ErinnerungStatus.GEPLANT());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(erinnerung));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: erinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
    });

    it('should succeed for AUSGELOEST status', async () => {
      // Given (Arrange)
      const erinnerung = createMockErinnerung(ErinnerungStatus.AUSGELOEST());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(erinnerung));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: erinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
    });

    it('should fail for ACKNOWLEDGED status', async () => {
      // Given (Arrange)
      const erinnerung = createMockErinnerung(ErinnerungStatus.ACKNOWLEDGED());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(erinnerung));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: erinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_DELETABLE);
    });

    it('should fail for SNOOZED status', async () => {
      // Given (Arrange)
      const erinnerung = createMockErinnerung(ErinnerungStatus.SNOOZED());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(erinnerung));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: erinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_DELETABLE);
    });

    it('should fail for ESKALIERT status', async () => {
      // Given (Arrange)
      const erinnerung = createMockErinnerung(ErinnerungStatus.ESKALIERT());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(erinnerung));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: erinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_DELETABLE);
    });

    it('should fail for ERLEDIGT status', async () => {
      // Given (Arrange)
      const erinnerung = createMockErinnerung(ErinnerungStatus.ERLEDIGT());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(erinnerung));

      const commandResult = DeleteErinnerungCommand.create({
        erinnerungId: erinnerung.id.toString(),
        geloeschtVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_DELETABLE);
    });
  });
});
