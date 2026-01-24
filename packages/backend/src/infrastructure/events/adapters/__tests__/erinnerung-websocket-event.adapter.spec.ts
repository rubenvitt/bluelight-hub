/**
 * Unit Tests fuer ErinnerungWebSocketEventAdapter.
 *
 * Story 3.4: WebSocket Event fuer Team-Sync bei Zuweisung einer bestehenden Erinnerung
 *
 * Testet den Adapter, der Domain Events empfaengt und WebSocket Events emittiert:
 * - onErinnerungAssigned: Emittiert erinnerung.assigned via Gateway
 * - Graceful Degradation: Fehler werden geloggt, nicht propagiert
 * - User-Namen werden aus DB geladen
 *
 * **Test Coverage:**
 * - C7: onErinnerungAssigned Event Handler Tests (primaerer Fokus fuer Story 3.4)
 * - Fire-and-Forget Pattern: Fehler werden geloggt, nicht propagiert
 * - Graceful Degradation bei fehlendem Gateway
 *
 * **Hinweis:** Tests fuer andere Handler (onErinnerungAusgeloest, etc.) sind in separaten
 * Test-Dateien. Diese Datei fokussiert auf Story 3.4 (Erinnerung-Zuweisung).
 */

import { ErinnerungWebSocketEventAdapter } from '../erinnerung-websocket-event.adapter';
import { ErinnerungAssignedEvent } from '@domain/events/erinnerung-assigned.event';
import { ErinnerungErstelltEvent } from '@domain/events/erinnerung-erstellt.event';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { ErinnerungGateway } from '@/modules/erinnerung/gateways/erinnerung.gateway';
import type { PrismaService } from '@/infrastructure/database/prisma.service';

describe('ErinnerungWebSocketEventAdapter', () => {
  let adapter: ErinnerungWebSocketEventAdapter;
  let mockGateway: jest.Mocked<ErinnerungGateway>;
  let mockLogger: jest.Mocked<ILogger>;
  let mockPrisma: {
    user: {
      findUnique: jest.Mock;
    };
  };

  /**
   * Generiert eine gueltige CUID2 ErinnerungId fuer Tests.
   */
  const generateValidErinnerungId = () => ErinnerungId.create().value!;

  /**
   * Generiert eine gueltige CUID2 EinsatzId fuer Tests.
   */
  const generateValidEinsatzId = () => EinsatzId.create().value!;

  /**
   * Generiert eine gueltige CUID2 UserId fuer Tests.
   */
  const generateValidUserId = () => UserId.create().value!;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Gateway
    mockGateway = {
      emitErinnerungAssigned: jest.fn(),
      emitErinnerungCreated: jest.fn(),
      emitErinnerungTriggered: jest.fn(),
      emitErinnerungAcknowledged: jest.fn(),
      emitErinnerungSnoozed: jest.fn(),
      emitErinnerungRetriggered: jest.fn(),
    } as unknown as jest.Mocked<ErinnerungGateway>;

    // Mock Logger
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<ILogger>;

    // Mock PrismaService
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    // Erstelle Adapter manuell mit Mocks (kein NestJS DI noetig fuer Unit Tests)
    adapter = new ErinnerungWebSocketEventAdapter(mockGateway, mockLogger, mockPrisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onErinnerungAssigned', () => {
    it('should emit WebSocket event with correct payload (Story 3.4)', async () => {
      // Given: ErinnerungAssignedEvent mit gueltigen IDs und User existieren in DB
      const erinnerungId = generateValidErinnerungId();
      const einsatzId = generateValidEinsatzId();
      const assignedToId = generateValidUserId();
      const assignedById = generateValidUserId();
      const assignedAt = new Date();

      const event = new ErinnerungAssignedEvent(erinnerungId, einsatzId, assignedToId, assignedById, 'Test Erinnerung', assignedAt, erinnerungId.toString());

      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ username: 'Max Mustermann' }) // assignedTo
        .mockResolvedValueOnce({ username: 'Erika Musterfrau' }); // assignedBy

      // When: onErinnerungAssigned aufgerufen
      await adapter.onErinnerungAssigned(event);

      // Then: gateway.emitErinnerungAssigned mit korrekten Daten aufgerufen
      expect(mockGateway.emitErinnerungAssigned).toHaveBeenCalledTimes(1);
      expect(mockGateway.emitErinnerungAssigned).toHaveBeenCalledWith({
        erinnerungId: erinnerungId.toString(),
        einsatzId: einsatzId.toString(),
        assignedToId: assignedToId.toString(),
        assignedToName: 'Max Mustermann',
        assignedById: assignedById.toString(),
        assignedByName: 'Erika Musterfrau',
        titel: 'Test Erinnerung',
        timestamp: expect.any(String),
      });
    });

    it('should load user names for assignedTo and assignedBy from database', async () => {
      // Given: Event mit User IDs
      const erinnerungId = generateValidErinnerungId();
      const einsatzId = generateValidEinsatzId();
      const assignedToId = generateValidUserId();
      const assignedById = generateValidUserId();

      const event = new ErinnerungAssignedEvent(erinnerungId, einsatzId, assignedToId, assignedById, 'DB Lookup Test', new Date());

      mockPrisma.user.findUnique.mockResolvedValue({ username: 'Test User' });

      // When: Handler aufgerufen
      await adapter.onErinnerungAssigned(event);

      // Then: prisma.user.findUnique fuer beide IDs aufgerufen
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: assignedToId.toString() },
        select: { username: true },
      });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: assignedById.toString() },
        select: { username: true },
      });
    });

    it('should handle missing gateway gracefully (Graceful Degradation)', async () => {
      // Given: Gateway ist undefined (z.B. wenn WebSocket Modul nicht geladen)
      const adapterWithoutGateway = new ErinnerungWebSocketEventAdapter(undefined, mockLogger, mockPrisma as unknown as PrismaService);

      const event = new ErinnerungAssignedEvent(generateValidErinnerungId(), generateValidEinsatzId(), generateValidUserId(), generateValidUserId(), 'No Gateway Test', new Date());

      // When: Handler aufgerufen
      await adapterWithoutGateway.onErinnerungAssigned(event);

      // Then: Kein Crash, logger.error aufgerufen
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('ErinnerungGateway not available'), 'ErinnerungWebSocketEventAdapter');
    });

    it('should use "Unbekannt" when assignedTo user not found in database', async () => {
      // Given: prisma.user.findUnique returns null fuer assignedTo
      const erinnerungId = generateValidErinnerungId();
      const einsatzId = generateValidEinsatzId();

      const event = new ErinnerungAssignedEvent(erinnerungId, einsatzId, generateValidUserId(), generateValidUserId(), 'Unknown User Test', new Date());

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // assignedTo nicht gefunden
        .mockResolvedValueOnce({ username: 'Known User' }); // assignedBy gefunden

      // When: Handler aufgerufen
      await adapter.onErinnerungAssigned(event);

      // Then: Payload hat assignedToName = 'Unbekannt'
      expect(mockGateway.emitErinnerungAssigned).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedToName: 'Unbekannt',
          assignedByName: 'Known User',
        }),
      );
    });

    it('should use "Unbekannt" when assignedBy user not found in database', async () => {
      // Given: prisma.user.findUnique returns null fuer assignedBy
      const event = new ErinnerungAssignedEvent(generateValidErinnerungId(), generateValidEinsatzId(), generateValidUserId(), generateValidUserId(), 'Unknown Assigner Test', new Date());

      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ username: 'Assigned User' }) // assignedTo gefunden
        .mockResolvedValueOnce(null); // assignedBy nicht gefunden

      // When: Handler aufgerufen
      await adapter.onErinnerungAssigned(event);

      // Then: Payload hat assignedByName = 'Unbekannt'
      expect(mockGateway.emitErinnerungAssigned).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedToName: 'Assigned User',
          assignedByName: 'Unbekannt',
        }),
      );
    });

    it('should log and not propagate database errors (Fire-and-Forget)', async () => {
      // Given: Database query wirft Fehler
      const event = new ErinnerungAssignedEvent(generateValidErinnerungId(), generateValidEinsatzId(), generateValidUserId(), generateValidUserId(), 'DB Error Test', new Date());

      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database connection lost'));

      // When: Handler aufgerufen - sollte nicht throwen
      await expect(adapter.onErinnerungAssigned(event)).resolves.not.toThrow();

      // Then: Fehler wird geloggt
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to emit WebSocket event for ErinnerungAssigned'), 'ErinnerungWebSocketEventAdapter');
    });

    it('should log and not propagate gateway emit errors (Fire-and-Forget)', async () => {
      // Given: Gateway emit wirft Fehler
      const event = new ErinnerungAssignedEvent(generateValidErinnerungId(), generateValidEinsatzId(), generateValidUserId(), generateValidUserId(), 'Gateway Error Test', new Date());

      mockPrisma.user.findUnique.mockResolvedValue({ username: 'Test User' });
      mockGateway.emitErinnerungAssigned.mockImplementation(() => {
        throw new Error('Socket connection closed');
      });

      // When: Handler aufgerufen - sollte nicht throwen
      await expect(adapter.onErinnerungAssigned(event)).resolves.not.toThrow();

      // Then: Fehler wird geloggt
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to emit WebSocket event for ErinnerungAssigned'), 'ErinnerungWebSocketEventAdapter');
    });

    it('should log processing start with correct context', async () => {
      // Given: Valid event
      const erinnerungId = generateValidErinnerungId();
      const einsatzId = generateValidEinsatzId();
      const assignedToId = generateValidUserId();

      const event = new ErinnerungAssignedEvent(erinnerungId, einsatzId, assignedToId, generateValidUserId(), 'Logging Test', new Date());

      mockPrisma.user.findUnique.mockResolvedValue({ username: 'Test' });

      // When: Handler aufgerufen
      await adapter.onErinnerungAssigned(event);

      // Then: Log mit korrektem Context
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining(`erinnerungId=${erinnerungId.toString()}`), 'ErinnerungWebSocketEventAdapter');
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining(`assignedToId=${assignedToId.toString()}`), 'ErinnerungWebSocketEventAdapter');
    });
  });

  describe('onErinnerungErstellt', () => {
    it('should handle erinnerung without assignment', async () => {
      // Given: ErinnerungErstelltEvent ohne Zuweisung
      const event = new ErinnerungErstelltEvent(
        generateValidErinnerungId(),
        generateValidEinsatzId(),
        'Ohne Zuweisung',
        new Date(Date.now() + 30 * 60 * 1000),
        generateValidUserId(),
        null, // Keine Zuweisung
      );

      mockPrisma.user.findUnique.mockResolvedValueOnce({ username: 'Ersteller' });

      // When: Handler aufgerufen
      await adapter.onErinnerungErstellt(event);

      // Then: Payload hat assignedToId/Name als null
      expect(mockGateway.emitErinnerungCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedToId: null,
          assignedToName: null,
        }),
      );
    });

    it('should handle missing gateway gracefully', async () => {
      // Given: Adapter ohne Gateway
      const adapterWithoutGateway = new ErinnerungWebSocketEventAdapter(undefined, mockLogger, mockPrisma as unknown as PrismaService);

      const event = new ErinnerungErstelltEvent(generateValidErinnerungId(), generateValidEinsatzId(), 'No Gateway', new Date(), generateValidUserId(), null);

      // When: Handler aufgerufen
      await adapterWithoutGateway.onErinnerungErstellt(event);

      // Then: Error geloggt, kein Crash
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('ErinnerungGateway not available'), 'ErinnerungWebSocketEventAdapter');
    });
  });
});
