import { BadRequestException } from '@nestjs/common';
import { InMemoryEtbRepository } from '../../__tests__/in-memory-etb.repository';
import { AddEintragCommand } from '../add-eintrag/add-eintrag.command';
import { AddEintragHandler } from '../add-eintrag/add-eintrag.handler';
import { createTestEtb } from '@domain/aggregates/__tests__/fixtures/etb.fixtures';

// Mock CUID2 für deterministische Tests
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

describe('AddEintragHandler', () => {
  let handler: AddEintragHandler;
  let etbRepository: InMemoryEtbRepository;
  let testUserId: string;
  let testEinsatzId: string;

  beforeEach(() => {
    // Reset mocks and repository
    etbRepository = new InMemoryEtbRepository();
    testUserId = generateTestCuid();
    testEinsatzId = generateTestCuid();

    // Create handler with dependencies
    handler = new AddEintragHandler(etbRepository);
  });

  afterEach(() => {
    etbRepository.clear();
    jest.clearAllMocks();
  });

  describe('AC2: AddEintrag increments sequence number correctly (1 → 2 → 3)', () => {
    it('should increment sequence number for each new entry', async () => {
      // Arrange: Create ETB without entries
      const etb = createTestEtb({ entriesCount: 0, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      // Act: Add 3 entries
      const command1 = AddEintragCommand.create(etb.id.value, 'Erster Eintrag', testUserId).value!;
      const result1 = await handler.execute(command1);

      const command2 = AddEintragCommand.create(etb.id.value, 'Zweiter Eintrag', testUserId).value!;
      const result2 = await handler.execute(command2);

      const command3 = AddEintragCommand.create(etb.id.value, 'Dritter Eintrag', testUserId).value!;
      const result3 = await handler.execute(command3);

      // Assert
      expect(result1.isSuccess).toBe(true);
      expect(result1.value!.sequenceNumber.value).toBe(1);

      expect(result2.isSuccess).toBe(true);
      expect(result2.value!.sequenceNumber.value).toBe(2);

      expect(result3.isSuccess).toBe(true);
      expect(result3.value!.sequenceNumber.value).toBe(3);

      // Verify saved ETB has correct entries
      const savedEtb = await etbRepository.findById(etb.id);
      expect(savedEtb?.eintraege.length).toBe(3);
    });

    it('should continue sequence from existing entries', async () => {
      // Arrange: Create ETB with 2 existing entries
      const etb = createTestEtb({ entriesCount: 2, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      // Act: Add 1 more entry
      const command = AddEintragCommand.create(etb.id.value, 'Neuer Eintrag', testUserId).value!;
      const result = await handler.execute(command);

      // Assert: Sequence should be 3 (2 existing + 1 new)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.sequenceNumber.value).toBe(3);
    });
  });

  describe('AC2: AddEintrag fails if ETB locked with specific error message', () => {
    it('should throw BadRequestException when ETB is locked', async () => {
      // Arrange: Create locked ETB
      const etb = createTestEtb({ status: 'LOCKED', entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const command = AddEintragCommand.create(etb.id.value, 'Neuer Eintrag', testUserId).value!;

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
      await expect(handler.execute(command)).rejects.toThrow('ETB ist gesperrt und kann nicht mehr geändert werden');
    });
  });

  describe('AC2: AddEintrag creates snapshot before adding entry', () => {
    it('should create snapshot before mutation', async () => {
      // Arrange: Create ETB without entries (cleaner test)
      const etb = createTestEtb({ entriesCount: 0, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const command = AddEintragCommand.create(etb.id.value, 'Neuer Eintrag', testUserId).value!;

      // Act
      const result = await handler.execute(command);

      // Assert: Entry was added successfully
      expect(result.isSuccess).toBe(true);

      // Verify snapshot was created (aggregate has uncommitted snapshots)
      const savedEtb = await etbRepository.findById(etb.id);
      expect(savedEtb?.hasUncommittedSnapshots()).toBe(true);

      // Verify snapshot contains pre-mutation state (0 entries before addEintrag)
      const snapshots = savedEtb?.getUncommittedSnapshots();
      expect(snapshots?.length).toBeGreaterThanOrEqual(1);
      // The most recent snapshot should contain the pre-mutation state
      const latestSnapshot = snapshots?.[snapshots.length - 1];
      expect(latestSnapshot?.eintraege.length).toBe(0); // Pre-mutation had 0 entries
    });
  });

  describe('AC2: AddEintrag creates correct entry data', () => {
    it('should create entry with correct sequence number', async () => {
      // Arrange: Create ETB with 2 existing entries
      const etb = createTestEtb({ entriesCount: 2, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const command = AddEintragCommand.create(etb.id.value, 'Dritter Eintrag', testUserId).value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value!.sequenceNumber.value).toBe(3);
      expect(result.value!.text).toBe('Dritter Eintrag');

      // Verify saved ETB has correct entry
      const savedEtb = await etbRepository.findById(etb.id);
      expect(savedEtb?.eintraege.length).toBe(3);
      expect(savedEtb?.eintraege[2].sequenceNumber.value).toBe(3);
    });
  });

  describe('AC2: AddEintrag with empty text fails validation', () => {
    it('should fail command creation with empty text', () => {
      // Act
      const result = AddEintragCommand.create(testEinsatzId, '', testUserId);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('text is required and cannot be empty');
    });

    it('should fail command creation with whitespace-only text', () => {
      // Act
      const result = AddEintragCommand.create(testEinsatzId, '   ', testUserId);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('text is required and cannot be empty');
    });

    it('should reject empty text at aggregate level (defense-in-depth)', async () => {
      // Note: This tests the aggregate-level validation when command validation is bypassed
      // In practice, command validation should catch this first (see tests above)
      const etb = createTestEtb({ entriesCount: 0, userId: testUserId, einsatzId: testEinsatzId });

      // Act: Call aggregate's addEintrag directly with empty text
      const result = etb.addEintrag('', testUserId);

      // Assert: Aggregate should reject empty text
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Text darf nicht leer sein');
    });
  });

  describe('AC2: Multiple sequential adds maintain sequence integrity', () => {
    it('should maintain sequence integrity with concurrent-like sequential adds', async () => {
      // Arrange
      const etb = createTestEtb({ entriesCount: 0, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      // Act: Add 5 entries sequentially
      const results = [];
      for (let i = 1; i <= 5; i++) {
        const command = AddEintragCommand.create(etb.id.value, `Eintrag ${i}`, testUserId).value!;
        results.push(await handler.execute(command));
      }

      // Assert: All succeeded with correct sequence numbers
      expect(results.every((r) => r.isSuccess)).toBe(true);
      expect(results.map((r) => r.value!.sequenceNumber.value)).toEqual([1, 2, 3, 4, 5]);

      // Verify final ETB state
      const savedEtb = await etbRepository.findById(etb.id);
      expect(savedEtb?.eintraege.length).toBe(5);
      expect(savedEtb?.eintraege.map((e) => e.sequenceNumber.value)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('Error Handling', () => {
    it('should return failure when ETB not found', async () => {
      // Arrange: Create command for non-existent ETB
      const fakeEtbId = generateTestCuid();
      const command = AddEintragCommand.create(fakeEtbId, 'Test Text', testUserId).value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('ETB nicht gefunden');
    });
  });

  describe('Command Validation', () => {
    it('should fail command creation with empty etbId', () => {
      const result = AddEintragCommand.create('', 'Valid Text', testUserId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('etbId is required');
    });

    it('should fail command creation with empty userId', () => {
      const result = AddEintragCommand.create(testEinsatzId, 'Valid Text', '');
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('userId is required');
    });
  });
});
