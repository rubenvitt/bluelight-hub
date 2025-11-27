import { EintragAddedEvent } from './eintrag-added.event';
import { EintragUpdatedEvent } from './eintrag-updated.event';
import { EintragDeletedEvent } from './eintrag-deleted.event';
import { EtbLockedEvent } from './etb-locked.event';
import { EtbId } from '@domain/value-objects/etb-id';
import { EintragId } from '@domain/value-objects/eintrag-id';
import { UserId } from '@domain/value-objects/user-id';

// Mock CUID2 for Jest compatibility (ESM module issue)
jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn(() => {
    // Generate valid CUID2 format: starts with lowercase letter, ~25 chars
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

describe('ETB Domain Events', () => {
  let etbId: EtbId;
  let eintragId: EintragId;
  let userId: UserId;

  beforeEach(() => {
    etbId = EtbId.create().value!;
    eintragId = EintragId.create().value!;
    userId = UserId.create().value!;
  });

  describe('EintragAddedEvent', () => {
    it('should have correct event name', () => {
      const event = new EintragAddedEvent(etbId, eintragId, 1, 'Test', userId);
      expect(EintragAddedEvent.eventName()).toBe('etb.eintrag_added');
    });

    it('should auto-generate eventId (CUID)', () => {
      const event = new EintragAddedEvent(etbId, eintragId, 1, 'Test', userId);
      expect(event.eventId).toBeDefined();
      // CUID2 format: starts with lowercase letter, ~25 chars
      expect(event.eventId.length).toBeGreaterThanOrEqual(20);
      expect(event.eventId.length).toBeLessThanOrEqual(30);
      expect(event.eventId).toMatch(/^[a-z][a-z0-9]+$/);
    });

    it('should auto-generate occurredAt timestamp', () => {
      const before = new Date();
      const event = new EintragAddedEvent(etbId, eintragId, 1, 'Test', userId);
      const after = new Date();

      expect(event.occurredAt).toBeDefined();
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should preserve all properties', () => {
      const event = new EintragAddedEvent(etbId, eintragId, 5, 'Test Entry', userId);
      expect(event.etbId).toBe(etbId);
      expect(event.eintragId).toBe(eintragId);
      expect(event.sequenceNumber).toBe(5);
      expect(event.text).toBe('Test Entry');
      expect(event.createdBy).toBe(userId);
    });
  });

  describe('EintragUpdatedEvent', () => {
    it('should have correct event name', () => {
      const event = new EintragUpdatedEvent(etbId, eintragId, 'Old', 'New', userId);
      expect(EintragUpdatedEvent.eventName()).toBe('etb.eintrag_updated');
    });

    it('should preserve oldText and newText for audit trail', () => {
      const event = new EintragUpdatedEvent(etbId, eintragId, 'Original Text', 'Updated Text', userId);
      expect(event.oldText).toBe('Original Text');
      expect(event.newText).toBe('Updated Text');
      expect(event.updatedBy).toBe(userId);
    });

    it('should auto-generate event metadata', () => {
      const event = new EintragUpdatedEvent(etbId, eintragId, 'Old', 'New', userId);
      expect(event.eventId).toBeDefined();
      // CUID2 format validation
      expect(event.eventId.length).toBeGreaterThanOrEqual(20);
      expect(event.occurredAt).toBeInstanceOf(Date);
    });
  });

  describe('EintragDeletedEvent', () => {
    it('should have correct event name', () => {
      const event = new EintragDeletedEvent(etbId, eintragId, userId);
      expect(EintragDeletedEvent.eventName()).toBe('etb.eintrag_deleted');
    });

    it('should preserve deletedBy for audit trail', () => {
      const event = new EintragDeletedEvent(etbId, eintragId, userId);
      expect(event.deletedBy).toBe(userId);
      expect(event.etbId).toBe(etbId);
      expect(event.eintragId).toBe(eintragId);
    });

    it('should auto-generate event metadata', () => {
      const event = new EintragDeletedEvent(etbId, eintragId, userId);
      expect(event.eventId).toBeDefined();
      expect(event.occurredAt).toBeInstanceOf(Date);
    });
  });

  describe('EtbLockedEvent', () => {
    it('should have correct event name', () => {
      const lockedAt = new Date();
      const event = new EtbLockedEvent(etbId, userId, lockedAt);
      expect(EtbLockedEvent.eventName()).toBe('etb.locked');
    });

    it('should preserve lockedAt timestamp', () => {
      const lockedAt = new Date('2025-01-01T12:00:00Z');
      const event = new EtbLockedEvent(etbId, userId, lockedAt);
      expect(event.lockedAt).toBe(lockedAt);
      expect(event.lockedAt.toISOString()).toBe('2025-01-01T12:00:00.000Z');
    });

    it('should preserve all properties', () => {
      const lockedAt = new Date();
      const event = new EtbLockedEvent(etbId, userId, lockedAt);
      expect(event.etbId).toBe(etbId);
      expect(event.lockedBy).toBe(userId);
      expect(event.lockedAt).toBe(lockedAt);
      expect(event.eventId).toBeDefined();
      expect(event.occurredAt).toBeInstanceOf(Date);
    });
  });
});
