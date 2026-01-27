import { Test, type TestingModule } from '@nestjs/testing';
import { UpdateErinnerungHandler } from '../update-erinnerung.handler';
import { UpdateErinnerungCommand } from '../update-erinnerung.command';
import { Result } from '@domain/common/result';
import { Erinnerung } from '@domain/entities/erinnerung.entity';
import { ErinnerungAktualisiertEvent } from '@domain/events/erinnerung-aktualisiert.event';
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
import { ErinnerungResponseFactory } from '../../../dto/erinnerung-response.factory';

/**
 * Unit Tests für UpdateErinnerungHandler.
 *
 * Testet die Handler-Orchestrierung gemäß AAA Pattern mit Given-When-Then Kommentaren.
 * Nutzt Mock Repositories für Unit Test Isolation (AC6 Compliance).
 *
 * **Test Coverage:**
 * - Happy Path: Erinnerung erfolgreich aktualisieren
 * - Error Handling: NOT_FOUND, NOT_EDITABLE, Validation Errors, DB Errors
 * - Event Emission: ErinnerungAktualisiertEvent in Outbox
 * - Transaction Behavior: Atomare Persistierung
 */
describe('UpdateErinnerungHandler', () => {
  let handler: UpdateErinnerungHandler;
  let mockErinnerungRepository: jest.Mocked<IErinnerungRepository>;
  let mockOutboxRepository: jest.Mocked<IOutboxRepository>;
  let mockPrismaService: { $transaction: jest.Mock };
  let mockLogger: jest.Mocked<ILogger>;

  /**
   * Generiert eine gültige CUID2 ID für Tests.
   */
  const generateValidErinnerungId = () => ErinnerungId.create().value!.toString();
  const _generateValidEinsatzId = () => EinsatzId.create().value!.toString();
  const generateValidUserId = () => UserId.create().value!.toString();

  /**
   * Erstellt ein gültiges Erinnerung Aggregate für Tests.
   * Status ist GEPLANT, was Bearbeitung erlaubt.
   */
  const createMockErinnerung = (status: ErinnerungStatus = ErinnerungStatus.GEPLANT()): Erinnerung => {
    return Erinnerung.reconstruct({
      id: ErinnerungId.create().value!,
      einsatzId: EinsatzId.create().value!,
      titel: ErinnerungTitel.create('Ursprünglicher Titel').value!,
      beschreibung: 'Ursprüngliche Beschreibung',
      faelligAm: new Date(Date.now() + 60 * 60 * 1000), // 1 Stunde in der Zukunft
      status,
      erstelltVon: UserId.create().value!,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  /**
   * Erstellt einen gültigen UpdateErinnerungCommand für Tests.
   */
  const createValidCommand = (erinnerungId?: string) => {
    const faelligAm = new Date(Date.now() + 30 * 60 * 1000); // 30 Minuten in der Zukunft
    return UpdateErinnerungCommand.create({
      erinnerungId: erinnerungId ?? generateValidErinnerungId(),
      aktualisierVon: generateValidUserId(),
      titel: 'Neuer Titel',
      faelligAm,
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
        UpdateErinnerungHandler,
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

    handler = module.get<UpdateErinnerungHandler>(UpdateErinnerungHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should update erinnerung successfully', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = UpdateErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        aktualisierVon: generateValidUserId(),
        titel: 'Neuer Titel',
      });
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.titel).toBe('Neuer Titel');
      expect(mockErinnerungRepository.findById).toHaveBeenCalledTimes(1);
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

    it('should fail when erinnerung is not editable (status != GEPLANT)', async () => {
      // Given (Arrange)
      const nonEditableErinnerung = createMockErinnerung(ErinnerungStatus.AUSGELOEST());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(nonEditableErinnerung));

      const commandResult = UpdateErinnerungCommand.create({
        erinnerungId: nonEditableErinnerung.id.toString(),
        aktualisierVon: generateValidUserId(),
        titel: 'Neuer Titel',
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('ERINNERUNG_NOT_EDITABLE');
      expect(mockErinnerungRepository.save).not.toHaveBeenCalled();
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
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

      const commandResult = UpdateErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        aktualisierVon: generateValidUserId(),
        titel: 'Neuer Titel',
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('Save failed');
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('should emit ErinnerungAktualisiertEvent', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = UpdateErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        aktualisierVon: generateValidUserId(),
        titel: 'Neuer Titel',
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);

      const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
      expect(savedEvents.length).toBeGreaterThan(0);

      const updatedEvent = savedEvents[0];
      expect(updatedEvent).toBeInstanceOf(ErinnerungAktualisiertEvent);
      expect(updatedEvent.aenderungen.titel).toBe('Neuer Titel');
    });
  });

  describe('Command Validation', () => {
    it('should fail when erinnerungId is empty', () => {
      // Given & When (Arrange & Act)
      const result = UpdateErinnerungCommand.create({
        erinnerungId: '',
        aktualisierVon: generateValidUserId(),
        titel: 'Neuer Titel',
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.ID_REQUIRED);
    });

    it('should fail when erinnerungId is invalid CUID2', () => {
      // Given & When (Arrange & Act)
      const result = UpdateErinnerungCommand.create({
        erinnerungId: 'invalid-id',
        aktualisierVon: generateValidUserId(),
        titel: 'Neuer Titel',
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.ID_INVALID);
    });

    it('should fail when no changes provided', () => {
      // Given & When (Arrange & Act)
      const result = UpdateErinnerungCommand.create({
        erinnerungId: generateValidErinnerungId(),
        aktualisierVon: generateValidUserId(),
        // Keine Änderungen
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NO_CHANGES);
    });

    it('should fail when titel is empty string', () => {
      // Given & When (Arrange & Act)
      const result = UpdateErinnerungCommand.create({
        erinnerungId: generateValidErinnerungId(),
        aktualisierVon: generateValidUserId(),
        titel: '',
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.TITEL_REQUIRED);
    });

    it('should fail when titel is whitespace only', () => {
      // Given & When (Arrange & Act)
      const result = UpdateErinnerungCommand.create({
        erinnerungId: generateValidErinnerungId(),
        aktualisierVon: generateValidUserId(),
        titel: '   ',
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.TITEL_REQUIRED);
    });

    it('should fail when titel exceeds max length', () => {
      // Given & When (Arrange & Act)
      const tooLongTitel = 'A'.repeat(101); // Max ist 100
      const result = UpdateErinnerungCommand.create({
        erinnerungId: generateValidErinnerungId(),
        aktualisierVon: generateValidUserId(),
        titel: tooLongTitel,
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.TITEL_TOO_LONG);
    });

    it('should fail when faelligAm is in the past', () => {
      // Given & When (Arrange & Act)
      const pastDate = new Date(Date.now() - 60 * 1000); // 1 Minute in der Vergangenheit
      const result = UpdateErinnerungCommand.create({
        erinnerungId: generateValidErinnerungId(),
        aktualisierVon: generateValidUserId(),
        faelligAm: pastDate,
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.FAELLIG_AM_IN_PAST);
    });

    it('should succeed with only titel change', () => {
      // Given & When (Arrange & Act)
      const result = UpdateErinnerungCommand.create({
        erinnerungId: generateValidErinnerungId(),
        aktualisierVon: generateValidUserId(),
        titel: 'Neuer Titel',
      });

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.titel).toBe('Neuer Titel');
      expect(result.value!.beschreibung).toBeUndefined();
      expect(result.value!.faelligAm).toBeUndefined();
    });

    it('should succeed with only faelligAm change', () => {
      // Given & When (Arrange & Act)
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 Stunde in der Zukunft
      const result = UpdateErinnerungCommand.create({
        erinnerungId: generateValidErinnerungId(),
        aktualisierVon: generateValidUserId(),
        faelligAm: futureDate,
      });

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.titel).toBeUndefined();
      expect(result.value!.faelligAm).toEqual(futureDate);
    });

    it('should succeed with only beschreibung change', () => {
      // Given & When (Arrange & Act)
      const result = UpdateErinnerungCommand.create({
        erinnerungId: generateValidErinnerungId(),
        aktualisierVon: generateValidUserId(),
        beschreibung: 'Neue Beschreibung',
      });

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.beschreibung).toBe('Neue Beschreibung');
    });

    it('should allow null beschreibung to clear it', () => {
      // Given & When (Arrange & Act)
      const result = UpdateErinnerungCommand.create({
        erinnerungId: generateValidErinnerungId(),
        aktualisierVon: generateValidUserId(),
        beschreibung: null,
      });

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.beschreibung).toBeNull();
    });
  });

  describe('Transaction Behavior', () => {
    it('should execute within prisma transaction', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = UpdateErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        aktualisierVon: generateValidUserId(),
        titel: 'Neuer Titel',
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

      const commandResult = UpdateErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        aktualisierVon: generateValidUserId(),
        titel: 'Neuer Titel',
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

      const commandResult = UpdateErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        aktualisierVon: generateValidUserId(),
        titel: 'Neuer Titel',
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

      const commandResult = UpdateErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        aktualisierVon: generateValidUserId(),
        titel: 'Neuer Titel',
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
    it('should save exactly one ErinnerungAktualisiertEvent', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = UpdateErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        aktualisierVon: generateValidUserId(),
        titel: 'Neuer Titel',
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
      expect(savedEvents.length).toBe(1);
      expect(savedEvents[0]).toBeInstanceOf(ErinnerungAktualisiertEvent);
    });

    it('should save event with only changed fields in aenderungen', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = UpdateErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        aktualisierVon: generateValidUserId(),
        titel: 'Nur Titel geändert',
        // beschreibung und faelligAm NICHT geändert
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
      const updatedEvent = savedEvents[0] as ErinnerungAktualisiertEvent;

      expect(updatedEvent.aenderungen.titel).toBe('Nur Titel geändert');
      expect(updatedEvent.aenderungen.beschreibung).toBeUndefined();
      expect(updatedEvent.aenderungen.faelligAm).toBeUndefined();
    });

    it('should save event within same transaction as aggregate', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const txMarker = { txId: 'same-tx' };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(txMarker));

      const commandResult = UpdateErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        aktualisierVon: generateValidUserId(),
        titel: 'Neuer Titel',
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

  describe('Response DTO Mapping', () => {
    it('should return correctly mapped ErinnerungResponseDto with updated values', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const newFaelligAm = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 Stunden in der Zukunft
      const commandResult = UpdateErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        aktualisierVon: generateValidUserId(),
        titel: 'Aktualisierter Titel',
        beschreibung: 'Aktualisierte Beschreibung',
        faelligAm: newFaelligAm,
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const dto = result.value!;

      expect(dto.id).toBe(mockErinnerung.id.toString());
      expect(dto.titel).toBe('Aktualisierter Titel');
      expect(dto.beschreibung).toBe('Aktualisierte Beschreibung');
      expect(dto.status).toBe('GEPLANT');
      expect(typeof dto.faelligAm).toBe('string'); // ISO-String
      expect(dto.createdAt).toBeDefined();
      expect(dto.updatedAt).toBeDefined();
    });
  });

  describe('Logging', () => {
    it('should log successful update', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));

      const commandResult = UpdateErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        aktualisierVon: generateValidUserId(),
        titel: 'Neuer Titel',
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockLogger.log).toHaveBeenCalled();
      const logCall = mockLogger.log.mock.calls[0][0];
      expect(logCall).toContain('Erinnerung aktualisiert');
      expect(logCall).toContain('titel');
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

    it('should log error on repository failure', async () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung));
      mockErinnerungRepository.save.mockResolvedValue(Result.fail('DB connection failed'));

      const commandResult = UpdateErinnerungCommand.create({
        erinnerungId: mockErinnerung.id.toString(),
        aktualisierVon: generateValidUserId(),
        titel: 'Neuer Titel',
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
      const errorCall = mockLogger.error.mock.calls[0][0];
      expect(errorCall).toContain('Failed to save Erinnerung');
    });
  });

  describe('Multiple Status Tests (AC3)', () => {
    it('should fail for AUSGELOEST status', async () => {
      // Given (Arrange)
      const erinnerung = createMockErinnerung(ErinnerungStatus.AUSGELOEST());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(erinnerung));

      const commandResult = UpdateErinnerungCommand.create({
        erinnerungId: erinnerung.id.toString(),
        aktualisierVon: generateValidUserId(),
        titel: 'Neuer Titel',
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('ERINNERUNG_NOT_EDITABLE');
    });

    it('should fail for ACKNOWLEDGED status', async () => {
      // Given (Arrange)
      const erinnerung = createMockErinnerung(ErinnerungStatus.ACKNOWLEDGED());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(erinnerung));

      const commandResult = UpdateErinnerungCommand.create({
        erinnerungId: erinnerung.id.toString(),
        aktualisierVon: generateValidUserId(),
        titel: 'Neuer Titel',
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('ERINNERUNG_NOT_EDITABLE');
    });

    it('should fail for ERLEDIGT status', async () => {
      // Given (Arrange)
      const erinnerung = createMockErinnerung(ErinnerungStatus.ERLEDIGT());
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(erinnerung));

      const commandResult = UpdateErinnerungCommand.create({
        erinnerungId: erinnerung.id.toString(),
        aktualisierVon: generateValidUserId(),
        titel: 'Neuer Titel',
      });
      const command = commandResult.value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('ERINNERUNG_NOT_EDITABLE');
    });
  });
});
