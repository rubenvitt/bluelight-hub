import { EinsatztagebuchAggregate } from './einsatztagebuch.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { EtbStatus } from '@domain/value-objects/etb-status';
import { EintragId } from '@domain/value-objects/eintrag-id';

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

describe('EinsatztagebuchAggregate', () => {
  let einsatzId: EinsatzId;
  let userId: UserId;

  beforeEach(() => {
    einsatzId = EinsatzId.create().value!;
    userId = UserId.create().value!;
  });

  describe('create (Factory Method)', () => {
    it('should create ETB with valid einsatzId', () => {
      // Given: Valid einsatzId
      // When: Creating ETB
      const result = EinsatztagebuchAggregate.create(einsatzId);

      // Then: Success with initialized state
      expect(result.isSuccess).toBe(true);
      expect(result.value?.id).toBeDefined();
      expect(result.value?.einsatzId.equals(einsatzId)).toBe(true);
    });

    it('should initialize with DRAFT status', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      expect(etb.status.equals(EtbStatus.DRAFT())).toBe(true);
    });

    it('should initialize with version 1', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      expect(etb.version.versionNumber).toBe(1);
    });

    it('should initialize with nextSequenceNumber = 1', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      // First entry should get sequence number 1
      const result = etb.addEintrag('Test', userId);
      expect(result.value?.sequenceNumber.value).toBe(1);
    });

    it('should reject null/undefined einsatzId', () => {
      const result = EinsatztagebuchAggregate.create(null as any);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('EinsatzId');
    });
  });

  describe('addEintrag (Sequence Number Auto-Increment)', () => {
    it('should auto-increment sequence numbers (1, 2, 3, ...)', () => {
      // Given: New ETB
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;

      // When: Adding 3 entries
      etb.addEintrag('Entry 1', userId);
      etb.addEintrag('Entry 2', userId);
      etb.addEintrag('Entry 3', userId);

      // Then: Sequence numbers are 1, 2, 3
      const entries = etb.eintraege;
      expect(entries[0].sequenceNumber.value).toBe(1);
      expect(entries[1].sequenceNumber.value).toBe(2);
      expect(entries[2].sequenceNumber.value).toBe(3);
    });

    it('should have no gaps in sequence numbers', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      etb.addEintrag('A', userId);
      etb.addEintrag('B', userId);
      etb.addEintrag('C', userId);

      const sequences = etb.eintraege.map((e) => e.sequenceNumber.value);
      expect(sequences).toEqual([1, 2, 3]);
    });

    it('should keep sequence numbers immutable (cannot change after assignment)', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      const result = etb.addEintrag('Test', userId);
      const entry = result.value!;

      // Sequence number is readonly via ValueObject immutability
      expect(entry.sequenceNumber.value).toBe(1);
      expect(() => {
        (entry.sequenceNumber as any).props.value = 999;
      }).toThrow();
    });
  });

  describe('versioning (Version Increment Logic)', () => {
    it('should increment version on addEintrag', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      expect(etb.version.versionNumber).toBe(1);

      etb.addEintrag('Test', userId);
      expect(etb.version.versionNumber).toBe(2);
    });

    it('should increment version on updateEintrag', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      const eintrag = etb.addEintrag('Original', userId).value!;

      etb.updateEintrag(eintrag.id, 'Updated', userId);
      expect(etb.version.versionNumber).toBe(3); // v1 → v2 (add) → v3 (update)
    });

    it('should increment version on deleteEintrag', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      const eintrag = etb.addEintrag('Test', userId).value!;

      etb.deleteEintrag(eintrag.id, userId);
      expect(etb.version.versionNumber).toBe(3); // v1 → v2 (add) → v3 (delete)
    });

    it('should update version timestamp on changes', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      const timestamp1 = etb.version.timestamp;

      // Wait 2ms
      const waitUntil = Date.now() + 2;
      while (Date.now() < waitUntil) {
        // busy wait
      }

      etb.addEintrag('Test', userId);
      const timestamp2 = etb.version.timestamp;

      expect(timestamp2.getTime()).toBeGreaterThan(timestamp1.getTime());
    });
  });

  describe('locking behavior (Lock Validation)', () => {
    it('should transition to LOCKED via lock() method', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      const result = etb.lock(userId);

      expect(result.isSuccess).toBe(true);
      expect(etb.status.equals(EtbStatus.LOCKED())).toBe(true);
    });

    it('should reject lock() when already LOCKED', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      etb.lock(userId);

      const result = etb.lock(userId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('gesperrt');
    });

    it('should return true for isLocked() when status is LOCKED', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      expect(etb.isLocked()).toBe(false);

      etb.lock(userId);
      expect(etb.isLocked()).toBe(true);
    });

    it('should reject addEintrag when ETB is locked', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      etb.lock(userId);

      const result = etb.addEintrag('Test', userId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('gesperrt');
    });

    it('should reject updateEintrag when ETB is locked', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      const eintrag = etb.addEintrag('Test', userId).value!;
      etb.lock(userId);

      const result = etb.updateEintrag(eintrag.id, 'Updated', userId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('gesperrt');
    });

    it('should reject deleteEintrag when ETB is locked', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      const eintrag = etb.addEintrag('Test', userId).value!;
      etb.lock(userId);

      const result = etb.deleteEintrag(eintrag.id, userId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('gesperrt');
    });
  });

  describe('soft-delete (Soft-Delete Validation)', () => {
    it('should mark entry as deleted but keep in array', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      const eintrag = etb.addEintrag('Test', userId).value!;

      etb.deleteEintrag(eintrag.id, userId);

      // Entry still in array
      expect(etb.eintraege).toHaveLength(1);
      // isDeleted flag set
      expect(etb.eintraege[0].isDeleted).toBe(true);
    });

    it('should not remove deleted entry from eintraege array', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      etb.addEintrag('Entry 1', userId);
      const entry2 = etb.addEintrag('Entry 2', userId).value!;
      etb.addEintrag('Entry 3', userId);

      etb.deleteEintrag(entry2.id, userId);

      // All 3 entries still present
      expect(etb.eintraege).toHaveLength(3);
      expect(etb.eintraege[1].isDeleted).toBe(true);
    });
  });

  describe('event emission (Event Tests)', () => {
    it('should emit EintragAddedEvent on addEintrag', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      etb.clearDomainEvents(); // Clear creation events

      etb.addEintrag('Test', userId);

      const events = etb.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('etb.eintrag_added');
    });

    it('should emit EintragUpdatedEvent on updateEintrag', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      const eintrag = etb.addEintrag('Original', userId).value!;
      etb.clearDomainEvents();

      etb.updateEintrag(eintrag.id, 'Updated', userId);

      const events = etb.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('etb.eintrag_updated');
    });

    it('should emit EintragDeletedEvent on deleteEintrag', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      const eintrag = etb.addEintrag('Test', userId).value!;
      etb.clearDomainEvents();

      etb.deleteEintrag(eintrag.id, userId);

      const events = etb.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('etb.eintrag_deleted');
    });

    it('should emit EtbLockedEvent on lock', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      etb.clearDomainEvents();

      etb.lock(userId);

      const events = etb.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventName).toBe('etb.locked');
    });
  });

  describe('aggregate invariants (Business Rule Validation)', () => {
    it('should reject empty text in addEintrag', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      const result = etb.addEintrag('', userId);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('leer');
    });

    it('should reject whitespace-only text in addEintrag', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      const result = etb.addEintrag('   ', userId);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('leer');
    });

    it('should reject updateEintrag for non-existent entry', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      const fakeId = EintragId.create().value!;

      const result = etb.updateEintrag(fakeId, 'Test', userId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('nicht gefunden');
    });

    it('should reject deleteEintrag for non-existent entry', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      const fakeId = EintragId.create().value!;

      const result = etb.deleteEintrag(fakeId, userId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('nicht gefunden');
    });

    it('should reject updateEintrag for deleted entry', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      const eintrag = etb.addEintrag('Test', userId).value!;
      etb.deleteEintrag(eintrag.id, userId);

      const result = etb.updateEintrag(eintrag.id, 'Updated', userId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Gelöschte');
    });

    it('should reject empty text in updateEintrag', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      const eintrag = etb.addEintrag('Test', userId).value!;

      const result = etb.updateEintrag(eintrag.id, '', userId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('leer');
    });

    it('should reject whitespace-only text in updateEintrag', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      const eintrag = etb.addEintrag('Test', userId).value!;

      const result = etb.updateEintrag(eintrag.id, '   ', userId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('leer');
    });
  });

  describe('additional edge cases', () => {
    it('should preserve entry order across operations', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      etb.addEintrag('Entry A', userId);
      etb.addEintrag('Entry B', userId);
      etb.addEintrag('Entry C', userId);

      const entries = etb.eintraege;
      expect(entries[0].text).toBe('Entry A');
      expect(entries[1].text).toBe('Entry B');
      expect(entries[2].text).toBe('Entry C');
    });

    it('should handle multiple sequential operations correctly', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;

      // Add 5 entries
      for (let i = 1; i <= 5; i++) {
        etb.addEintrag(`Entry ${i}`, userId);
      }

      expect(etb.eintraege).toHaveLength(5);
      expect(etb.version.versionNumber).toBe(6); // v1 initial + 5 adds
    });

    it('should return shallow copy of eintraege array (mutation safety)', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      etb.addEintrag('Test', userId);

      const entries1 = etb.eintraege;
      const entries2 = etb.eintraege;

      // Different array instances
      expect(entries1).not.toBe(entries2);
      // Same content
      expect(entries1).toHaveLength(entries2.length);
    });

    it('should handle deletion of already deleted entry', () => {
      const etb = EinsatztagebuchAggregate.create(einsatzId).value!;
      const eintrag = etb.addEintrag('Test', userId).value!;

      // Delete once
      etb.deleteEintrag(eintrag.id, userId);
      expect(etb.eintraege[0].isDeleted).toBe(true);

      // Delete again - should still work (idempotent)
      const result = etb.deleteEintrag(eintrag.id, userId);
      expect(result.isSuccess).toBe(true);
      expect(etb.eintraege[0].isDeleted).toBe(true);
    });
  });
});
