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

import { EinsatzCreatedEvent } from './einsatz-created.event';
import { EinsatzCompletedEvent } from './einsatz-completed.event';
import { EinsatzArchivedEvent } from './einsatz-archived.event';
import { EinsatzStatusChangedEvent } from './einsatz-status-changed.event';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';

describe('Einsatz Domain Events', () => {
  describe('EinsatzCreatedEvent', () => {
    it('should create event with valid properties', () => {
      // Given: Valid event data
      const einsatzId = EinsatzId.create().value!;
      const createdBy = UserId.create().value!;
      const alarmstichwort = 'Wohnungsbrand';

      // When: Creating event
      const event = new EinsatzCreatedEvent(einsatzId, createdBy, alarmstichwort);

      // Then: Properties correct
      expect(event.einsatzId).toBe(einsatzId);
      expect(event.createdBy).toBe(createdBy);
      expect(event.alarmstichwort).toBe(alarmstichwort);
      expect(event.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(event.occurredAt).toBeInstanceOf(Date);
    });

    it('should return correct event name', () => {
      // Given/When: Event class
      // Then: Event name is lowercase dot-separated
      expect(EinsatzCreatedEvent.eventName()).toBe('einsatz.created');
    });

    it('should return default event version', () => {
      // Given/When: Event class
      // Then: Event version is 1 (default from base class)
      expect(EinsatzCreatedEvent.eventVersion()).toBe(1);
    });

    it('should auto-generate unique event IDs', () => {
      // Given: Two events created sequentially
      const einsatzId = EinsatzId.create().value!;
      const userId = UserId.create().value!;
      const event1 = new EinsatzCreatedEvent(einsatzId, userId, 'Test');
      const event2 = new EinsatzCreatedEvent(einsatzId, userId, 'Test');

      // When: Comparing eventIds
      // Then: Different IDs (uniqueness)
      expect(event1.eventId).not.toBe(event2.eventId);
      expect(event1.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(event2.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
    });

    it('should generate recent timestamp', () => {
      // Given/When: Creating event
      const before = new Date();
      const event = new EinsatzCreatedEvent(EinsatzId.create().value!, UserId.create().value!, 'Test');
      const after = new Date();

      // Then: Timestamp is recent (within 1 second)
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should support optional aggregateId', () => {
      // Given: aggregateId provided
      const aggregateId = 'aggregate-123';
      const event = new EinsatzCreatedEvent(EinsatzId.create().value!, UserId.create().value!, 'Test', aggregateId);

      // When/Then: aggregateId is stored
      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should have undefined aggregateId when not provided', () => {
      // Given: No aggregateId
      const event = new EinsatzCreatedEvent(EinsatzId.create().value!, UserId.create().value!, 'Test');

      // When/Then: aggregateId is undefined
      expect(event.aggregateId).toBeUndefined();
    });

    it('should have readonly properties (immutability)', () => {
      // Given: Event instance
      const event = new EinsatzCreatedEvent(EinsatzId.create().value!, UserId.create().value!, 'Test');

      // When/Then: Properties are readonly (TypeScript compile-time check)
      // Note: Runtime immutability is enforced by readonly modifier at compile-time
      // This test verifies the properties exist and are accessible
      expect(event.einsatzId).toBeDefined();
      expect(event.createdBy).toBeDefined();
      expect(event.alarmstichwort).toBeDefined();
      expect(event.eventId).toBeDefined();
      expect(event.occurredAt).toBeDefined();
    });

    it('should work with typed value objects', () => {
      // Given: Typed value objects
      const einsatzId = EinsatzId.create().value!;
      const userId = UserId.create().value!;

      // When: Creating event
      const event = new EinsatzCreatedEvent(einsatzId, userId, 'Test');

      // Then: Types are preserved
      expect(event.einsatzId).toBeInstanceOf(EinsatzId);
      expect(event.createdBy).toBeInstanceOf(UserId);
    });
  });

  describe('EinsatzCompletedEvent', () => {
    it('should create event with valid properties', () => {
      // Given: Valid event data
      const einsatzId = EinsatzId.create().value!;
      const completedBy = UserId.create().value!;
      const completedAt = new Date('2024-11-14T12:34:56.789Z');

      // When: Creating event
      const event = new EinsatzCompletedEvent(einsatzId, completedBy, completedAt);

      // Then: Properties correct
      expect(event.einsatzId).toBe(einsatzId);
      expect(event.completedBy).toBe(completedBy);
      expect(event.completedAt).toBe(completedAt);
      expect(event.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(event.occurredAt).toBeInstanceOf(Date);
    });

    it('should return correct event name', () => {
      // Given/When: Event class
      // Then: Event name is lowercase dot-separated
      expect(EinsatzCompletedEvent.eventName()).toBe('einsatz.completed');
    });

    it('should return default event version', () => {
      // Given/When: Event class
      // Then: Event version is 1 (default from base class)
      expect(EinsatzCompletedEvent.eventVersion()).toBe(1);
    });

    it('should auto-generate unique event IDs', () => {
      // Given: Two events created sequentially
      const einsatzId = EinsatzId.create().value!;
      const userId = UserId.create().value!;
      const completedAt = new Date();
      const event1 = new EinsatzCompletedEvent(einsatzId, userId, completedAt);
      const event2 = new EinsatzCompletedEvent(einsatzId, userId, completedAt);

      // When: Comparing eventIds
      // Then: Different IDs (uniqueness)
      expect(event1.eventId).not.toBe(event2.eventId);
      expect(event1.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(event2.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
    });

    it('should generate recent timestamp', () => {
      // Given/When: Creating event
      const before = new Date();
      const event = new EinsatzCompletedEvent(EinsatzId.create().value!, UserId.create().value!, new Date());
      const after = new Date();

      // Then: Timestamp is recent (within 1 second)
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should support optional aggregateId', () => {
      // Given: aggregateId provided
      const aggregateId = 'aggregate-123';
      const event = new EinsatzCompletedEvent(EinsatzId.create().value!, UserId.create().value!, new Date(), aggregateId);

      // When/Then: aggregateId is stored
      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should have undefined aggregateId when not provided', () => {
      // Given: No aggregateId
      const event = new EinsatzCompletedEvent(EinsatzId.create().value!, UserId.create().value!, new Date());

      // When/Then: aggregateId is undefined
      expect(event.aggregateId).toBeUndefined();
    });

    it('should have readonly properties (immutability)', () => {
      // Given: Event instance
      const event = new EinsatzCompletedEvent(EinsatzId.create().value!, UserId.create().value!, new Date());

      // When/Then: Properties are readonly (TypeScript compile-time check)
      expect(event.einsatzId).toBeDefined();
      expect(event.completedBy).toBeDefined();
      expect(event.completedAt).toBeDefined();
      expect(event.eventId).toBeDefined();
      expect(event.occurredAt).toBeDefined();
    });

    it('should work with typed value objects', () => {
      // Given: Typed value objects
      const einsatzId = EinsatzId.create().value!;
      const userId = UserId.create().value!;

      // When: Creating event
      const event = new EinsatzCompletedEvent(einsatzId, userId, new Date());

      // Then: Types are preserved
      expect(event.einsatzId).toBeInstanceOf(EinsatzId);
      expect(event.completedBy).toBeInstanceOf(UserId);
    });

    it('should preserve completedAt timestamp exactly', () => {
      // Given: Specific completion timestamp
      const completedAt = new Date('2024-11-14T12:34:56.789Z');
      const event = new EinsatzCompletedEvent(EinsatzId.create().value!, UserId.create().value!, completedAt);

      // When/Then: Timestamp is preserved exactly (not auto-generated)
      expect(event.completedAt).toBe(completedAt);
      expect(event.completedAt.toISOString()).toBe('2024-11-14T12:34:56.789Z');
    });
  });

  describe('EinsatzArchivedEvent', () => {
    it('should create event with valid properties', () => {
      // Given: Valid event data
      const einsatzId = EinsatzId.create().value!;
      const archivedBy = UserId.create().value!;

      // When: Creating event
      const event = new EinsatzArchivedEvent(einsatzId, archivedBy);

      // Then: Properties correct
      expect(event.einsatzId).toBe(einsatzId);
      expect(event.archivedBy).toBe(archivedBy);
      expect(event.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(event.occurredAt).toBeInstanceOf(Date);
    });

    it('should return correct event name', () => {
      // Given/When: Event class
      // Then: Event name is lowercase dot-separated
      expect(EinsatzArchivedEvent.eventName()).toBe('einsatz.archived');
    });

    it('should return default event version', () => {
      // Given/When: Event class
      // Then: Event version is 1 (default from base class)
      expect(EinsatzArchivedEvent.eventVersion()).toBe(1);
    });

    it('should auto-generate unique event IDs', () => {
      // Given: Two events created sequentially
      const einsatzId = EinsatzId.create().value!;
      const userId = UserId.create().value!;
      const event1 = new EinsatzArchivedEvent(einsatzId, userId);
      const event2 = new EinsatzArchivedEvent(einsatzId, userId);

      // When: Comparing eventIds
      // Then: Different IDs (uniqueness)
      expect(event1.eventId).not.toBe(event2.eventId);
      expect(event1.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(event2.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
    });

    it('should generate recent timestamp', () => {
      // Given/When: Creating event
      const before = new Date();
      const event = new EinsatzArchivedEvent(EinsatzId.create().value!, UserId.create().value!);
      const after = new Date();

      // Then: Timestamp is recent (within 1 second)
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should support optional aggregateId', () => {
      // Given: aggregateId provided
      const aggregateId = 'aggregate-123';
      const event = new EinsatzArchivedEvent(EinsatzId.create().value!, UserId.create().value!, aggregateId);

      // When/Then: aggregateId is stored
      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should have undefined aggregateId when not provided', () => {
      // Given: No aggregateId
      const event = new EinsatzArchivedEvent(EinsatzId.create().value!, UserId.create().value!);

      // When/Then: aggregateId is undefined
      expect(event.aggregateId).toBeUndefined();
    });

    it('should have readonly properties (immutability)', () => {
      // Given: Event instance
      const event = new EinsatzArchivedEvent(EinsatzId.create().value!, UserId.create().value!);

      // When/Then: Properties are readonly (TypeScript compile-time check)
      expect(event.einsatzId).toBeDefined();
      expect(event.archivedBy).toBeDefined();
      expect(event.eventId).toBeDefined();
      expect(event.occurredAt).toBeDefined();
    });

    it('should work with typed value objects', () => {
      // Given: Typed value objects
      const einsatzId = EinsatzId.create().value!;
      const userId = UserId.create().value!;

      // When: Creating event
      const event = new EinsatzArchivedEvent(einsatzId, userId);

      // Then: Types are preserved
      expect(event.einsatzId).toBeInstanceOf(EinsatzId);
      expect(event.archivedBy).toBeInstanceOf(UserId);
    });
  });

  describe('EinsatzStatusChangedEvent', () => {
    it('should create event with valid properties', () => {
      // Given: Valid event data
      const einsatzId = EinsatzId.create().value!;
      const oldStatus = EinsatzStatus.ANGELEGT();
      const newStatus = EinsatzStatus.IN_BEARBEITUNG();

      // When: Creating event
      const event = new EinsatzStatusChangedEvent(einsatzId, oldStatus, newStatus);

      // Then: Properties correct
      expect(event.einsatzId).toBe(einsatzId);
      expect(event.oldStatus).toBe(oldStatus);
      expect(event.newStatus).toBe(newStatus);
      expect(event.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(event.occurredAt).toBeInstanceOf(Date);
    });

    it('should return correct event name', () => {
      // Given/When: Event class
      // Then: Event name is lowercase dot-separated with snake_case
      expect(EinsatzStatusChangedEvent.eventName()).toBe('einsatz.status_changed');
    });

    it('should return default event version', () => {
      // Given/When: Event class
      // Then: Event version is 1 (default from base class)
      expect(EinsatzStatusChangedEvent.eventVersion()).toBe(1);
    });

    it('should auto-generate unique event IDs', () => {
      // Given: Two events created sequentially
      const einsatzId = EinsatzId.create().value!;
      const oldStatus = EinsatzStatus.ANGELEGT();
      const newStatus = EinsatzStatus.IN_BEARBEITUNG();
      const event1 = new EinsatzStatusChangedEvent(einsatzId, oldStatus, newStatus);
      const event2 = new EinsatzStatusChangedEvent(einsatzId, oldStatus, newStatus);

      // When: Comparing eventIds
      // Then: Different IDs (uniqueness)
      expect(event1.eventId).not.toBe(event2.eventId);
      expect(event1.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
      expect(event2.eventId).toMatch(/^[A-Za-z0-9_-]{21}$/);
    });

    it('should generate recent timestamp', () => {
      // Given/When: Creating event
      const before = new Date();
      const event = new EinsatzStatusChangedEvent(EinsatzId.create().value!, EinsatzStatus.ANGELEGT(), EinsatzStatus.IN_BEARBEITUNG());
      const after = new Date();

      // Then: Timestamp is recent (within 1 second)
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should support optional aggregateId', () => {
      // Given: aggregateId provided
      const aggregateId = 'aggregate-123';
      const event = new EinsatzStatusChangedEvent(EinsatzId.create().value!, EinsatzStatus.ANGELEGT(), EinsatzStatus.IN_BEARBEITUNG(), aggregateId);

      // When/Then: aggregateId is stored
      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should have undefined aggregateId when not provided', () => {
      // Given: No aggregateId
      const event = new EinsatzStatusChangedEvent(EinsatzId.create().value!, EinsatzStatus.ANGELEGT(), EinsatzStatus.IN_BEARBEITUNG());

      // When/Then: aggregateId is undefined
      expect(event.aggregateId).toBeUndefined();
    });

    it('should have readonly properties (immutability)', () => {
      // Given: Event instance
      const event = new EinsatzStatusChangedEvent(EinsatzId.create().value!, EinsatzStatus.ANGELEGT(), EinsatzStatus.IN_BEARBEITUNG());

      // When/Then: Properties are readonly (TypeScript compile-time check)
      expect(event.einsatzId).toBeDefined();
      expect(event.oldStatus).toBeDefined();
      expect(event.newStatus).toBeDefined();
      expect(event.eventId).toBeDefined();
      expect(event.occurredAt).toBeDefined();
    });

    it('should work with typed value objects', () => {
      // Given: Typed value objects
      const einsatzId = EinsatzId.create().value!;
      const oldStatus = EinsatzStatus.ANGELEGT();
      const newStatus = EinsatzStatus.IN_BEARBEITUNG();

      // When: Creating event
      const event = new EinsatzStatusChangedEvent(einsatzId, oldStatus, newStatus);

      // Then: Types are preserved
      expect(event.einsatzId).toBeInstanceOf(EinsatzId);
      expect(event.oldStatus).toBeInstanceOf(EinsatzStatus);
      expect(event.newStatus).toBeInstanceOf(EinsatzStatus);
    });

    it('should preserve status transition information', () => {
      // Given: Status transition ANGELEGT → ABGESCHLOSSEN
      const oldStatus = EinsatzStatus.ANGELEGT();
      const newStatus = EinsatzStatus.ABGESCHLOSSEN();
      const event = new EinsatzStatusChangedEvent(EinsatzId.create().value!, oldStatus, newStatus);

      // When/Then: Transition is preserved
      expect(event.oldStatus.value).toBe('ANGELEGT');
      expect(event.newStatus.value).toBe('ABGESCHLOSSEN');
      expect(event.oldStatus.equals(newStatus)).toBe(false);
    });

    it('should support all valid status transitions', () => {
      // Given: Different status transitions
      const einsatzId = EinsatzId.create().value!;

      // When/Then: ANGELEGT → IN_BEARBEITUNG
      const event1 = new EinsatzStatusChangedEvent(einsatzId, EinsatzStatus.ANGELEGT(), EinsatzStatus.IN_BEARBEITUNG());
      expect(event1.oldStatus.value).toBe('ANGELEGT');
      expect(event1.newStatus.value).toBe('IN_BEARBEITUNG');

      // When/Then: IN_BEARBEITUNG → ABGESCHLOSSEN
      const event2 = new EinsatzStatusChangedEvent(einsatzId, EinsatzStatus.IN_BEARBEITUNG(), EinsatzStatus.ABGESCHLOSSEN());
      expect(event2.oldStatus.value).toBe('IN_BEARBEITUNG');
      expect(event2.newStatus.value).toBe('ABGESCHLOSSEN');

      // When/Then: ABGESCHLOSSEN → ARCHIVIERT
      const event3 = new EinsatzStatusChangedEvent(einsatzId, EinsatzStatus.ABGESCHLOSSEN(), EinsatzStatus.ARCHIVIERT());
      expect(event3.oldStatus.value).toBe('ABGESCHLOSSEN');
      expect(event3.newStatus.value).toBe('ARCHIVIERT');
    });
  });
});
