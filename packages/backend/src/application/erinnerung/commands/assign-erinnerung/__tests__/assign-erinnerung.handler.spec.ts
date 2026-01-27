import { Test, type TestingModule } from '@nestjs/testing';
import { AssignErinnerungHandler } from '../assign-erinnerung.handler';
import { AssignErinnerungCommand } from '../assign-erinnerung.command';
import { Result } from '@domain/common/result';
import { ErinnerungAssignedEvent } from '@domain/events/erinnerung-assigned.event';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { ERINNERUNG_REPOSITORY, OUTBOX_REPOSITORY, LOGGER } from '@/infrastructure/di-tokens';
import { ERINNERUNG_ERROR_CODES } from '../../../errors/erinnerung-error.codes';
import type { IErinnerungRepository } from '@domain/repositories/i-erinnerung.repository';
import type { IOutboxRepository } from '@domain/repositories/i-outbox.repository';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { Erinnerung } from '@domain/entities/erinnerung.entity';

/**
 * Unit Tests für AssignErinnerungHandler.
 *
 * Story 3.4: Bestehende Erinnerung zuweisen
 *
 * Testet die Handler-Orchestrierung gemäß AAA Pattern mit Given-When-Then Kommentaren.
 * Nutzt Mock Repositories für Unit Test Isolation (AC6 Compliance).
 *
 * **Test Coverage:**
 * - AC1: Erfolgreiche Zuweisung an aktiven Teilnehmer
 * - AC1: Fehler bei nicht-aktivem Teilnehmer
 * - AC1: Fehler bei nicht existierender Erinnerung
 * - AC1: Fehler bei bereits erledigter Erinnerung
 * - AC1: Event wird korrekt emittiert
 * - AC2: Fehler wenn Erinnerung nicht zuweisbar (falscher Status)
 */
describe('AssignErinnerungHandler', () => {
  let handler: AssignErinnerungHandler;
  let mockErinnerungRepository: jest.Mocked<IErinnerungRepository>;
  let mockOutboxRepository: jest.Mocked<IOutboxRepository>;
  let mockPrismaService: { $transaction: jest.Mock };
  let mockLogger: jest.Mocked<ILogger>;

  /**
   * Generiert eine gültige CUID2 EinsatzId für Tests.
   */
  const generateValidEinsatzId = () => EinsatzId.create().value!.toString();

  /**
   * Generiert eine gültige CUID2 UserId für Tests.
   */
  const generateValidUserId = () => UserId.create().value!.toString();

  /**
   * Generiert eine gültige CUID2 ErinnerungId für Tests.
   */
  const generateValidErinnerungId = () => ErinnerungId.create().value!.toString();

  /**
   * Erstellt einen gültigen AssignErinnerungCommand für Tests.
   */
  const createValidCommand = (
    overrides: Partial<{
      erinnerungId: string;
      einsatzId: string;
      assignedToId: string;
      assignedById: string;
    }> = {},
  ) => {
    return AssignErinnerungCommand.create({
      erinnerungId: overrides.erinnerungId ?? generateValidErinnerungId(),
      einsatzId: overrides.einsatzId ?? generateValidEinsatzId(),
      assignedToId: overrides.assignedToId ?? generateValidUserId(),
      assignedById: overrides.assignedById ?? generateValidUserId(),
    });
  };

  /**
   * Erstellt ein Mock-Erinnerung-Objekt.
   */
  const createMockErinnerung = (options: { id: string; einsatzId: string; status?: string; isDeleted?: boolean }): Partial<Erinnerung> => {
    const events: unknown[] = [];
    return {
      id: { toString: () => options.id } as ErinnerungId,
      einsatzId: { toString: () => options.einsatzId } as EinsatzId,
      titel: { value: 'Test Erinnerung' },
      beschreibung: 'Test Beschreibung',
      faelligAm: new Date(Date.now() + 30 * 60 * 1000),
      status: {
        value: options.status ?? 'GEPLANT',
        isActive: () => !['ERLEDIGT', 'ESKALIERT'].includes(options.status ?? 'GEPLANT'),
      },
      erstelltVon: { toString: () => generateValidUserId() },
      createdAt: new Date(),
      updatedAt: new Date(),
      snoozeCount: 0,
      requiresNote: false,
      assignedToId: null,
      isDeleted: options.isDeleted ?? false,
      assignToUser: jest.fn().mockImplementation((assignedToId, assignedById) => {
        if (!['GEPLANT', 'AUSGELOEST', 'ACKNOWLEDGED', 'SNOOZED'].includes(options.status ?? 'GEPLANT')) {
          return Result.fail<void>('ERINNERUNG_NOT_ASSIGNABLE');
        }
        if (options.isDeleted) {
          return Result.fail<void>('ERINNERUNG_NOT_ASSIGNABLE');
        }
        events.push(
          new ErinnerungAssignedEvent(
            { toString: () => options.id } as ErinnerungId,
            { toString: () => options.einsatzId } as EinsatzId,
            assignedToId,
            assignedById,
            'Test Erinnerung',
            new Date(),
            options.id,
          ),
        );
        return Result.ok<void>(undefined);
      }),
      getDomainEvents: jest.fn().mockImplementation(() => [...events]),
      clearDomainEvents: jest.fn().mockImplementation(() => {
        events.length = 0;
      }),
    } as unknown as Partial<Erinnerung>;
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
        const txMock = {
          einsatzTeilnehmer: {
            findFirst: jest.fn().mockResolvedValue({ id: 'default-teilnehmer-id' }),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue({ username: 'Test User' }),
          },
        };
        return callback(txMock);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignErinnerungHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OUTBOX_REPOSITORY, useValue: mockOutboxRepository },
        { provide: ERINNERUNG_REPOSITORY, useValue: mockErinnerungRepository },
        { provide: LOGGER, useValue: mockLogger },
      ],
    }).compile();

    handler = module.get<AssignErinnerungHandler>(AssignErinnerungHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should assign erinnerung successfully to active participant (AC1)', async () => {
      // Given (Arrange)
      const einsatzId = generateValidEinsatzId();
      const erinnerungId = generateValidErinnerungId();
      const assignedToId = generateValidUserId();

      const commandResult = createValidCommand({ erinnerungId, einsatzId, assignedToId });
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      const mockErinnerung = createMockErinnerung({ id: erinnerungId, einsatzId, status: 'GEPLANT' });
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung as Erinnerung));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.id).toBe(erinnerungId);
      expect(result.value!.assignedToId).toBe(assignedToId);
      expect(mockErinnerungRepository.save).toHaveBeenCalledTimes(1);
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should fail when assignedToId is not active participant (AC1)', async () => {
      // Given (Arrange)
      const einsatzId = generateValidEinsatzId();
      const erinnerungId = generateValidErinnerungId();
      const inactiveUserId = generateValidUserId();

      const commandResult = createValidCommand({ erinnerungId, einsatzId, assignedToId: inactiveUserId });
      const command = commandResult.value!;

      const mockErinnerung = createMockErinnerung({ id: erinnerungId, einsatzId, status: 'GEPLANT' });
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung as Erinnerung));

      // Mock: assignedToId ist KEIN aktiver Teilnehmer
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          einsatzTeilnehmer: {
            findFirst: jest.fn().mockResolvedValue(null), // Nicht gefunden = nicht aktiv
          },
        };
        return callback(txMock);
      });

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.INVALID_ASSIGNED_TO);
      expect(mockErinnerungRepository.save).not.toHaveBeenCalled();
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('should fail when erinnerung does not exist (AC1)', async () => {
      // Given (Arrange)
      const commandResult = createValidCommand();
      const command = commandResult.value!;

      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(null));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_FOUND);
      expect(mockErinnerungRepository.save).not.toHaveBeenCalled();
    });

    it('should fail when erinnerung is already completed (ERLEDIGT) (AC1)', async () => {
      // Given (Arrange)
      const einsatzId = generateValidEinsatzId();
      const erinnerungId = generateValidErinnerungId();

      const commandResult = createValidCommand({ erinnerungId, einsatzId });
      const command = commandResult.value!;

      const mockErinnerung = createMockErinnerung({ id: erinnerungId, einsatzId, status: 'ERLEDIGT' });
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung as Erinnerung));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(mockErinnerungRepository.save).not.toHaveBeenCalled();
    });

    it('should fail when erinnerung is escalated (ESKALIERT) (AC1)', async () => {
      // Given (Arrange)
      const einsatzId = generateValidEinsatzId();
      const erinnerungId = generateValidErinnerungId();

      const commandResult = createValidCommand({ erinnerungId, einsatzId });
      const command = commandResult.value!;

      const mockErinnerung = createMockErinnerung({ id: erinnerungId, einsatzId, status: 'ESKALIERT' });
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung as Erinnerung));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(mockErinnerungRepository.save).not.toHaveBeenCalled();
    });

    it('should emit ErinnerungAssignedEvent on success (AC1)', async () => {
      // Given (Arrange)
      const einsatzId = generateValidEinsatzId();
      const erinnerungId = generateValidErinnerungId();

      const commandResult = createValidCommand({ erinnerungId, einsatzId });
      const command = commandResult.value!;

      const mockErinnerung = createMockErinnerung({ id: erinnerungId, einsatzId, status: 'GEPLANT' });
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung as Erinnerung));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);

      const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
      expect(savedEvents.length).toBeGreaterThan(0);

      const assignedEvent = savedEvents[0];
      expect(assignedEvent).toBeInstanceOf(ErinnerungAssignedEvent);
    });

    it('should fail when erinnerung belongs to different einsatz', async () => {
      // Given (Arrange)
      const einsatzId = generateValidEinsatzId();
      const differentEinsatzId = generateValidEinsatzId();
      const erinnerungId = generateValidErinnerungId();

      const commandResult = createValidCommand({ erinnerungId, einsatzId });
      const command = commandResult.value!;

      // Erinnerung gehört zu anderem Einsatz
      const mockErinnerung = createMockErinnerung({ id: erinnerungId, einsatzId: differentEinsatzId, status: 'GEPLANT' });
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung as Erinnerung));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.NOT_FOUND);
      expect(mockErinnerungRepository.save).not.toHaveBeenCalled();
    });

    it('should fail when delegation attempt by non-owner (AC: Only Assignee can delegate)', async () => {
      // Given (Arrange)
      const einsatzId = generateValidEinsatzId();
      const erinnerungId = generateValidErinnerungId();
      const currentAssigneeId = generateValidUserId();
      const otherUserId = generateValidUserId(); // The hacker/unauthorized user
      const newTargetUserId = generateValidUserId();

      // Command: Other User tries to assign (delegate)
      const commandResult = createValidCommand({
        erinnerungId,
        einsatzId,
        assignedById: otherUserId,
        assignedToId: newTargetUserId,
      });
      const command = commandResult.value!;

      // Erinnerung is already assigned to 'currentAssigneeId'
      const mockErinnerung = createMockErinnerung({ id: erinnerungId, einsatzId, status: 'GEPLANT' });
      // Manually set assignedToId on the mock (since createMockErinnerung defaults to null)
      Object.defineProperty(mockErinnerung, 'assignedToId', { get: () => ({ toString: () => currentAssigneeId }) });

      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung as Erinnerung));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      // We expect a permission error -> Using NOT_AUTHORIZED or forbidden
      // Since specific error code might strictly be NOT_FOUND for security or specific ID_INVALID,
      // but here we likely want a specific 'Not Allowed' error.
      // Using generic domain error or creating a new one. For now assuming we reuse an existing or standard error.
      // Let's use a string check or assume we'll add ERINNERUNG_ERROR_CODES.NOT_AUTHORIZED
      expect(result.error).toMatch(/NOT_AUTHORIZED|PERMISSION_DENIED/);
      expect(mockErinnerungRepository.save).not.toHaveBeenCalled();
    });

    it('should succeed when delegation by current owner', async () => {
      // Given (Arrange)
      const einsatzId = generateValidEinsatzId();
      const erinnerungId = generateValidErinnerungId();
      const currentAssigneeId = generateValidUserId();
      const newTargetUserId = generateValidUserId();

      // Command: Current Owner delegates
      const commandResult = createValidCommand({
        erinnerungId,
        einsatzId,
        assignedById: currentAssigneeId,
        assignedToId: newTargetUserId,
      });
      const command = commandResult.value!;

      const mockErinnerung = createMockErinnerung({ id: erinnerungId, einsatzId, status: 'GEPLANT' });
      Object.defineProperty(mockErinnerung, 'assignedToId', { get: () => ({ toString: () => currentAssigneeId }) });

      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung as Erinnerung));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.assignedToId).toBe(newTargetUserId);
    });

    it('should emit correct event data when delegating (assignedBy is preserved)', async () => {
      // Given (Arrange)
      const einsatzId = generateValidEinsatzId();
      const erinnerungId = generateValidErinnerungId();
      const currentAssigneeId = generateValidUserId();
      const newTargetUserId = generateValidUserId();

      const commandResult = createValidCommand({
        erinnerungId,
        einsatzId,
        assignedById: currentAssigneeId,
        assignedToId: newTargetUserId,
      });
      const command = commandResult.value!;

      const mockErinnerung = createMockErinnerung({ id: erinnerungId, einsatzId, status: 'GEPLANT' });
      Object.defineProperty(mockErinnerung, 'assignedToId', { get: () => ({ toString: () => currentAssigneeId }) });

      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung as Erinnerung));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockOutboxRepository.save).toHaveBeenCalled();

      const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
      const assignedEvent = savedEvents[0] as ErinnerungAssignedEvent;

      expect(assignedEvent).toBeInstanceOf(ErinnerungAssignedEvent);
      expect(assignedEvent.assignedToId.toString()).toBe(newTargetUserId);
      expect(assignedEvent.assignedById.toString()).toBe(currentAssigneeId);
    });

    it('should succeed when initial assignment (not assigned yet) by anyone', async () => {
      // Given (Arrange)
      const einsatzId = generateValidEinsatzId();
      const erinnerungId = generateValidErinnerungId();
      const anyUserId = generateValidUserId();

      const commandResult = createValidCommand({
        erinnerungId,
        einsatzId,
        assignedById: anyUserId,
      });
      const command = commandResult.value!;

      const mockErinnerung = createMockErinnerung({ id: erinnerungId, einsatzId, status: 'GEPLANT' });
      // assignedToId is null by default in createMockErinnerung

      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung as Erinnerung));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
    });
  });

  describe('Command Validation', () => {
    it('should fail when erinnerungId is empty', () => {
      // Given & When (Arrange & Act)
      const result = AssignErinnerungCommand.create({
        erinnerungId: '',
        einsatzId: generateValidEinsatzId(),
        assignedToId: generateValidUserId(),
        assignedById: generateValidUserId(),
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.ID_REQUIRED);
    });

    it('should fail when erinnerungId is invalid format', () => {
      // Given & When (Arrange & Act)
      const result = AssignErinnerungCommand.create({
        erinnerungId: 'invalid-id',
        einsatzId: generateValidEinsatzId(),
        assignedToId: generateValidUserId(),
        assignedById: generateValidUserId(),
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.ID_INVALID);
    });

    it('should fail when einsatzId is empty', () => {
      // Given & When (Arrange & Act)
      const result = AssignErinnerungCommand.create({
        erinnerungId: generateValidErinnerungId(),
        einsatzId: '',
        assignedToId: generateValidUserId(),
        assignedById: generateValidUserId(),
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.EINSATZ_ID_REQUIRED);
    });

    it('should fail when assignedToId is empty', () => {
      // Given & When (Arrange & Act)
      const result = AssignErinnerungCommand.create({
        erinnerungId: generateValidErinnerungId(),
        einsatzId: generateValidEinsatzId(),
        assignedToId: '',
        assignedById: generateValidUserId(),
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.INVALID_ASSIGNED_TO);
    });

    it('should fail when assignedById is empty', () => {
      // Given & When (Arrange & Act)
      const result = AssignErinnerungCommand.create({
        erinnerungId: generateValidErinnerungId(),
        einsatzId: generateValidEinsatzId(),
        assignedToId: generateValidUserId(),
        assignedById: '',
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.USER_ID_INVALID);
    });

    it('should succeed with valid command', () => {
      // Given & When (Arrange & Act)
      const result = createValidCommand();

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
    });
  });

  describe('Transaction Behavior', () => {
    it('should execute within prisma transaction', async () => {
      // Given (Arrange)
      const einsatzId = generateValidEinsatzId();
      const erinnerungId = generateValidErinnerungId();

      const commandResult = createValidCommand({ erinnerungId, einsatzId });
      const command = commandResult.value!;

      const mockErinnerung = createMockErinnerung({ id: erinnerungId, einsatzId, status: 'GEPLANT' });
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung as Erinnerung));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should not save events when repository save fails', async () => {
      // Given (Arrange)
      const einsatzId = generateValidEinsatzId();
      const erinnerungId = generateValidErinnerungId();

      const commandResult = createValidCommand({ erinnerungId, einsatzId });
      const command = commandResult.value!;

      const mockErinnerung = createMockErinnerung({ id: erinnerungId, einsatzId, status: 'GEPLANT' });
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung as Erinnerung));
      mockErinnerungRepository.save.mockResolvedValue(Result.fail('Database error'));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(mockErinnerungRepository.save).toHaveBeenCalled();
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('Response DTO Mapping', () => {
    it('should return correctly mapped ErinnerungResponseDto with assignedToName', async () => {
      // Given (Arrange)
      const einsatzId = generateValidEinsatzId();
      const erinnerungId = generateValidErinnerungId();
      const assignedToId = generateValidUserId();

      const commandResult = createValidCommand({ erinnerungId, einsatzId, assignedToId });
      const command = commandResult.value!;

      const mockErinnerung = createMockErinnerung({ id: erinnerungId, einsatzId, status: 'GEPLANT' });
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung as Erinnerung));

      // Mock: User mit Username
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          einsatzTeilnehmer: {
            findFirst: jest.fn().mockResolvedValue({ id: 'teilnehmer-id' }),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue({ username: 'Max Mustermann' }),
          },
        };
        return callback(txMock);
      });

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const dto = result.value!;

      expect(dto.id).toBe(erinnerungId);
      expect(dto.einsatzId).toBe(einsatzId);
      expect(dto.assignedToId).toBe(assignedToId);
      expect(dto.assignedToName).toBe('Max Mustermann');
    });
  });

  describe('Logging', () => {
    it('should log successful assignment', async () => {
      // Given (Arrange)
      const einsatzId = generateValidEinsatzId();
      const erinnerungId = generateValidErinnerungId();

      const commandResult = createValidCommand({ erinnerungId, einsatzId });
      const command = commandResult.value!;

      const mockErinnerung = createMockErinnerung({ id: erinnerungId, einsatzId, status: 'GEPLANT' });
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung as Erinnerung));

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockLogger.log).toHaveBeenCalled();
      const logCall = mockLogger.log.mock.calls[0][0];
      expect(logCall).toContain('Erinnerung zugewiesen');
    });

    it('should log warning when assignedToId is not active participant', async () => {
      // Given (Arrange)
      const einsatzId = generateValidEinsatzId();
      const erinnerungId = generateValidErinnerungId();

      const commandResult = createValidCommand({ erinnerungId, einsatzId });
      const command = commandResult.value!;

      const mockErinnerung = createMockErinnerung({ id: erinnerungId, einsatzId, status: 'GEPLANT' });
      mockErinnerungRepository.findById.mockResolvedValue(Result.ok(mockErinnerung as Erinnerung));

      // Mock: Kein aktiver Teilnehmer
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          einsatzTeilnehmer: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(txMock);
      });

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
      const warnCall = mockLogger.warn.mock.calls[0][0];
      expect(warnCall).toContain('is not an active participant');
    });
  });
});
