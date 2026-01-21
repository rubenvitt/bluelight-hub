// Mock cuid2 for Jest compatibility (ESM module issue) - MUST be before imports
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
    return /^[a-z][a-z0-9]+$/.test(id);
  }),
}));

import { Test, type TestingModule } from '@nestjs/testing';
import { AcknowledgeErinnerungHandler } from '../acknowledge-erinnerung.handler';
import { AcknowledgeErinnerungCommand } from '../acknowledge-erinnerung.command';
import { Result } from '@domain/common/result';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ERINNERUNG_REPOSITORY, OUTBOX_REPOSITORY, LOGGER } from '@infrastructure/di-tokens';
import type { ILogger } from '@domain/ports/i-logger.port';
import { Erinnerung } from '@domain/entities/erinnerung.entity';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { ErinnerungTitel } from '@domain/value-objects/erinnerung-titel';
import { ErinnerungStatus } from '@domain/value-objects/erinnerung-status';
import { UserId } from '@domain/value-objects/user-id';
import { ErinnerungAcknowledgedEvent } from '@domain/events/erinnerung-acknowledged.event';
import { ERINNERUNG_ERROR_CODES } from '../../../errors/erinnerung-error.codes';

/**
 * Deterministic Test Fixtures (R2-TEST3: No Math.random())
 */
const TEST_CUID = 'clwx2a9fb0000pq8r3p5t1b9x';
const TEST_USER_CUID = 'clwx2a9fb0001pq8r3p5t1b9y';
const TEST_EINSATZ_CUID = 'clwx2a9fb0002pq8r3p5t1b9z';

/**
 * Helper: Erstellt eine Test-Erinnerung mit spezifischem Status
 */
function createTestErinnerung(options: { status: ErinnerungStatus; id?: string; einsatzId?: string; titel?: string }): Erinnerung {
  const erinnerungId = ErinnerungId.create(options.id ?? TEST_CUID).value!;
  const einsatzId = EinsatzId.create(options.einsatzId ?? TEST_EINSATZ_CUID).value!;
  const titel = ErinnerungTitel.create(options.titel ?? 'Test Erinnerung').value!;
  const userId = UserId.create(TEST_USER_CUID).value!;

  return Erinnerung.reconstruct({
    id: erinnerungId,
    einsatzId,
    titel,
    beschreibung: null,
    faelligAm: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago (already triggered)
    status: options.status,
    erstelltVon: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('AcknowledgeErinnerungHandler', () => {
  let handler: AcknowledgeErinnerungHandler;
  let mockRepository: {
    save: jest.Mock;
    findById: jest.Mock;
    findByEinsatzId: jest.Mock;
    delete: jest.Mock;
  };
  let mockPrismaService: {
    $transaction: jest.Mock;
  };
  let mockOutboxRepository: {
    save: jest.Mock;
    findPendingEvents: jest.Mock;
    markAsPublished: jest.Mock;
    markAsFailed: jest.Mock;
    getRetryCount: jest.Mock;
  };
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(async () => {
    mockRepository = {
      save: jest.fn().mockResolvedValue(Result.ok(undefined)),
      findById: jest.fn(),
      findByEinsatzId: jest.fn(),
      delete: jest.fn(),
    };

    mockOutboxRepository = {
      save: jest.fn().mockResolvedValue(undefined),
      findPendingEvents: jest.fn(),
      markAsPublished: jest.fn(),
      markAsFailed: jest.fn(),
      getRetryCount: jest.fn(),
    };

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<ILogger>;

    // WICHTIG: $transaction muss die Callback-Funktion ausführen und den Mock Transaction Client übergeben
    mockPrismaService = {
      $transaction: jest.fn().mockImplementation(async (callback) => {
        const txMock = {}; // Minimaler TX Mock
        return callback(txMock);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AcknowledgeErinnerungHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OUTBOX_REPOSITORY, useValue: mockOutboxRepository },
        { provide: ERINNERUNG_REPOSITORY, useValue: mockRepository },
        { provide: LOGGER, useValue: mockLogger },
      ],
    }).compile();

    handler = module.get<AcknowledgeErinnerungHandler>(AcknowledgeErinnerungHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    describe('AC1: Nur AUSGELOEST Status kann acknowledged werden', () => {
      it('sollte Erinnerung erfolgreich acknowledgen wenn Status AUSGELOEST ist', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.AUSGELOEST() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_USER_CUID,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeDefined();
        expect(result.value!.status).toBe('ACKNOWLEDGED');
        expect(mockRepository.save).toHaveBeenCalledTimes(1);
        expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
      });

      it('sollte fehlschlagen wenn Status GEPLANT ist', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.GEPLANT() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_USER_CUID,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_ACKNOWLEDGEABLE);
        expect(mockRepository.save).not.toHaveBeenCalled();
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      });

      it('sollte fehlschlagen wenn Status ACKNOWLEDGED ist (bereits bestaetigt)', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.ACKNOWLEDGED() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_USER_CUID,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_ACKNOWLEDGEABLE);
      });

      it('sollte fehlschlagen wenn Status SNOOZED ist', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.SNOOZED() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_USER_CUID,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_ACKNOWLEDGEABLE);
      });

      it('sollte fehlschlagen wenn Status ESKALIERT ist', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.ESKALIERT() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_USER_CUID,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_ACKNOWLEDGEABLE);
      });

      it('sollte fehlschlagen wenn Status ERLEDIGT ist', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.ERLEDIGT() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_USER_CUID,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_ACKNOWLEDGEABLE);
      });
    });

    describe('AC2: Response DTO', () => {
      it('sollte ErinnerungResponseDto mit korrekten Feldern zurueckgeben', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({
          status: ErinnerungStatus.AUSGELOEST(),
          titel: 'Lagebesprechung',
        });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_USER_CUID,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isSuccess).toBe(true);
        const dto = result.value!;
        expect(dto.id).toBe(TEST_CUID);
        expect(dto.titel).toBe('Lagebesprechung');
        expect(dto.status).toBe('ACKNOWLEDGED');
        expect(dto.einsatzId).toBeDefined();
        expect(dto.faelligAm).toBeDefined();
        expect(dto.erstelltVon).toBeDefined();
        expect(dto.createdAt).toBeDefined();
        expect(dto.updatedAt).toBeDefined();
      });
    });

    describe('Domain Event Emission', () => {
      it('sollte ErinnerungAcknowledgedEvent in Outbox speichern', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.AUSGELOEST() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_USER_CUID,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isSuccess).toBe(true);
        expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
        const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
        expect(savedEvents.length).toBeGreaterThan(0);
        const acknowledgedEvent = savedEvents.find((e: unknown) => e instanceof ErinnerungAcknowledgedEvent);
        expect(acknowledgedEvent).toBeInstanceOf(ErinnerungAcknowledgedEvent);
      });

      it('sollte Event mit korrekten Properties erstellen', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({
          status: ErinnerungStatus.AUSGELOEST(),
          titel: 'Funkueberpruefung',
        });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_USER_CUID,
        }).value!;

        // When (Act)
        await handler.execute(command);

        // Then (Assert)
        const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
        const event = savedEvents[0] as ErinnerungAcknowledgedEvent;
        expect(event.erinnerungId.toString()).toBe(TEST_CUID);
        expect(event.einsatzId.toString()).toBe(TEST_EINSATZ_CUID);
        expect(event.acknowledgedBy.toString()).toBe(TEST_USER_CUID);
        expect(event.titel).toBe('Funkueberpruefung');
        expect(event.acknowledgedAm).toBeInstanceOf(Date);
      });
    });

    describe('Error Handling', () => {
      it('sollte NOT_FOUND zurueckgeben wenn Erinnerung nicht existiert', async () => {
        // Given (Arrange)
        mockRepository.findById.mockResolvedValue(Result.ok(null));

        const command = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_USER_CUID,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_FOUND);
        expect(mockLogger.warn).toHaveBeenCalled();
      });

      it('sollte Repository-Fehler beim Laden zurueckgeben', async () => {
        // Given (Arrange)
        mockRepository.findById.mockResolvedValue(Result.fail('Database error'));

        const command = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_USER_CUID,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Database error');
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('sollte Repository-Fehler beim Speichern zurueckgeben', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.AUSGELOEST() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));
        mockRepository.save.mockResolvedValue(Result.fail('Save failed'));

        const command = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_USER_CUID,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Save failed');
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      });

      it('sollte ungueltige ErinnerungId abfangen', async () => {
        // Given (Arrange) - Command mit ungültiger ID (Handler-Level Validation)
        const command = AcknowledgeErinnerungCommand.create({
          erinnerungId: 'abc', // Zu kurz
          acknowledgedBy: TEST_USER_CUID,
        });

        // Then (Assert) - Command Validation schlägt fehl
        expect(command.isFailure).toBe(true);
        expect(command.error).toBe('ERINNERUNG_ID_INVALID_FORMAT');
      });
    });

    describe('Transaction Behavior', () => {
      it('sollte prisma.$transaction() einmal aufrufen', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.AUSGELOEST() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_USER_CUID,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isSuccess).toBe(true);
        expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      });

      it('sollte Repository.save() mit tx-Context aufrufen', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.AUSGELOEST() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));
        const txMarker = { txMarker: 'test-tx' };
        mockPrismaService.$transaction.mockImplementation(async (callback) => callback(txMarker));

        const command = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_USER_CUID,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isSuccess).toBe(true);
        const txContext = mockRepository.save.mock.calls[0][1];
        expect(txContext).toBe(txMarker);
      });

      it('sollte OutboxRepository.save() mit tx-Context aufrufen', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.AUSGELOEST() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));
        const txMarker = { txMarker: 'outbox-tx' };
        mockPrismaService.$transaction.mockImplementation(async (callback) => callback(txMarker));

        const command = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_USER_CUID,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isSuccess).toBe(true);
        const txContext = mockOutboxRepository.save.mock.calls[0][1];
        expect(txContext).toBe(txMarker);
      });

      it('sollte keine Events speichern bei Domain-Validierungsfehler', async () => {
        // Given (Arrange) - GEPLANT Status kann nicht acknowledged werden
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.GEPLANT() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_USER_CUID,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('Logging', () => {
      it('sollte Success-Log bei erfolgreichem Acknowledge schreiben', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({
          status: ErinnerungStatus.AUSGELOEST(),
          titel: 'Lagebesprechung',
        });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_USER_CUID,
        }).value!;

        // When (Act)
        await handler.execute(command);

        // Then (Assert)
        expect(mockLogger.log).toHaveBeenCalledWith(expect.stringMatching(/Erinnerung acknowledged.*id:.*titel:.*Lagebesprechung.*by:/), 'AcknowledgeErinnerungHandler');
      });

      it('sollte Warn-Log bei Domain-Validierungsfehler schreiben', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.GEPLANT() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = AcknowledgeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          acknowledgedBy: TEST_USER_CUID,
        }).value!;

        // When (Act)
        await handler.execute(command);

        // Then (Assert)
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringMatching(/Acknowledge failed/), 'AcknowledgeErinnerungHandler');
      });
    });
  });
});
