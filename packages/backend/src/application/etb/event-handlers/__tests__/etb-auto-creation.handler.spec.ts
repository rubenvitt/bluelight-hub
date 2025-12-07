import { Result } from '@domain/common/result';
import { EinsatzCreatedEvent } from '@domain/events/einsatz-created.event';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { EtbId } from '@domain/value-objects/etb-id';
import type { CreateEtbHandler } from '../../commands/create-etb/create-etb.handler';
import { EtbAutoCreationHandler } from '../etb-auto-creation.handler';

// Mock CUID2 fuer deterministische Tests
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
 * Generiert eine Test-CUID mit korrektem Format.
 * Format: 25 Zeichen, beginnt mit 'c', nur lowercase a-z und 0-9.
 */
function generateTestCuid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'c';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Erstellt ein Test-EinsatzCreatedEvent mit allen erforderlichen Daten.
 *
 * @param overrides - Optional: Teilweise Ueberschreibungen der Default-Werte
 */
function createTestEvent(
  overrides: Partial<{
    einsatzId: EinsatzId;
    createdBy: UserId;
    alarmstichwort: string;
    nummer: string;
  }> = {},
): EinsatzCreatedEvent {
  const defaultEinsatzId = EinsatzId.create(generateTestCuid()).value!;
  const defaultUserId = UserId.create(generateTestCuid()).value!;

  return new EinsatzCreatedEvent(
    overrides.einsatzId ?? defaultEinsatzId,
    overrides.createdBy ?? defaultUserId,
    overrides.alarmstichwort ?? 'Test Alarm',
    overrides.nummer ?? `E2025-${generateTestCuid().slice(0, 8)}`,
    (overrides.einsatzId ?? defaultEinsatzId).value,
  );
}

describe('EtbAutoCreationHandler', () => {
  let handler: EtbAutoCreationHandler;
  let mockCreateEtbHandler: jest.Mocked<CreateEtbHandler>;
  let mockLogger: {
    log: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };

  beforeEach(() => {
    // Mock CreateEtbHandler
    mockCreateEtbHandler = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CreateEtbHandler>;

    // Mock Logger
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Handler mit Mocks instanziieren
    handler = new EtbAutoCreationHandler(mockCreateEtbHandler);

    // Logger-Instanz durch Mock ersetzen (private property)
    (handler as unknown as { logger: typeof mockLogger }).logger = mockLogger;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AC1: Handler sollte CreateEtbHandler.execute() mit korrektem Command aufrufen', () => {
    it('should call CreateEtbHandler.execute() with command containing correct einsatzId', async () => {
      // Arrange
      const testEinsatzId = EinsatzId.create(generateTestCuid()).value!;
      const testEtbId = EtbId.create(generateTestCuid()).value!;
      const event = createTestEvent({ einsatzId: testEinsatzId });

      mockCreateEtbHandler.execute.mockResolvedValue(Result.ok(testEtbId));

      // Act
      await handler.handle(event);

      // Assert
      expect(mockCreateEtbHandler.execute).toHaveBeenCalledTimes(1);
      const receivedCommand = mockCreateEtbHandler.execute.mock.calls[0][0];
      expect(receivedCommand.einsatzId).toBe(testEinsatzId.value);
    });

    it('should extract einsatzId correctly from event', async () => {
      // Arrange
      const specificEinsatzId = EinsatzId.create(generateTestCuid()).value!;
      const testEtbId = EtbId.create(generateTestCuid()).value!;
      const event = createTestEvent({ einsatzId: specificEinsatzId });

      mockCreateEtbHandler.execute.mockResolvedValue(Result.ok(testEtbId));

      // Act
      await handler.handle(event);

      // Assert
      const receivedCommand = mockCreateEtbHandler.execute.mock.calls[0][0];
      expect(receivedCommand.einsatzId).toBe(specificEinsatzId.value);
    });
  });

  describe('AC2: Handler sollte bei erfolgreicher Erstellung Logger.log() mit etbId aufrufen', () => {
    it('should call Logger.log() with etbId on successful creation', async () => {
      // Arrange
      const testEinsatzId = EinsatzId.create(generateTestCuid()).value!;
      const testEtbId = EtbId.create(generateTestCuid()).value!;
      const event = createTestEvent({ einsatzId: testEinsatzId });

      mockCreateEtbHandler.execute.mockResolvedValue(Result.ok(testEtbId));

      // Act
      await handler.handle(event);

      // Assert: Logger.log sollte zweimal aufgerufen werden (Anfang + Erfolg)
      expect(mockLogger.log).toHaveBeenCalledTimes(2);

      // Pruefe den Erfolgs-Log (zweiter Aufruf)
      const successLogCall = mockLogger.log.mock.calls[1];
      expect(successLogCall[0]).toBe('ETB created successfully');
      expect(successLogCall[1]).toEqual(
        expect.objectContaining({
          einsatzId: testEinsatzId.value,
          etbId: testEtbId.value,
        }),
      );
    });

    it('should include occurredAt in start log', async () => {
      // Arrange
      const testEtbId = EtbId.create(generateTestCuid()).value!;
      const event = createTestEvent();

      mockCreateEtbHandler.execute.mockResolvedValue(Result.ok(testEtbId));

      // Act
      await handler.handle(event);

      // Assert
      const startLogCall = mockLogger.log.mock.calls[0];
      expect(startLogCall[1]).toEqual(
        expect.objectContaining({
          einsatzId: event.einsatzId.value,
          occurredAt: expect.any(Date),
        }),
      );
    });
  });

  describe('AC3: Handler sollte bei Duplikat (ETB exists) Logger.warn() aufrufen', () => {
    it('should call Logger.warn() when ETB already exists', async () => {
      // Arrange
      const testEinsatzId = EinsatzId.create(generateTestCuid()).value!;
      const event = createTestEvent({ einsatzId: testEinsatzId });

      mockCreateEtbHandler.execute.mockResolvedValue(Result.fail('ETB already exists for this Einsatz'));

      // Act
      await handler.handle(event);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('ETB already exists'),
        expect.objectContaining({
          einsatzId: testEinsatzId.value,
        }),
      );
    });

    it('should call Logger.warn() with German message "bereits"', async () => {
      // Arrange
      const event = createTestEvent();

      mockCreateEtbHandler.execute.mockResolvedValue(Result.fail('ETB für diesen Einsatz existiert bereits'));

      // Act
      await handler.handle(event);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should NOT call Logger.error() for duplicate scenario', async () => {
      // Arrange
      const event = createTestEvent();

      mockCreateEtbHandler.execute.mockResolvedValue(Result.fail('ETB already exists'));

      // Act
      await handler.handle(event);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('AC4: Handler sollte bei unerwartetem Fehler Logger.error() aufrufen', () => {
    it('should call Logger.error() when CreateEtbHandler.execute() throws', async () => {
      // Arrange
      const testEinsatzId = EinsatzId.create(generateTestCuid()).value!;
      const event = createTestEvent({ einsatzId: testEinsatzId });
      const unexpectedError = new Error('Database connection failed');

      mockCreateEtbHandler.execute.mockRejectedValue(unexpectedError);

      // Act
      await handler.handle(event);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unexpected error during ETB auto-creation',
        expect.objectContaining({
          einsatzId: testEinsatzId.value,
          error: 'Database connection failed',
        }),
      );
    });

    it('should include stack trace in error log', async () => {
      // Arrange
      const event = createTestEvent();
      const unexpectedError = new Error('Unexpected failure');

      mockCreateEtbHandler.execute.mockRejectedValue(unexpectedError);

      // Act
      await handler.handle(event);

      // Assert
      const errorLogCall = mockLogger.error.mock.calls[0];
      expect(errorLogCall[1]).toHaveProperty('stack');
      expect(errorLogCall[1].stack).toBeDefined();
    });

    it('should call Logger.error() for non-duplicate failures from Result.fail', async () => {
      // Arrange
      const testEinsatzId = EinsatzId.create(generateTestCuid()).value!;
      const event = createTestEvent({ einsatzId: testEinsatzId });

      mockCreateEtbHandler.execute.mockResolvedValue(Result.fail('Repository save failed'));

      // Act
      await handler.handle(event);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create ETB',
        expect.objectContaining({
          einsatzId: testEinsatzId.value,
          error: 'Repository save failed',
        }),
      );
    });
  });

  describe('AC5: Handler sollte NIEMALS Exceptions werfen (Fire-and-Forget)', () => {
    it('should NOT throw when CreateEtbHandler.execute() throws', async () => {
      // Arrange
      const event = createTestEvent();
      mockCreateEtbHandler.execute.mockRejectedValue(new Error('Fatal error'));

      // Act & Assert: Sollte NICHT werfen
      await expect(handler.handle(event)).resolves.toBeUndefined();
    });

    it('should NOT throw when CreateEtbHandler returns failure', async () => {
      // Arrange
      const event = createTestEvent();
      mockCreateEtbHandler.execute.mockResolvedValue(Result.fail('Some error'));

      // Act & Assert: Sollte NICHT werfen
      await expect(handler.handle(event)).resolves.toBeUndefined();
    });

    it('should return void (undefined) in all scenarios', async () => {
      // Arrange: Erfolgs-Szenario
      const testEtbId = EtbId.create(generateTestCuid()).value!;
      const event = createTestEvent();
      mockCreateEtbHandler.execute.mockResolvedValue(Result.ok(testEtbId));

      // Act
      const result = await handler.handle(event);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should handle non-Error thrown objects gracefully', async () => {
      // Arrange
      const event = createTestEvent();
      mockCreateEtbHandler.execute.mockRejectedValue('String error');

      // Act & Assert: Sollte NICHT werfen
      await expect(handler.handle(event)).resolves.toBeUndefined();

      // Assert: Error sollte als String geloggt werden
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unexpected error during ETB auto-creation',
        expect.objectContaining({
          error: 'String error',
        }),
      );
    });
  });

  describe('AC6: Handler sollte Event Properties korrekt extrahieren (einsatzId, occurredAt)', () => {
    it('should extract einsatzId from event correctly', async () => {
      // Arrange
      const specificEinsatzId = EinsatzId.create(generateTestCuid()).value!;
      const testEtbId = EtbId.create(generateTestCuid()).value!;
      const event = createTestEvent({ einsatzId: specificEinsatzId });

      mockCreateEtbHandler.execute.mockResolvedValue(Result.ok(testEtbId));

      // Act
      await handler.handle(event);

      // Assert: Pruefe ersten Log (Start-Log)
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Auto-creating ETB for Einsatz',
        expect.objectContaining({
          einsatzId: specificEinsatzId.value,
        }),
      );
    });

    it('should extract occurredAt from event correctly', async () => {
      // Arrange
      const testEtbId = EtbId.create(generateTestCuid()).value!;
      const event = createTestEvent();

      mockCreateEtbHandler.execute.mockResolvedValue(Result.ok(testEtbId));

      // Act
      await handler.handle(event);

      // Assert: Pruefe dass occurredAt im ersten Log vorhanden ist
      expect(mockLogger.log.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          occurredAt: expect.any(Date),
        }),
      );
    });

    it('should use einsatzId string value from event', async () => {
      // Arrange
      const testEinsatzId = EinsatzId.create(generateTestCuid()).value!;
      const testEtbId = EtbId.create(generateTestCuid()).value!;
      const event = createTestEvent({ einsatzId: testEinsatzId });

      mockCreateEtbHandler.execute.mockResolvedValue(Result.ok(testEtbId));

      // Act
      await handler.handle(event);

      // Assert: Sicherstellen dass der String-Wert verwendet wird
      const commandArg = mockCreateEtbHandler.execute.mock.calls[0][0];
      expect(typeof commandArg.einsatzId).toBe('string');
      expect(commandArg.einsatzId).toBe(testEinsatzId.value);
    });

    it('should log both einsatzId and occurredAt at start of processing', async () => {
      // Arrange
      const testEinsatzId = EinsatzId.create(generateTestCuid()).value!;
      const testEtbId = EtbId.create(generateTestCuid()).value!;
      const event = createTestEvent({ einsatzId: testEinsatzId });

      mockCreateEtbHandler.execute.mockResolvedValue(Result.ok(testEtbId));

      // Act
      await handler.handle(event);

      // Assert: Erster Log sollte beide Properties enthalten
      expect(mockLogger.log.mock.calls[0][0]).toBe('Auto-creating ETB for Einsatz');
      expect(mockLogger.log.mock.calls[0][1]).toEqual({
        einsatzId: testEinsatzId.value,
        occurredAt: expect.any(Date),
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple sequential events without interference', async () => {
      // Arrange
      const event1 = createTestEvent();
      const event2 = createTestEvent();
      const etbId1 = EtbId.create(generateTestCuid()).value!;
      const etbId2 = EtbId.create(generateTestCuid()).value!;

      mockCreateEtbHandler.execute.mockResolvedValueOnce(Result.ok(etbId1)).mockResolvedValueOnce(Result.ok(etbId2));

      // Act
      await handler.handle(event1);
      await handler.handle(event2);

      // Assert
      expect(mockCreateEtbHandler.execute).toHaveBeenCalledTimes(2);
      expect(mockLogger.log).toHaveBeenCalledTimes(4); // 2 Start + 2 Success
    });

    it('should process event with minimal valid data', async () => {
      // Arrange
      const minimalEvent = createTestEvent();
      const testEtbId = EtbId.create(generateTestCuid()).value!;

      mockCreateEtbHandler.execute.mockResolvedValue(Result.ok(testEtbId));

      // Act & Assert: Sollte ohne Fehler durchlaufen
      await expect(handler.handle(minimalEvent)).resolves.toBeUndefined();
      expect(mockCreateEtbHandler.execute).toHaveBeenCalledTimes(1);
    });
  });
});
