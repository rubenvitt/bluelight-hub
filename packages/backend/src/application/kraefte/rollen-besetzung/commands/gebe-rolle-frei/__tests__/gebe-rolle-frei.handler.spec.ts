import { Result } from '@domain/common/result';
import { ROLLEN_BESETZUNG_ERROR_CODES } from '@domain/kraefte/common/rollen-besetzung-error-codes';
import { RollenBesetzung } from '@domain/kraefte/aggregates/rollen-besetzung.aggregate';
import { RollenBesetzungId } from '@domain/kraefte/value-objects/rollen-besetzung-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EinsatzPersonId } from '@domain/kraefte/value-objects/einsatz-person-id';
import { RolleId } from '@domain/kraefte/value-objects/rolle-id';
import { RolleFreigegeben } from '@domain/kraefte/events/rolle-freigegeben.event';
import { GebeRolleFreiCommand } from '../gebe-rolle-frei.command';
import { GebeRolleFreiHandler } from '../gebe-rolle-frei.handler';
import type { IRollenBesetzungRepository } from '@domain/kraefte/repositories/i-rollen-besetzung.repository';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { PrismaService } from '@/infrastructure/database/prisma.service';

// Valid CUID2 test values
const validCuid = 'cm5h8k2x1000008l87v8g3c5a';
const validCuid2 = 'cm5h8k2x1000008l87v8g3c5b';
const validCuid3 = 'cm5h8k2x1000008l87v8g3c5c';
const validCuid4 = 'cm5h8k2x1000008l87v8g3c5d';
const validUserId = 'cm5h8k2x1000008l87v8g3c5e';

/**
 * Helper: Creates a mock RollenBesetzung aggregate for testing.
 */
function createMockRollenBesetzung(options: { isActive?: boolean } = {}): RollenBesetzung {
  const { isActive = true } = options;

  const besetzungResult = RollenBesetzung.reconstitute({
    id: RollenBesetzungId.create(validCuid).value!,
    einsatzId: EinsatzId.create(validCuid2).value!,
    einsatzPersonId: EinsatzPersonId.create(validCuid3).value!,
    rolleId: RolleId.create(validCuid4).value!,
    rollenName: 'LNA',
    personVorname: 'Max',
    personNachname: 'Mustermann',
    createdAt: new Date(),
    createdBy: validUserId,
    updatedAt: new Date(),
    freigegebenAm: isActive ? undefined : new Date(),
    freigegebenVon: isActive ? undefined : validUserId,
  });

  return besetzungResult.value!;
}

/**
 * Creates mock dependencies for GebeRolleFreiHandler.
 */
function createMockDependencies() {
  const mockPrisma = {
    $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) => callback({} as unknown)),
  } as unknown as jest.Mocked<PrismaService>;

  const mockOutboxRepo: jest.Mocked<IOutboxRepository> = {
    save: jest.fn().mockResolvedValue(Result.ok(undefined)),
    saveAll: jest.fn().mockResolvedValue(Result.ok(undefined)),
    findPending: jest.fn().mockResolvedValue(Result.ok([])),
    markAsPublished: jest.fn().mockResolvedValue(Result.ok(undefined)),
    markAsFailed: jest.fn().mockResolvedValue(Result.ok(undefined)),
  };

  const mockRollenBesetzungRepo: jest.Mocked<IRollenBesetzungRepository> = {
    findById: jest.fn(),
    findByEinsatzId: jest.fn(),
    findByEinsatzIdAndRolleId: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockLogger: jest.Mocked<ILogger> = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  return {
    mockPrisma,
    mockOutboxRepo,
    mockRollenBesetzungRepo,
    mockLogger,
  };
}

describe('GebeRolleFreiHandler', () => {
  let handler: GebeRolleFreiHandler;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockOutboxRepo: jest.Mocked<IOutboxRepository>;
  let mockRollenBesetzungRepo: jest.Mocked<IRollenBesetzungRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    jest.clearAllMocks();
    const deps = createMockDependencies();
    mockPrisma = deps.mockPrisma;
    mockOutboxRepo = deps.mockOutboxRepo;
    mockRollenBesetzungRepo = deps.mockRollenBesetzungRepo;
    mockLogger = deps.mockLogger;

    handler = new GebeRolleFreiHandler(mockPrisma, mockOutboxRepo, mockRollenBesetzungRepo, mockLogger);
  });

  describe('Erfolgreiche Freigabe (AC1)', () => {
    it('should release role and emit RolleFreigegeben event', async () => {
      // Given
      const besetzung = createMockRollenBesetzung({ isActive: true });
      mockRollenBesetzungRepo.findById.mockResolvedValue(Result.ok(besetzung));
      mockRollenBesetzungRepo.save.mockResolvedValue(Result.ok(undefined));

      const command = GebeRolleFreiCommand.create({
        rollenBesetzungId: validCuid,
        freigegebenVon: validUserId,
      }).value!;

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(mockRollenBesetzungRepo.findById).toHaveBeenCalled();
      expect(mockRollenBesetzungRepo.save).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('LNA'), 'GebeRolleFreiHandler');
    });

    it('should call freigeben on aggregate which adds domain event', async () => {
      // Given - Aktive Besetzung die freigegeben werden kann
      const besetzung = createMockRollenBesetzung({ isActive: true });
      mockRollenBesetzungRepo.findById.mockResolvedValue(Result.ok(besetzung));
      mockRollenBesetzungRepo.save.mockResolvedValue(Result.ok(undefined));

      const command = GebeRolleFreiCommand.create({
        rollenBesetzungId: validCuid,
        freigegebenVon: validUserId,
      }).value!;

      // Verify besetzung is active before
      expect(besetzung.isActive).toBe(true);

      // When
      const result = await handler.execute(command);

      // Then - Freigabe wurde durchgeführt
      expect(result.isSuccess).toBe(true);
      // Aggregate wurde gespeichert (mit freigegebenAm gesetzt)
      expect(mockRollenBesetzungRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          _freigegebenAm: expect.any(Date),
        }),
        expect.anything(),
      );
    });
  });

  describe('Idempotenz - Doppelte Freigabe (AC3)', () => {
    it('should fail when role is already released', async () => {
      // Given - besetzung already released (isActive = false)
      const besetzung = createMockRollenBesetzung({ isActive: false });
      mockRollenBesetzungRepo.findById.mockResolvedValue(Result.ok(besetzung));

      const command = GebeRolleFreiCommand.create({
        rollenBesetzungId: validCuid,
        freigegebenVon: validUserId,
      }).value!;

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ROLLEN_BESETZUNG_ERROR_CODES.BEREITS_FREIGEGEBEN);
      expect(mockRollenBesetzungRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should fail when RollenBesetzung not found', async () => {
      // Given
      mockRollenBesetzungRepo.findById.mockResolvedValue(Result.ok(null));

      const command = GebeRolleFreiCommand.create({
        rollenBesetzungId: validCuid,
        freigegebenVon: validUserId,
      }).value!;

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ROLLEN_BESETZUNG_ERROR_CODES.ROLLEN_BESETZUNG_NOT_FOUND);
      expect(mockRollenBesetzungRepo.save).not.toHaveBeenCalled();
    });

    it('should fail with DB error when repository findById fails', async () => {
      // Given - DB Error ist ein echtes Problem (nicht "not found")
      mockRollenBesetzungRepo.findById.mockResolvedValue(Result.fail('DB Error'));

      const command = GebeRolleFreiCommand.create({
        rollenBesetzungId: validCuid,
        freigegebenVon: validUserId,
      }).value!;

      // When
      const result = await handler.execute(command);

      // Then - Handler unterscheidet jetzt DB Error von Not Found
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('DB Error');
      expect(mockLogger.error).toHaveBeenCalled(); // DB Errors werden geloggt
    });

    it('should fail when save fails', async () => {
      // Given
      const besetzung = createMockRollenBesetzung({ isActive: true });
      mockRollenBesetzungRepo.findById.mockResolvedValue(Result.ok(besetzung));
      mockRollenBesetzungRepo.save.mockResolvedValue(Result.fail('Save failed'));

      const command = GebeRolleFreiCommand.create({
        rollenBesetzungId: validCuid,
        freigegebenVon: validUserId,
      }).value!;

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Save failed');
    });
  });

  describe('Event Emission (TD2.7 - AC1)', () => {
    it('sollte RolleFreigegeben Event in Outbox speichern', async () => {
      // Given
      const besetzung = createMockRollenBesetzung({ isActive: true });
      mockRollenBesetzungRepo.findById.mockResolvedValue(Result.ok(besetzung));
      mockRollenBesetzungRepo.save.mockResolvedValue(Result.ok(undefined));

      const command = GebeRolleFreiCommand.create({
        rollenBesetzungId: validCuid,
        freigegebenVon: validUserId,
      }).value!;

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(mockOutboxRepo.save).toHaveBeenCalledTimes(1);

      const events = mockOutboxRepo.save.mock.calls[0][0];
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(1);
      expect(events[0]).toBeInstanceOf(RolleFreigegeben);
    });

    it('sollte RolleFreigegeben Event mit korrekten Properties erstellen', async () => {
      // Given
      const besetzung = createMockRollenBesetzung({ isActive: true });
      mockRollenBesetzungRepo.findById.mockResolvedValue(Result.ok(besetzung));
      mockRollenBesetzungRepo.save.mockResolvedValue(Result.ok(undefined));

      const command = GebeRolleFreiCommand.create({
        rollenBesetzungId: validCuid,
        freigegebenVon: validUserId,
      }).value!;

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);

      const events = mockOutboxRepo.save.mock.calls[0][0];
      const freigegebenEvent = events[0] as RolleFreigegeben;

      expect(freigegebenEvent.einsatzId).toBe(validCuid2);
      expect(freigegebenEvent.einsatzPersonId).toBe(validCuid3);
      expect(freigegebenEvent.rollenDefinitionId).toBe(validCuid4);
      expect(freigegebenEvent.rollenName).toBe('LNA');
      expect(freigegebenEvent.personVorname).toBe('Max');
      expect(freigegebenEvent.personNachname).toBe('Mustermann');
      expect(freigegebenEvent.freigegebenVon).toBe(validUserId);
    });

    it('sollte KEIN Event emittieren wenn Rolle bereits freigegeben (Idempotenz)', async () => {
      // Given - Besetzung ist bereits freigegeben (isActive = false)
      const besetzung = createMockRollenBesetzung({ isActive: false });
      mockRollenBesetzungRepo.findById.mockResolvedValue(Result.ok(besetzung));

      const command = GebeRolleFreiCommand.create({
        rollenBesetzungId: validCuid,
        freigegebenVon: validUserId,
      }).value!;

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ROLLEN_BESETZUNG_ERROR_CODES.BEREITS_FREIGEGEBEN);
      // KEIN Event wird gespeichert bei Idempotenz
      expect(mockOutboxRepo.save).not.toHaveBeenCalled();
    });

    it('sollte freigegebenVon korrekt im Event setzen', async () => {
      // Given
      const besetzung = createMockRollenBesetzung({ isActive: true });
      mockRollenBesetzungRepo.findById.mockResolvedValue(Result.ok(besetzung));
      mockRollenBesetzungRepo.save.mockResolvedValue(Result.ok(undefined));

      // Valid CUID2 format for customFreigegebenVon
      const customFreigegebenVon = 'cm5h8k2x1000008l87v8gadmn';
      const command = GebeRolleFreiCommand.create({
        rollenBesetzungId: validCuid,
        freigegebenVon: customFreigegebenVon,
      }).value!;

      // When
      const result = await handler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);

      const events = mockOutboxRepo.save.mock.calls[0][0];
      const freigegebenEvent = events[0] as RolleFreigegeben;
      expect(freigegebenEvent.freigegebenVon).toBe(customFreigegebenVon);
    });
  });
});
