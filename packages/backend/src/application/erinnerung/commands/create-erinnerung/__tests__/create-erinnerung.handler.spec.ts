import { Test, type TestingModule } from '@nestjs/testing';
import { CreateErinnerungHandler } from '../create-erinnerung.handler';
import { CreateErinnerungCommand } from '../create-erinnerung.command';
import { Result } from '@domain/common/result';
import { ErinnerungErstelltEvent } from '@domain/events/erinnerung-erstellt.event';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ERINNERUNG_REPOSITORY, OUTBOX_REPOSITORY, LOGGER } from '@/infrastructure/di-tokens';
import { ERINNERUNG_ERROR_CODES } from '../../../errors/erinnerung-error.codes';
import type { IErinnerungRepository } from '@domain/repositories/i-erinnerung.repository';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import type { ILogger } from '@domain/ports/i-logger.port';
import { ErinnerungResponseFactory } from '../../../dto/erinnerung-response.factory';

/**
 * Unit Tests für CreateErinnerungHandler.
 *
 * Testet die Handler-Orchestrierung gemäß AAA Pattern mit Given-When-Then Kommentaren.
 * Nutzt Mock Repositories für Unit Test Isolation (AC6 Compliance).
 *
 * **Test Coverage:**
 * - Happy Path: Erinnerung erfolgreich erstellen
 * - Error Handling: Validation Errors, DB Errors
 * - Event Emission: ErinnerungErstelltEvent in Outbox
 * - Transaction Behavior: Atomare Persistierung
 */
describe('CreateErinnerungHandler', () => {
  let handler: CreateErinnerungHandler;
  let mockErinnerungRepository: jest.Mocked<IErinnerungRepository>;
  let mockOutboxRepository: jest.Mocked<IOutboxRepository>;
  let mockPrismaService: { $transaction: jest.Mock };
  let mockLogger: jest.Mocked<ILogger>;

  /**
   * Generiert eine gültige CUID2 ID für Tests.
   * Nutzt EinsatzId.create() um eine echte CUID2 zu generieren.
   */
  const generateValidEinsatzId = () => EinsatzId.create().value!.toString();

  /**
   * Generiert eine gültige CUID2 UserId für Tests.
   */
  const generateValidUserId = () => UserId.create().value!.toString();

  /**
   * Erstellt einen gültigen CreateErinnerungCommand für Tests.
   */
  const createValidCommand = () => {
    const faelligAm = new Date(Date.now() + 30 * 60 * 1000); // 30 Minuten in der Zukunft
    return CreateErinnerungCommand.create({
      einsatzId: generateValidEinsatzId(),
      titel: 'Lagebesprechung',
      beschreibung: 'Im ELW 1',
      faelligAm,
      erstelltVon: generateValidUserId(),
    });
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock Repository für Erinnerungen
    mockErinnerungRepository = {
      save: jest.fn().mockResolvedValue(Result.ok(undefined)),
      findById: jest.fn(),
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
        const txMock = {}; // Minimaler TX Mock
        return callback(txMock);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateErinnerungHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OUTBOX_REPOSITORY, useValue: mockOutboxRepository },
        { provide: ERINNERUNG_REPOSITORY, useValue: mockErinnerungRepository },
        { provide: LOGGER, useValue: mockLogger },
        {
          provide: ErinnerungResponseFactory,
          useValue: {
            create: jest.fn().mockImplementation((erinnerung) => ({
              id: erinnerung.id.toString(),
              einsatzId: erinnerung.einsatzId.toString(),
              titel: erinnerung.titel.value,
              beschreibung: erinnerung.beschreibung,
              faelligAm: erinnerung.faelligAm.toISOString(),
              status: erinnerung.status.value,
              erstelltVon: erinnerung.erstelltVon.toString(),
              createdAt: erinnerung.createdAt,
              updatedAt: erinnerung.updatedAt,
            })),
          },
        },
      ],
    }).compile();

    handler = module.get<CreateErinnerungHandler>(CreateErinnerungHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should create erinnerung successfully', async () => {
      // Given (Arrange)
      const commandResult = createValidCommand();
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.id).toBeDefined();
      expect(result.value!.titel).toBe('Lagebesprechung');
      expect(result.value!.beschreibung).toBe('Im ELW 1');
      expect(result.value!.status).toBe('GEPLANT');
      expect(mockErinnerungRepository.save).toHaveBeenCalledTimes(1);
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should pass eskalationsPersonId to repository when provided', async () => {
      // Given
      const commandResult = CreateErinnerungCommand.create({
        einsatzId: generateValidEinsatzId(),
        titel: 'Eskalation Test',
        faelligAm: new Date(Date.now() + 30 * 60 * 1000),
        erstelltVon: generateValidUserId(),
        eskalationsPersonId: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When
      await handler.execute(command);

      // Then
      expect(mockErinnerungRepository.save).toHaveBeenCalledTimes(1);
      const savedEntity = mockErinnerungRepository.save.mock.calls[0][0];
      expect(savedEntity.eskalationsPersonId).toBeDefined();
      expect(savedEntity.eskalationsPersonId!.toString()).toBe(command.eskalationsPersonId!);
    });

    it('should fail when einsatzId is invalid', async () => {
      // Given (Arrange)
      const faelligAm = new Date(Date.now() + 30 * 60 * 1000);
      const commandResult = CreateErinnerungCommand.create({
        einsatzId: 'invalid-id', // Ungültiges CUID2 Format
        titel: 'Test',
        faelligAm,
        erstelltVon: generateValidUserId(),
      });

      // Then (Assert) - Command Validation sollte bereits fehlschlagen
      expect(commandResult.isFailure).toBe(true);
      expect(commandResult.error).toBe(ERINNERUNG_ERROR_CODES.EINSATZ_ID_INVALID);
    });

    it('should fail when repository save fails', async () => {
      // Given (Arrange)
      const commandResult = createValidCommand();
      const command = commandResult.value!;
      mockErinnerungRepository.save.mockResolvedValue(Result.fail('Database error'));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('Database error');
      expect(mockErinnerungRepository.save).toHaveBeenCalled();
      // Events sollten NICHT gespeichert werden bei Repository-Fehler
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('should emit ErinnerungErstelltEvent', async () => {
      // Given (Arrange)
      const commandResult = createValidCommand();
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);

      const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
      expect(savedEvents.length).toBeGreaterThan(0);

      const createdEvent = savedEvents[0];
      expect(createdEvent).toBeInstanceOf(ErinnerungErstelltEvent);
      expect(createdEvent.titel).toBe('Lagebesprechung');
      expect(createdEvent.einsatzId).toBeDefined();
      expect(createdEvent.erstelltVon).toBeDefined();
    });
  });

  describe('Command Validation', () => {
    it('should fail when titel is empty', () => {
      // Given & When (Arrange & Act)
      const faelligAm = new Date(Date.now() + 30 * 60 * 1000);
      const result = CreateErinnerungCommand.create({
        einsatzId: generateValidEinsatzId(),
        titel: '',
        faelligAm,
        erstelltVon: generateValidUserId(),
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.TITEL_REQUIRED);
    });

    it('should fail when titel is whitespace only', () => {
      // Given & When (Arrange & Act)
      const faelligAm = new Date(Date.now() + 30 * 60 * 1000);
      const result = CreateErinnerungCommand.create({
        einsatzId: generateValidEinsatzId(),
        titel: '   ',
        faelligAm,
        erstelltVon: generateValidUserId(),
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.TITEL_REQUIRED);
    });

    it('should fail when titel exceeds max length', () => {
      // Given & When (Arrange & Act)
      const faelligAm = new Date(Date.now() + 30 * 60 * 1000);
      const tooLongTitel = 'A'.repeat(101); // Max ist 100
      const result = CreateErinnerungCommand.create({
        einsatzId: generateValidEinsatzId(),
        titel: tooLongTitel,
        faelligAm,
        erstelltVon: generateValidUserId(),
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.TITEL_TOO_LONG);
    });

    it('should fail when faelligAm is in the past', () => {
      // Given & When (Arrange & Act)
      const pastDate = new Date(Date.now() - 60 * 1000); // 1 Minute in der Vergangenheit
      const result = CreateErinnerungCommand.create({
        einsatzId: generateValidEinsatzId(),
        titel: 'Test',
        faelligAm: pastDate,
        erstelltVon: generateValidUserId(),
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.FAELLIG_AM_IN_PAST);
    });

    it('should fail when erstelltVon is empty', () => {
      // Given & When (Arrange & Act)
      const faelligAm = new Date(Date.now() + 30 * 60 * 1000);
      const result = CreateErinnerungCommand.create({
        einsatzId: generateValidEinsatzId(),
        titel: 'Test',
        faelligAm,
        erstelltVon: '',
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.ERSTELLT_VON_REQUIRED);
    });

    it('should succeed with valid command', () => {
      // Given & When (Arrange & Act)
      const result = createValidCommand();

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.titel).toBe('Lagebesprechung');
    });

    it('should succeed with optional beschreibung omitted', () => {
      // Given & When (Arrange & Act)
      const faelligAm = new Date(Date.now() + 30 * 60 * 1000);
      const result = CreateErinnerungCommand.create({
        einsatzId: generateValidEinsatzId(),
        titel: 'Test',
        faelligAm,
        erstelltVon: generateValidUserId(),
        // beschreibung ist undefined
      });

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.beschreibung).toBeUndefined();
    });
  });

  describe('Transaction Behavior', () => {
    it('should execute within prisma transaction', async () => {
      // Given (Arrange)
      const commandResult = createValidCommand();
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should pass transaction context to repository save', async () => {
      // Given (Arrange)
      const commandResult = createValidCommand();
      const command = commandResult.value!;
      const txMarker = { txId: 'test-tx' };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(txMarker));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockErinnerungRepository.save).toHaveBeenCalledTimes(1);
      const txContext = mockErinnerungRepository.save.mock.calls[0][1];
      expect(txContext).toBe(txMarker);
    });

    it('should pass transaction context to outbox save', async () => {
      // Given (Arrange)
      const commandResult = createValidCommand();
      const command = commandResult.value!;
      const txMarker = { txId: 'outbox-tx' };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(txMarker));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
      const txContext = mockOutboxRepository.save.mock.calls[0][1];
      expect(txContext).toBe(txMarker);
    });

    it('should not save events when repository save fails (transaction rollback)', async () => {
      // Given (Arrange)
      const commandResult = createValidCommand();
      const command = commandResult.value!;
      mockErinnerungRepository.save.mockResolvedValue(Result.fail('DB error'));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(mockErinnerungRepository.save).toHaveBeenCalled();
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('should not call save when UserId Value Object creation fails in executeInTransaction', async () => {
      // Given (Arrange)
      // Erstelle Command ZUERST mit gültigen Werten (bevor Mock aktiv ist)
      const faelligAm = new Date(Date.now() + 30 * 60 * 1000);
      const commandResult = CreateErinnerungCommand.create({
        einsatzId: generateValidEinsatzId(),
        titel: 'Test Titel',
        faelligAm,
        erstelltVon: generateValidUserId(),
      });
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // DANN Mock setzen für Handler-Ausführung
      const userIdCreateSpy = jest.spyOn(UserId, 'create').mockReturnValue(Result.fail('INVALID_USER_ID'));

      try {
        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isSuccess).toBe(false);
        expect(result.error).toContain('INVALID_USER_ID');

        // Repository.save sollte NICHT aufgerufen werden bei Value Object Validation Fehler
        expect(mockErinnerungRepository.save).not.toHaveBeenCalled();
        // Outbox.save sollte ebenfalls NICHT aufgerufen werden
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      } finally {
        // Cleanup - IMMER ausführen, auch bei Fehlern
        userIdCreateSpy.mockRestore();
      }
    });

    it('should not call save when EinsatzId Value Object creation fails in executeInTransaction', async () => {
      // Given (Arrange)
      // Erstelle Command ZUERST mit gültigen Werten (bevor Mock aktiv ist)
      const faelligAm = new Date(Date.now() + 30 * 60 * 1000);
      const commandResult = CreateErinnerungCommand.create({
        einsatzId: generateValidEinsatzId(),
        titel: 'Test Titel',
        faelligAm,
        erstelltVon: generateValidUserId(),
      });
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // DANN Mock setzen für Handler-Ausführung
      const einsatzIdCreateSpy = jest.spyOn(EinsatzId, 'create').mockReturnValue(Result.fail('EINSATZ_ID_INVALID'));

      try {
        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isSuccess).toBe(false);
        expect(result.error).toBe('EINSATZ_ID_INVALID');

        // Bei Value Object Validierungsfehler darf KEINE Persistierung stattfinden
        expect(mockErinnerungRepository.save).not.toHaveBeenCalled();
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      } finally {
        // Cleanup - IMMER ausführen, auch bei Fehlern
        einsatzIdCreateSpy.mockRestore();
      }
    });
  });

  describe('Outbox Integration', () => {
    it('should save exactly one ErinnerungErstelltEvent', async () => {
      // Given (Arrange)
      const commandResult = createValidCommand();
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
      expect(savedEvents.length).toBe(1);
      expect(savedEvents[0]).toBeInstanceOf(ErinnerungErstelltEvent);
    });

    it('should save event with correct aggregateId', async () => {
      // Given (Arrange)
      const commandResult = createValidCommand();
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const erinnerungId = result.value!.id;
      const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
      const createdEvent = savedEvents[0] as ErinnerungErstelltEvent;
      expect(createdEvent.erinnerungId.toString()).toBe(erinnerungId);
    });

    it('should save event within same transaction as aggregate', async () => {
      // Given (Arrange)
      const commandResult = createValidCommand();
      const command = commandResult.value!;
      const txMarker = { txId: 'same-tx' };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(txMarker));

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

  describe('Response DTO Mapping', () => {
    it('should return correctly mapped ErinnerungResponseDto', async () => {
      // Given (Arrange)
      const faelligAm = new Date(Date.now() + 30 * 60 * 1000);
      const commandResult = CreateErinnerungCommand.create({
        einsatzId: generateValidEinsatzId(),
        titel: 'Test Erinnerung',
        beschreibung: 'Test Beschreibung',
        faelligAm,
        erstelltVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const dto = result.value!;

      expect(dto.id).toBeDefined();
      expect(dto.einsatzId).toBe(command.einsatzId);
      expect(dto.titel).toBe('Test Erinnerung');
      expect(dto.beschreibung).toBe('Test Beschreibung');
      expect(dto.status).toBe('GEPLANT');
      expect(dto.erstelltVon).toBe(command.erstelltVon);
      expect(dto.createdAt).toBeDefined();
      expect(dto.updatedAt).toBeDefined();

      // faelligAm sollte ISO-String sein
      expect(typeof dto.faelligAm).toBe('string');
    });

    it('should return null beschreibung when not provided', async () => {
      // Given (Arrange)
      const faelligAm = new Date(Date.now() + 30 * 60 * 1000);
      const commandResult = CreateErinnerungCommand.create({
        einsatzId: generateValidEinsatzId(),
        titel: 'Test ohne Beschreibung',
        faelligAm,
        erstelltVon: generateValidUserId(),
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.beschreibung).toBeNull();
    });
  });

  describe('Logging', () => {
    it('should log successful creation', async () => {
      // Given (Arrange)
      const commandResult = createValidCommand();
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockLogger.log).toHaveBeenCalled();
      const logCall = mockLogger.log.mock.calls[0][0];
      expect(logCall).toContain('Erinnerung erstellt');
    });

    it('should log error on repository failure', async () => {
      // Given (Arrange)
      const commandResult = createValidCommand();
      const command = commandResult.value!;
      mockErinnerungRepository.save.mockResolvedValue(Result.fail('DB connection failed'));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
      const errorCall = mockLogger.error.mock.calls[0][0];
      expect(errorCall).toContain('Failed to save Erinnerung');
    });
  });
});
