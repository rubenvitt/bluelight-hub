import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InMemoryEtbRepository } from '../../__tests__/in-memory-etb.repository';
import { DeleteEintragCommand } from '../delete-eintrag/delete-eintrag.command';
import { DeleteEintragHandler } from '../delete-eintrag/delete-eintrag.handler';
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

describe('DeleteEintragHandler', () => {
  let handler: DeleteEintragHandler;
  let etbRepository: InMemoryEtbRepository;
  let testUserId: string;
  let testEinsatzId: string;

  beforeEach(() => {
    // Reset mocks and repository
    etbRepository = new InMemoryEtbRepository();
    testUserId = generateTestCuid();
    testEinsatzId = generateTestCuid();

    // Create handler with dependencies
    handler = new DeleteEintragHandler(etbRepository);
  });

  afterEach(() => {
    etbRepository.clear();
    jest.clearAllMocks();
  });

  describe('AC1: DeleteEintrag soft-deletes entry (isDeleted flag set to true)', () => {
    it('should mark entry as deleted with isDeleted=true', async () => {
      // Arrange: Create ETB with one entry
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);
      const eintragId = etb.eintraege[0].id.value;

      // Pre-condition: Entry is not deleted
      expect(etb.eintraege[0].isDeleted).toBe(false);

      // Act
      const command = DeleteEintragCommand.create(etb.id.value, eintragId, testUserId).value!;
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);
      const savedEtb = await etbRepository.findById(etb.id);
      expect(savedEtb?.eintraege[0].isDeleted).toBe(true);
    });
  });

  describe('AC2: Soft-deleted entries remain in ETB (not physically removed)', () => {
    it('should keep entry in eintraege array after deletion', async () => {
      // Arrange: Create ETB with 3 entries
      const etb = createTestEtb({ entriesCount: 3, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);
      const eintragToDelete = etb.eintraege[1];

      // Act: Delete middle entry
      const command = DeleteEintragCommand.create(etb.id.value, eintragToDelete.id.value, testUserId).value!;
      await handler.execute(command);

      // Assert: All 3 entries still exist
      const savedEtb = await etbRepository.findById(etb.id);
      expect(savedEtb?.eintraege.length).toBe(3);

      // Only the deleted entry has isDeleted=true
      expect(savedEtb?.eintraege[0].isDeleted).toBe(false);
      expect(savedEtb?.eintraege[1].isDeleted).toBe(true);
      expect(savedEtb?.eintraege[2].isDeleted).toBe(false);
    });
  });

  describe('AC3: DeleteEintrag creates snapshot before mutation', () => {
    it('should create snapshot before soft-delete', async () => {
      // Arrange: Create ETB with one entry
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      // createTestEtb clears domain events but may have snapshots from addEintrag
      const initialSnapshotCount = etb.getUncommittedSnapshots().length;
      await etbRepository.save(etb);
      const eintragId = etb.eintraege[0].id.value;

      // Act
      const command = DeleteEintragCommand.create(etb.id.value, eintragId, testUserId).value!;
      await handler.execute(command);

      // Assert: At least one new snapshot was created
      const savedEtb = await etbRepository.findById(etb.id);
      expect(savedEtb?.hasUncommittedSnapshots()).toBe(true);
      expect(savedEtb?.getUncommittedSnapshots().length).toBeGreaterThan(initialSnapshotCount);

      // Verify the most recent snapshot contains pre-mutation state (entry not deleted)
      const snapshots = savedEtb?.getUncommittedSnapshots();
      expect(snapshots?.length).toBeGreaterThanOrEqual(1);
      const latestSnapshot = snapshots?.[snapshots.length - 1];
      // In snapshot, the entry should NOT be deleted (pre-mutation state)
      const snapshotEntry = latestSnapshot?.eintraege.find((e) => e.id === eintragId);
      expect(snapshotEntry?.isDeleted).toBe(false);
    });
  });

  describe('AC4: DeleteEintrag marks entry as deleted', () => {
    it('should mark entry as deleted in repository', async () => {
      // Arrange: Create ETB with one entry
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);
      const eintrag = etb.eintraege[0];

      // Act
      const command = DeleteEintragCommand.create(etb.id.value, eintrag.id.value, testUserId).value!;
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);

      // Verify entry is marked as deleted
      const savedEtb = await etbRepository.findById(etb.id);
      const deletedEntry = savedEtb?.eintraege.find((e) => e.id.value === eintrag.id.value);
      expect(deletedEntry?.isDeleted).toBe(true);
    });
  });

  describe('AC5: DeleteEintrag fails if ETB is locked', () => {
    it('should throw BadRequestException when ETB is locked', async () => {
      // Arrange: Create locked ETB with entry
      const etb = createTestEtb({ status: 'LOCKED', entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);
      const eintragId = etb.eintraege[0].id.value;

      const command = DeleteEintragCommand.create(etb.id.value, eintragId, testUserId).value!;

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
      await expect(handler.execute(command)).rejects.toThrow('ETB ist gesperrt und kann nicht mehr geändert werden');
    });
  });

  describe('AC6: DeleteEintrag fails if Eintrag not found', () => {
    it('should throw BadRequestException when entry does not exist', async () => {
      // Arrange: Create ETB without the entry we're trying to delete
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);
      const fakeEintragId = generateTestCuid();

      const command = DeleteEintragCommand.create(etb.id.value, fakeEintragId, testUserId).value!;

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
      await expect(handler.execute(command)).rejects.toThrow('Eintrag nicht gefunden');
    });
  });

  describe('AC7: Handler throws NotFoundException when ETB not found', () => {
    it('should throw NotFoundException when ETB does not exist', async () => {
      // Arrange: Create command for non-existent ETB
      const fakeEtbId = generateTestCuid();
      const fakeEintragId = generateTestCuid();
      const command = DeleteEintragCommand.create(fakeEtbId, fakeEintragId, testUserId).value!;

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
      await expect(handler.execute(command)).rejects.toThrow('ETB nicht gefunden');
    });
  });

  describe('AC8: Handler validation', () => {
    it('should throw NotFoundException when ETB not found', async () => {
      // Arrange: Non-existent ETB
      const fakeEtbId = generateTestCuid();
      const fakeEintragId = generateTestCuid();
      const command = DeleteEintragCommand.create(fakeEtbId, fakeEintragId, testUserId).value!;

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when ETB is locked', async () => {
      // Arrange: Locked ETB
      const etb = createTestEtb({ status: 'LOCKED', entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);
      const eintragId = etb.eintraege[0].id.value;

      const command = DeleteEintragCommand.create(etb.id.value, eintragId, testUserId).value!;

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    });
  });

  describe('AC9: Sequence numbers preserved after delete (no gaps)', () => {
    it('should maintain sequence numbers after multiple deletes', async () => {
      // Arrange: Create ETB with 5 entries (sequences 1, 2, 3, 4, 5)
      const etb = createTestEtb({ entriesCount: 5, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      // Verify initial sequence numbers
      expect(etb.eintraege.map((e) => e.sequenceNumber.value)).toEqual([1, 2, 3, 4, 5]);

      // Act: Delete entries 2 and 4
      const command2 = DeleteEintragCommand.create(etb.id.value, etb.eintraege[1].id.value, testUserId).value!;
      await handler.execute(command2);

      const command4 = DeleteEintragCommand.create(etb.id.value, etb.eintraege[3].id.value, testUserId).value!;
      await handler.execute(command4);

      // Assert: Sequence numbers unchanged
      const savedEtb = await etbRepository.findById(etb.id);
      expect(savedEtb?.eintraege.length).toBe(5); // All entries still present
      expect(savedEtb?.eintraege.map((e) => e.sequenceNumber.value)).toEqual([1, 2, 3, 4, 5]);

      // Verify deletion flags
      expect(savedEtb?.eintraege[0].isDeleted).toBe(false);
      expect(savedEtb?.eintraege[1].isDeleted).toBe(true);
      expect(savedEtb?.eintraege[2].isDeleted).toBe(false);
      expect(savedEtb?.eintraege[3].isDeleted).toBe(true);
      expect(savedEtb?.eintraege[4].isDeleted).toBe(false);
    });
  });

  describe('AC10: Command validation', () => {
    it('should fail command creation with empty etbId', () => {
      const result = DeleteEintragCommand.create('', generateTestCuid(), testUserId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('etbId is required');
    });

    it('should fail command creation with whitespace-only etbId', () => {
      const result = DeleteEintragCommand.create('   ', generateTestCuid(), testUserId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('etbId is required');
    });

    it('should fail command creation with empty eintragId', () => {
      const result = DeleteEintragCommand.create(generateTestCuid(), '', testUserId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('eintragId is required');
    });

    it('should fail command creation with whitespace-only eintragId', () => {
      const result = DeleteEintragCommand.create(generateTestCuid(), '   ', testUserId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('eintragId is required');
    });

    it('should fail command creation with empty userId', () => {
      const result = DeleteEintragCommand.create(generateTestCuid(), generateTestCuid(), '');
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('userId is required');
    });

    it('should fail command creation with whitespace-only userId', () => {
      const result = DeleteEintragCommand.create(generateTestCuid(), generateTestCuid(), '   ');
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('userId is required');
    });
  });

  describe('Idempotency: Deleting already deleted entry', () => {
    it('should succeed when deleting an already deleted entry (idempotent)', async () => {
      // Arrange: Create ETB with one entry
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);
      const eintragId = etb.eintraege[0].id.value;

      // Act: Delete twice
      const command1 = DeleteEintragCommand.create(etb.id.value, eintragId, testUserId).value!;
      await handler.execute(command1);

      const command2 = DeleteEintragCommand.create(etb.id.value, eintragId, testUserId).value!;
      const result2 = await handler.execute(command2);

      // Assert: Second delete also succeeds (idempotent behavior)
      expect(result2.isSuccess).toBe(true);

      // Entry is still deleted
      const savedEtb = await etbRepository.findById(etb.id);
      expect(savedEtb?.eintraege[0].isDeleted).toBe(true);
    });
  });
});
