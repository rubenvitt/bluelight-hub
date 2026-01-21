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
import { SnoozeErinnerungHandler } from '../snooze-erinnerung.handler';
import { SnoozeErinnerungCommand } from '../snooze-erinnerung.command';
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
import { ErinnerungSnoozedEvent } from '@domain/events/erinnerung-snoozed.event';
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
function createTestErinnerung(options: { status: ErinnerungStatus; id?: string; einsatzId?: string; titel?: string; snoozeCount?: number }): Erinnerung {
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
    snoozeCount: options.snoozeCount ?? 0,
  });
}

describe('SnoozeErinnerungHandler', () => {
  let handler: SnoozeErinnerungHandler;
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
        SnoozeErinnerungHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OUTBOX_REPOSITORY, useValue: mockOutboxRepository },
        { provide: ERINNERUNG_REPOSITORY, useValue: mockRepository },
        { provide: LOGGER, useValue: mockLogger },
      ],
    }).compile();

    handler = module.get<SnoozeErinnerungHandler>(SnoozeErinnerungHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    describe('AC1: Snooze-Buttons mit Presets 1, 5, 10 Minuten', () => {
      it.each([1, 5, 10])('sollte Erinnerung erfolgreich snoozen mit %i Minuten', async (minutes) => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.AUSGELOEST() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: minutes as 1 | 5 | 10,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeDefined();
        expect(result.value!.status).toBe('SNOOZED');
        expect(mockRepository.save).toHaveBeenCalledTimes(1);
        expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
      });

      it('sollte fehlschlagen bei ungueltigem snoozeMinutes Wert (z.B. 7)', async () => {
        // Given (Arrange) - Command mit ungültigem Wert
        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 7 as 1 | 5 | 10, // Ungültiger Wert
        });

        // Then (Assert) - Command Validation schlägt fehl
        expect(command.isFailure).toBe(true);
        expect(command.error).toBe(ERINNERUNG_ERROR_CODES.SNOOZE_MINUTES_INVALID);
      });
    });

    describe('AC2: Nur AUSGELOEST Status kann gesnoozed werden', () => {
      it('sollte Erinnerung erfolgreich snoozen wenn Status AUSGELOEST ist', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.AUSGELOEST() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 5,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isSuccess).toBe(true);
        expect(result.value!.status).toBe('SNOOZED');
      });

      it('sollte fehlschlagen wenn Status GEPLANT ist', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.GEPLANT() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 5,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_SNOOZEABLE);
        expect(mockRepository.save).not.toHaveBeenCalled();
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      });

      it('sollte fehlschlagen wenn Status ACKNOWLEDGED ist', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.ACKNOWLEDGED() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 5,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_SNOOZEABLE);
      });

      it('sollte fehlschlagen wenn Status SNOOZED ist (bereits gesnoozed)', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.SNOOZED() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 5,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_SNOOZEABLE);
      });

      it('sollte fehlschlagen wenn Status ERLEDIGT ist', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.ERLEDIGT() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 5,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_SNOOZEABLE);
      });
    });

    describe('Response DTO', () => {
      it('sollte ErinnerungResponseDto mit korrekten Feldern zurueckgeben', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({
          status: ErinnerungStatus.AUSGELOEST(),
          titel: 'Lagebesprechung',
        });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 5,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isSuccess).toBe(true);
        const dto = result.value!;
        expect(dto.id).toBe(TEST_CUID);
        expect(dto.titel).toBe('Lagebesprechung');
        expect(dto.status).toBe('SNOOZED');
        expect(dto.einsatzId).toBeDefined();
        expect(dto.faelligAm).toBeDefined();
        expect(dto.erstelltVon).toBeDefined();
        expect(dto.createdAt).toBeDefined();
        expect(dto.updatedAt).toBeDefined();
      });

      it('sollte faelligAm um snoozeMinutes erhoehen', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.AUSGELOEST() });
        const originalFaelligAm = erinnerung.faelligAm;
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 5,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isSuccess).toBe(true);
        const newFaelligAm = new Date(result.value!.faelligAm);
        // Neue Fälligkeit sollte in der Zukunft sein (snooze from now)
        expect(newFaelligAm.getTime()).toBeGreaterThan(originalFaelligAm.getTime());
      });
    });

    describe('Domain Event Emission', () => {
      it('sollte ErinnerungSnoozedEvent in Outbox speichern', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.AUSGELOEST() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 5,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isSuccess).toBe(true);
        expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
        const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
        expect(savedEvents.length).toBeGreaterThan(0);
        const snoozedEvent = savedEvents.find((e: unknown) => e instanceof ErinnerungSnoozedEvent);
        expect(snoozedEvent).toBeInstanceOf(ErinnerungSnoozedEvent);
      });

      it('sollte Event mit korrekten Properties erstellen', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({
          status: ErinnerungStatus.AUSGELOEST(),
          titel: 'Funkueberpruefung',
          snoozeCount: 2,
        });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 10,
        }).value!;

        // When (Act)
        await handler.execute(command);

        // Then (Assert)
        const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
        const event = savedEvents[0] as ErinnerungSnoozedEvent;
        expect(event.erinnerungId.toString()).toBe(TEST_CUID);
        expect(event.einsatzId.toString()).toBe(TEST_EINSATZ_CUID);
        expect(event.snoozedBy.toString()).toBe(TEST_USER_CUID);
        expect(event.titel).toBe('Funkueberpruefung');
        expect(event.snoozeMinutes).toBe(10);
        expect(event.snoozeCount).toBe(3); // Increment: 2 + 1
        expect(event.snoozedUntil).toBeInstanceOf(Date);
      });
    });

    describe('Error Handling', () => {
      it('sollte NOT_FOUND zurueckgeben wenn Erinnerung nicht existiert', async () => {
        // Given (Arrange)
        mockRepository.findById.mockResolvedValue(Result.ok(null));

        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 5,
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

        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 5,
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

        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 5,
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
        const command = SnoozeErinnerungCommand.create({
          erinnerungId: 'abc', // Zu kurz
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 5,
        });

        // Then (Assert) - Command Validation schlägt fehl
        expect(command.isFailure).toBe(true);
        expect(command.error).toBe('ERINNERUNG_ID_INVALID');
      });
    });

    describe('Transaction Behavior', () => {
      it('sollte prisma.$transaction() einmal aufrufen', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.AUSGELOEST() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 5,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isSuccess).toBe(true);
        expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      });

      it('sollte keine Events speichern bei Domain-Validierungsfehler', async () => {
        // Given (Arrange) - GEPLANT Status kann nicht gesnoozed werden
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.GEPLANT() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 5,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isFailure).toBe(true);
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('Logging', () => {
      it('sollte Success-Log bei erfolgreichem Snooze schreiben', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({
          status: ErinnerungStatus.AUSGELOEST(),
          titel: 'Lagebesprechung',
        });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 5,
        }).value!;

        // When (Act)
        await handler.execute(command);

        // Then (Assert)
        expect(mockLogger.log).toHaveBeenCalledWith(expect.stringMatching(/Erinnerung snoozed.*id:.*titel:.*Lagebesprechung.*minutes:.*5.*by:/), 'SnoozeErinnerungHandler');
      });

      it('sollte Warn-Log bei Domain-Validierungsfehler schreiben', async () => {
        // Given (Arrange)
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.GEPLANT() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 5,
        }).value!;

        // When (Act)
        await handler.execute(command);

        // Then (Assert)
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringMatching(/Snooze failed/), 'SnoozeErinnerungHandler');
      });
    });

    describe('Edge Cases', () => {
      it('sollte snoozeCount korrekt inkrementieren bei mehrfachem Snooze', async () => {
        // Given (Arrange) - Erinnerung bereits 2x gesnoozed
        const erinnerung = createTestErinnerung({
          status: ErinnerungStatus.AUSGELOEST(),
          snoozeCount: 2,
        });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 5,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isSuccess).toBe(true);
        const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
        const event = savedEvents[0] as ErinnerungSnoozedEvent;
        expect(event.snoozeCount).toBe(3); // 2 + 1 = 3
      });

      it('sollte snoozedUntil immer in der Zukunft setzen', async () => {
        // Given (Arrange)
        const now = Date.now();
        const erinnerung = createTestErinnerung({ status: ErinnerungStatus.AUSGELOEST() });
        mockRepository.findById.mockResolvedValue(Result.ok(erinnerung));

        const command = SnoozeErinnerungCommand.create({
          erinnerungId: TEST_CUID,
          snoozedBy: TEST_USER_CUID,
          snoozeMinutes: 5,
        }).value!;

        // When (Act)
        const result = await handler.execute(command);

        // Then (Assert)
        expect(result.isSuccess).toBe(true);
        const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
        const event = savedEvents[0] as ErinnerungSnoozedEvent;
        expect(event.snoozedUntil.getTime()).toBeGreaterThan(now);
        // Verifiziere dass snoozedUntil etwa 5 Minuten in der Zukunft liegt
        const expectedFuture = now + 5 * 60 * 1000;
        expect(event.snoozedUntil.getTime()).toBeGreaterThanOrEqual(expectedFuture - 1000); // -1s Toleranz
        expect(event.snoozedUntil.getTime()).toBeLessThanOrEqual(expectedFuture + 1000); // +1s Toleranz
      });
    });
  });
});
