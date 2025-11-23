// Mock cuid2 for Jest compatibility (ESM module issue) - MUST be before imports
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

import { LagekarteCreatedEvent } from '../lagekarte-created.event';
import { DomainEvent } from '@domain/common/domain-event';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';

describe('LagekarteCreatedEvent', () => {
  let testLagekarteId: LagekarteId;
  let testEinsatzId: EinsatzId;
  let testUserId: UserId;

  beforeEach(() => {
    // Create test fixtures
    testLagekarteId = LagekarteId.create().value!;
    testEinsatzId = EinsatzId.create().value!;
    testUserId = UserId.create().value!;
  });

  describe('Event Erstellung', () => {
    it('sollte Event mit allen Properties erstellen', () => {
      // When: Create event
      const event = new LagekarteCreatedEvent(testLagekarteId, testEinsatzId, testUserId, false);

      // Then: All properties set correctly
      expect(event.lagekarteId).toBe(testLagekarteId);
      expect(event.einsatzId).toBe(testEinsatzId);
      expect(event.createdBy).toBe(testUserId);
      expect(event.hasInitialPoi).toBe(false);
      expect(event.eventId).toMatch(/^[a-z][a-z0-9]{19,29}$/);
      expect(event.occurredAt).toBeInstanceOf(Date);
    });

    it('sollte hasInitialPoi=true korrekt setzen', () => {
      // When: Create event with initial POI
      const event = new LagekarteCreatedEvent(testLagekarteId, testEinsatzId, testUserId, true);

      // Then: hasInitialPoi is true
      expect(event.hasInitialPoi).toBe(true);
    });

    it('sollte aggregateId auf lagekarteId.value setzen', () => {
      // When: Create event
      const event = new LagekarteCreatedEvent(testLagekarteId, testEinsatzId, testUserId, false);

      // Then: aggregateId equals lagekarteId.value
      expect(event.aggregateId).toBe(testLagekarteId.value);
    });
  });

  describe('eventName', () => {
    it('sollte Instance Property eventName korrekt setzen', () => {
      // When: Create event
      const event = new LagekarteCreatedEvent(testLagekarteId, testEinsatzId, testUserId, false);

      // Then: eventName is correct
      expect(event.eventName).toBe('lagekarte.created');
    });

    it('sollte static eventName() "lagekarte.created" zurueckgeben', () => {
      // Then: Static eventName returns correct value
      expect(LagekarteCreatedEvent.eventName()).toBe('lagekarte.created');
    });
  });

  describe('DomainEvent Base Class Properties', () => {
    it('sollte eventId automatisch generieren (CUID2 Format)', () => {
      // When: Create event
      const event = new LagekarteCreatedEvent(testLagekarteId, testEinsatzId, testUserId, false);

      // Then: eventId is auto-generated CUID2 (20-30 chars)
      expect(event.eventId).toBeDefined();
      expect(typeof event.eventId).toBe('string');
      expect(event.eventId.length).toBeGreaterThanOrEqual(20);
      expect(event.eventId.length).toBeLessThanOrEqual(30);
      expect(event.eventId).toMatch(/^[a-z][a-z0-9]{19,29}$/);
    });

    it('sollte occurredAt automatisch generieren', () => {
      // Given: Time window
      const beforeCreation = new Date();

      // When: Create event
      const event = new LagekarteCreatedEvent(testLagekarteId, testEinsatzId, testUserId, false);

      // Then: occurredAt is recent
      const afterCreation = new Date();
      expect(event.occurredAt).toBeDefined();
      expect(event.occurredAt).toBeInstanceOf(Date);
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    it('sollte DomainEvent erweitern', () => {
      // When: Create event
      const event = new LagekarteCreatedEvent(testLagekarteId, testEinsatzId, testUserId, false);

      // Then: Event extends DomainEvent
      expect(event).toBeInstanceOf(DomainEvent);
    });
  });

  describe('Immutabilitaet (Readonly Properties)', () => {
    it('sollte alle Properties als readonly haben', () => {
      // Given: Event instance
      const event = new LagekarteCreatedEvent(testLagekarteId, testEinsatzId, testUserId, false);

      // Then: Properties are accessible (TypeScript enforces readonly at compile-time)
      expect(event.lagekarteId).toBeDefined();
      expect(event.einsatzId).toBeDefined();
      expect(event.createdBy).toBeDefined();
      expect(event.hasInitialPoi).toBeDefined();
      expect(event.eventId).toBeDefined();
      expect(event.occurredAt).toBeDefined();
      expect(event.aggregateId).toBeDefined();
    });
  });

  describe('Value Object Typisierung', () => {
    it('sollte mit typed Value Objects arbeiten', () => {
      // When: Create event with typed value objects
      const event = new LagekarteCreatedEvent(testLagekarteId, testEinsatzId, testUserId, false);

      // Then: Types are preserved
      expect(event.lagekarteId).toBeInstanceOf(LagekarteId);
      expect(event.einsatzId).toBeInstanceOf(EinsatzId);
      expect(event.createdBy).toBeInstanceOf(UserId);
    });
  });

  describe('eventVersion', () => {
    it('sollte default Version 1 haben (von DomainEvent Base)', () => {
      // Then: eventVersion() is inherited from DomainEvent
      expect(LagekarteCreatedEvent.eventVersion()).toBe(1);
    });
  });

  describe('Unique EventId Generation', () => {
    it('sollte einzigartige eventIds fuer verschiedene Events generieren', () => {
      // Given: Two events created sequentially
      const event1 = new LagekarteCreatedEvent(testLagekarteId, testEinsatzId, testUserId, false);
      const event2 = new LagekarteCreatedEvent(testLagekarteId, testEinsatzId, testUserId, true);

      // Then: All eventIds are unique
      expect(event1.eventId).not.toBe(event2.eventId);
      expect(event1.eventId).toMatch(/^[a-z][a-z0-9]{19,29}$/);
      expect(event2.eventId).toMatch(/^[a-z][a-z0-9]{19,29}$/);
    });
  });

  describe('Naming Convention', () => {
    it('sollte der Naming Convention folgen (namespace.action_past_tense)', () => {
      // Given: Event name
      const name = LagekarteCreatedEvent.eventName();

      // Then: Follows convention: lowercase dot-separated, past tense
      expect(name).toMatch(/^lagekarte\.[a-z_]+$/);
      expect(name.startsWith('lagekarte.')).toBe(true);
      expect(name).not.toContain(' ');
      expect(name).toBe(name.toLowerCase());
    });
  });
});
