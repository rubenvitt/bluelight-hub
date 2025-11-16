import { EinsatztagebuchAggregate } from '../einsatztagebuch.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { EtbStatus } from '@domain/value-objects/etb-status';

// Mock nanoid for Jest compatibility (ESM module issue)
jest.mock('nanoid/non-secure', () => ({
  nanoid: jest.fn(() => {
    // Generate valid nanoid format: 21 URL-safe characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let result = '';
    for (let i = 0; i < 21; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
}));

describe('EinsatztagebuchAggregate Integration Tests', () => {
  describe('Full Lifecycle: Create → Add → Update → Delete → Lock', () => {
    it('should handle complete ETB lifecycle with event accumulation', () => {
      // Given: Fresh IDs
      const einsatzId = EinsatzId.create().value!;
      const userId = UserId.create().value!;

      // When: Create ETB
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      expect(etb.version.versionNumber).toBe(1);
      expect(etb.status.equals(EtbStatus.DRAFT())).toBe(true);

      // When: Add 3 entries
      const entry1 = etb.addEintrag('First entry', userId).value!;
      const entry2 = etb.addEintrag('Second entry', userId).value!;
      const entry3 = etb.addEintrag('Third entry', userId).value!;

      // Then: Version incremented 3 times
      expect(etb.version.versionNumber).toBe(4); // v1 → v2 → v3 → v4

      // Then: Sequence numbers are monotonic
      expect(entry1.sequenceNumber.value).toBe(1);
      expect(entry2.sequenceNumber.value).toBe(2);
      expect(entry3.sequenceNumber.value).toBe(3);

      // When: Update entry
      etb.updateEintrag(entry2.id, 'Updated second entry', userId);

      // Then: Version incremented again
      expect(etb.version.versionNumber).toBe(5);

      // When: Delete entry
      etb.deleteEintrag(entry1.id, userId);

      // Then: Entry marked as deleted but remains in array
      expect(etb.eintraege).toHaveLength(3);
      expect(etb.eintraege[0].isDeleted).toBe(true);

      // When: Lock ETB
      etb.lock(userId);

      // Then: Status is LOCKED
      expect(etb.status.equals(EtbStatus.LOCKED())).toBe(true);

      // Then: All modifications should fail
      expect(etb.addEintrag('Test', userId).isFailure).toBe(true);
      expect(etb.updateEintrag(entry3.id, 'Test', userId).isFailure).toBe(true);
      expect(etb.deleteEintrag(entry3.id, userId).isFailure).toBe(true);
    });

    it('should accumulate events across operations', () => {
      const einsatzId = EinsatzId.create().value!;
      const userId = UserId.create().value!;

      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      const entry = etb.addEintrag('Test', userId).value!;
      etb.updateEintrag(entry.id, 'Updated', userId);
      etb.deleteEintrag(entry.id, userId);
      etb.lock(userId);

      // Events: 4 operations (add, update, delete, lock)
      const events = etb.getDomainEvents();
      expect(events).toHaveLength(4);
      expect(events.map((e) => e.eventName)).toEqual(['etb.eintrag_added', 'etb.eintrag_updated', 'etb.eintrag_deleted', 'etb.locked']);
    });

    it('should preserve entry order across operations', () => {
      const einsatzId = EinsatzId.create().value!;
      const userId = UserId.create().value!;
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;

      etb.addEintrag('Entry A', userId);
      etb.addEintrag('Entry B', userId);
      etb.addEintrag('Entry C', userId);

      const entries = etb.eintraege;
      expect(entries[0].text).toBe('Entry A');
      expect(entries[1].text).toBe('Entry B');
      expect(entries[2].text).toBe('Entry C');
    });

    it('should create snapshots for history tracking (concept test)', () => {
      const einsatzId = EinsatzId.create().value!;
      const userId = UserId.create().value!;
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;

      // Simulate snapshot creation (actual implementation in Repository, Epic 4)
      const snapshot1 = {
        version: etb.version,
        eintraege: [...etb.eintraege],
        snapshotAt: new Date(),
      };

      etb.addEintrag('Test', userId);

      const snapshot2 = {
        version: etb.version,
        eintraege: [...etb.eintraege],
        snapshotAt: new Date(),
      };

      // Snapshots have different versions
      expect(snapshot1.version.versionNumber).toBe(1);
      expect(snapshot2.version.versionNumber).toBe(2);
      expect(snapshot2.eintraege).toHaveLength(1);
      expect(snapshot1.eintraege).toHaveLength(0);
    });

    it('should handle mixed operations correctly', () => {
      const einsatzId = EinsatzId.create().value!;
      const userId = UserId.create().value!;
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;

      // Add → Update → Add → Delete → Add
      const e1 = etb.addEintrag('Entry 1', userId).value!;
      etb.updateEintrag(e1.id, 'Entry 1 Updated', userId);
      const e2 = etb.addEintrag('Entry 2', userId).value!;
      etb.deleteEintrag(e1.id, userId);
      etb.addEintrag('Entry 3', userId);

      // Final state: 3 entries, 1 deleted, sequence 1-2-3
      expect(etb.eintraege).toHaveLength(3);
      expect(etb.eintraege[0].isDeleted).toBe(true); // e1 deleted
      expect(etb.eintraege[0].text).toBe('Entry 1 Updated');
      expect(etb.eintraege[1].text).toBe('Entry 2');
      expect(etb.eintraege[2].text).toBe('Entry 3');
    });

    it('should maintain version monotonicity across complex workflows', () => {
      const einsatzId = EinsatzId.create().value!;
      const userId = UserId.create().value!;
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;

      const versions: number[] = [etb.version.versionNumber];

      // Perform 10 operations
      for (let i = 0; i < 5; i++) {
        etb.addEintrag(`Entry ${i}`, userId);
        versions.push(etb.version.versionNumber);
      }

      // Verify monotonic increment
      for (let i = 1; i < versions.length; i++) {
        expect(versions[i]).toBe(versions[i - 1] + 1);
      }
    });

    it('should handle concurrent-like operations (sequence test)', () => {
      const einsatzId = EinsatzId.create().value!;
      const userId1 = UserId.create().value!;
      const userId2 = UserId.create().value!;

      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;

      // Simulate multiple users adding entries
      const e1 = etb.addEintrag('User 1 Entry 1', userId1).value!;
      const e2 = etb.addEintrag('User 2 Entry 1', userId2).value!;
      const e3 = etb.addEintrag('User 1 Entry 2', userId1).value!;

      // Verify sequence numbers are correctly assigned
      expect(e1.sequenceNumber.value).toBe(1);
      expect(e2.sequenceNumber.value).toBe(2);
      expect(e3.sequenceNumber.value).toBe(3);

      // Verify creators are tracked
      expect(e1.createdBy.equals(userId1)).toBe(true);
      expect(e2.createdBy.equals(userId2)).toBe(true);
      expect(e3.createdBy.equals(userId1)).toBe(true);
    });

    it('should preserve soft-deleted entries in history across many operations', () => {
      const einsatzId = EinsatzId.create().value!;
      const userId = UserId.create().value!;
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;

      // Add 10 entries
      const entryIds = [];
      for (let i = 0; i < 10; i++) {
        const result = etb.addEintrag(`Entry ${i}`, userId);
        entryIds.push(result.value!.id);
      }

      // Delete every other entry
      for (let i = 0; i < entryIds.length; i += 2) {
        etb.deleteEintrag(entryIds[i], userId);
      }

      // All 10 entries still present
      expect(etb.eintraege).toHaveLength(10);

      // 5 entries marked as deleted
      const deletedCount = etb.eintraege.filter((e) => e.isDeleted).length;
      expect(deletedCount).toBe(5);

      // Sequence numbers still 1-10 (no gaps)
      const sequences = etb.eintraege.map((e) => e.sequenceNumber.value);
      expect(sequences).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
  });
});
