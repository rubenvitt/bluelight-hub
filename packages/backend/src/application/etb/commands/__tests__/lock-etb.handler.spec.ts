import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import { EtbLockedEvent } from '@domain/events/etb-locked.event';
import { InMemoryEtbRepository } from '../../__tests__/in-memory-etb.repository';
import { LockEtbCommand } from '../lock-etb/lock-etb.command';
import { LockEtbHandler } from '../lock-etb/lock-etb.handler';
import { AddEintragCommand } from '../add-eintrag/add-eintrag.command';
import { AddEintragHandler } from '../add-eintrag/add-eintrag.handler';
import { createTestEtb } from '@domain/aggregates/__tests__/fixtures/etb.fixtures';

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
    return /^[a-z][a-z0-9]+$/.test(id);
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

describe('LockEtbHandler', () => {
  let lockHandler: LockEtbHandler;
  let addEintragHandler: AddEintragHandler;
  let etbRepository: InMemoryEtbRepository;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;
  let testUserId: string;
  let testEinsatzId: string;

  beforeEach(() => {
    // Reset mocks and repository
    etbRepository = new InMemoryEtbRepository();
    testUserId = generateTestCuid();
    testEinsatzId = generateTestCuid();

    // Mock IEventPublisher (Spy Pattern)
    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
      publishAll: jest.fn().mockResolvedValue(undefined),
    };

    // Create handlers with dependencies
    lockHandler = new LockEtbHandler(etbRepository, mockEventPublisher);
    addEintragHandler = new AddEintragHandler(etbRepository, mockEventPublisher);
  });

  afterEach(() => {
    etbRepository.clear();
    jest.clearAllMocks();
  });

  describe('AC1: LockEtb successfully locks ETB', () => {
    it('should lock ETB and change status to LOCKED', async () => {
      // Arrange: Create ETB with some entries
      const etb = createTestEtb({ entriesCount: 2, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const command = LockEtbCommand.create(etb.id.value, testUserId, 'ADMIN').value!;

      // Act
      const result = await lockHandler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);

      // Verify ETB is now locked
      const savedEtb = await etbRepository.findById(etb.id);
      expect(savedEtb?.isLocked()).toBe(true);
    });

    it('should work with SUPER_ADMIN role', async () => {
      // Arrange
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const command = LockEtbCommand.create(etb.id.value, testUserId, 'SUPER_ADMIN').value!;

      // Act
      const result = await lockHandler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);
      const savedEtb = await etbRepository.findById(etb.id);
      expect(savedEtb?.isLocked()).toBe(true);
    });
  });

  describe('AC2: LockEtb prevents further mutations', () => {
    it('should prevent AddEintrag after lock', async () => {
      // Arrange: Create and lock ETB
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const lockCommand = LockEtbCommand.create(etb.id.value, testUserId, 'ADMIN').value!;
      await lockHandler.execute(lockCommand);

      // Clear mock to track only the AddEintrag call
      mockEventPublisher.publishAll.mockClear();

      // Act: Try to add entry to locked ETB
      const addCommand = AddEintragCommand.create(etb.id.value, 'Neuer Eintrag', testUserId).value!;

      // Assert
      await expect(addEintragHandler.execute(addCommand)).rejects.toThrow(BadRequestException);
      await expect(addEintragHandler.execute(addCommand)).rejects.toThrow('ETB ist gesperrt und kann nicht mehr geändert werden');
    });

    it('should verify locked ETB rejects mutations at aggregate level', async () => {
      // Arrange: Create locked ETB via fixture
      const etb = createTestEtb({ status: 'LOCKED', entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });

      // Act: Try to add entry directly at aggregate level
      const result = etb.addEintrag('Test', testUserId);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('ETB ist gesperrt und kann nicht mehr geändert werden');
    });
  });

  describe('AC3: Locked ETB rejects another LockEtb call', () => {
    it('should throw BadRequestException when ETB is already locked', async () => {
      // Arrange: Create already locked ETB
      const etb = createTestEtb({ status: 'LOCKED', entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const command = LockEtbCommand.create(etb.id.value, testUserId, 'ADMIN').value!;

      // Act & Assert
      await expect(lockHandler.execute(command)).rejects.toThrow(BadRequestException);
      await expect(lockHandler.execute(command)).rejects.toThrow('ETB ist bereits gesperrt');
    });
  });

  describe('AC4: EtbLockedEvent published with correct data', () => {
    it('should publish EtbLockedEvent with etbId, lockedBy and lockedAt', async () => {
      // Arrange
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const command = LockEtbCommand.create(etb.id.value, testUserId, 'ADMIN').value!;
      const beforeLock = new Date();

      // Act
      await lockHandler.execute(command);

      // Assert
      expect(mockEventPublisher.publishAll).toHaveBeenCalledTimes(1);
      const publishedEvents = mockEventPublisher.publishAll.mock.calls[0][0];
      expect(publishedEvents.length).toBe(1);
      expect(publishedEvents[0]).toBeInstanceOf(EtbLockedEvent);

      const event = publishedEvents[0] as EtbLockedEvent;
      expect(event.etbId.value).toBe(etb.id.value);
      expect(event.lockedBy.value).toBe(testUserId);
      expect(event.lockedAt).toBeInstanceOf(Date);
      expect(event.lockedAt.getTime()).toBeGreaterThanOrEqual(beforeLock.getTime());
    });
  });

  describe('AC5: Handler throws NotFoundException when ETB not found', () => {
    it('should throw NotFoundException for non-existent ETB', async () => {
      // Arrange
      const fakeEtbId = generateTestCuid();
      const command = LockEtbCommand.create(fakeEtbId, testUserId, 'ADMIN').value!;

      // Act & Assert
      await expect(lockHandler.execute(command)).rejects.toThrow(NotFoundException);
      await expect(lockHandler.execute(command)).rejects.toThrow('ETB nicht gefunden');
    });
  });

  describe('AC6: Handler throws ForbiddenException for non-admin users', () => {
    it('should throw ForbiddenException when user is not ADMIN or SUPER_ADMIN', async () => {
      // Arrange
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const command = LockEtbCommand.create(etb.id.value, testUserId, 'USER').value!;

      // Act & Assert
      await expect(lockHandler.execute(command)).rejects.toThrow(ForbiddenException);
      await expect(lockHandler.execute(command)).rejects.toThrow('Nur Administratoren können ETB sperren');
    });

    it('should throw ForbiddenException for VIEWER role', async () => {
      // Arrange
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const command = LockEtbCommand.create(etb.id.value, testUserId, 'VIEWER').value!;

      // Act & Assert
      await expect(lockHandler.execute(command)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('AC7: Handler does NOT publish events when operation fails', () => {
    it('should NOT publish events when ETB not found', async () => {
      // Arrange
      const fakeEtbId = generateTestCuid();
      const command = LockEtbCommand.create(fakeEtbId, testUserId, 'ADMIN').value!;

      // Act
      try {
        await lockHandler.execute(command);
      } catch {
        // Expected
      }

      // Assert
      expect(mockEventPublisher.publish).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishAll).not.toHaveBeenCalled();
    });

    it('should NOT publish events when authorization fails', async () => {
      // Arrange
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const command = LockEtbCommand.create(etb.id.value, testUserId, 'USER').value!;

      // Act
      try {
        await lockHandler.execute(command);
      } catch {
        // Expected
      }

      // Assert
      expect(mockEventPublisher.publish).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishAll).not.toHaveBeenCalled();
    });

    it('should NOT publish events when ETB already locked', async () => {
      // Arrange
      const etb = createTestEtb({ status: 'LOCKED', entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const command = LockEtbCommand.create(etb.id.value, testUserId, 'ADMIN').value!;

      // Act
      try {
        await lockHandler.execute(command);
      } catch {
        // Expected
      }

      // Assert
      expect(mockEventPublisher.publish).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishAll).not.toHaveBeenCalled();
    });
  });

  describe('AC8: Command validation', () => {
    it('should fail command creation with empty etbId', () => {
      // Act
      const result = LockEtbCommand.create('', testUserId, 'ADMIN');

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('etbId is required');
    });

    it('should fail command creation with whitespace-only etbId', () => {
      // Act
      const result = LockEtbCommand.create('   ', testUserId, 'ADMIN');

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('etbId is required');
    });

    it('should fail command creation with empty userId', () => {
      // Act
      const result = LockEtbCommand.create(testEinsatzId, '', 'ADMIN');

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('userId is required');
    });

    it('should fail command creation with whitespace-only userId', () => {
      // Act
      const result = LockEtbCommand.create(testEinsatzId, '   ', 'ADMIN');

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('userId is required');
    });

    it('should fail command creation with empty userRole', () => {
      // Act
      const result = LockEtbCommand.create(testEinsatzId, testUserId, '');

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('userRole is required');
    });

    it('should fail command creation with whitespace-only userRole', () => {
      // Act
      const result = LockEtbCommand.create(testEinsatzId, testUserId, '   ');

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('userRole is required');
    });

    it('should succeed command creation with valid inputs', () => {
      // Act
      const result = LockEtbCommand.create(testEinsatzId, testUserId, 'ADMIN');

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.etbId).toBe(testEinsatzId);
      expect(result.value!.userId).toBe(testUserId);
      expect(result.value!.userRole).toBe('ADMIN');
    });
  });
});
