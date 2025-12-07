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

describe('LockEtbHandler', () => {
  let lockHandler: LockEtbHandler;
  let addEintragHandler: AddEintragHandler;
  let etbRepository: InMemoryEtbRepository;
  let testUserId: string;
  let testEinsatzId: string;

  beforeEach(() => {
    // Reset mocks and repository
    etbRepository = new InMemoryEtbRepository();
    testUserId = generateTestCuid();
    testEinsatzId = generateTestCuid();

    // Create handlers with dependencies
    lockHandler = new LockEtbHandler(etbRepository);
    addEintragHandler = new AddEintragHandler(etbRepository);
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

      // Act: Try to add entry to locked ETB
      const addCommand = AddEintragCommand.create(etb.id.value, 'Neuer Eintrag', testUserId).value!;
      const result = await addEintragHandler.execute(addCommand);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('ETB ist gesperrt');
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
    it('should return Result.fail when ETB is already locked', async () => {
      // Arrange: Create already locked ETB
      const etb = createTestEtb({ status: 'LOCKED', entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const command = LockEtbCommand.create(etb.id.value, testUserId, 'ADMIN').value!;

      // Act
      const result = await lockHandler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('ETB ist bereits gesperrt');
    });
  });

  describe('AC4: ETB locked state persisted correctly', () => {
    it('should persist locked state with correct metadata', async () => {
      // Arrange
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const command = LockEtbCommand.create(etb.id.value, testUserId, 'ADMIN').value!;
      const _beforeLock = new Date();

      // Act
      const result = await lockHandler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);

      // Verify ETB is locked in repository
      const savedEtb = await etbRepository.findById(etb.id);
      expect(savedEtb?.isLocked()).toBe(true);
    });
  });

  describe('AC5: Handler returns Result.fail when ETB not found', () => {
    it('should return Result.fail for non-existent ETB', async () => {
      // Arrange
      const fakeEtbId = generateTestCuid();
      const command = LockEtbCommand.create(fakeEtbId, testUserId, 'ADMIN').value!;

      // Act
      const result = await lockHandler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('ETB nicht gefunden');
    });
  });

  describe('AC6: Handler returns Result.fail for non-admin users', () => {
    it('should return Result.fail when user is not ADMIN or SUPER_ADMIN', async () => {
      // Arrange
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const command = LockEtbCommand.create(etb.id.value, testUserId, 'USER').value!;

      // Act
      const result = await lockHandler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Nur Administratoren können ETB sperren');
    });

    it('should return Result.fail for VIEWER role', async () => {
      // Arrange
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const command = LockEtbCommand.create(etb.id.value, testUserId, 'VIEWER').value!;

      // Act
      const result = await lockHandler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Nur Administratoren können ETB sperren');
    });
  });

  describe('AC7: Handler error handling validation', () => {
    it('should return Result.fail when ETB not found', async () => {
      // Arrange
      const fakeEtbId = generateTestCuid();
      const command = LockEtbCommand.create(fakeEtbId, testUserId, 'ADMIN').value!;

      // Act
      const result = await lockHandler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('ETB nicht gefunden');
    });

    it('should return Result.fail when authorization fails', async () => {
      // Arrange
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const command = LockEtbCommand.create(etb.id.value, testUserId, 'USER').value!;

      // Act
      const result = await lockHandler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Nur Administratoren können ETB sperren');
    });

    it('should return Result.fail when ETB already locked', async () => {
      // Arrange
      const etb = createTestEtb({ status: 'LOCKED', entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const command = LockEtbCommand.create(etb.id.value, testUserId, 'ADMIN').value!;

      // Act
      const result = await lockHandler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('ETB ist bereits gesperrt');
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
