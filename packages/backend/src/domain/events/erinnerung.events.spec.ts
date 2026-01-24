// Mock cuid2 for Jest compatibility (ESM module issue)
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

import { ErinnerungErstelltEvent } from './erinnerung-erstellt.event';
import { ErinnerungAktualisiertEvent } from './erinnerung-aktualisiert.event';
import { ErinnerungGeloeschtEvent } from './erinnerung-geloescht.event';
import { ErinnerungAusgeloestEvent } from './erinnerung-ausgeloest.event';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';

describe('Erinnerung Domain Events', () => {
  describe('ErinnerungErstelltEvent', () => {
    it('should create event with valid properties', () => {
      // Given: Valid event data
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const erstelltVon = UserId.create().value!;
      const titel = 'Lagebesprechung';
      const faelligAm = new Date('2026-01-20T15:00:00.000Z');

      // When: Creating event (Story 3.3: mit null für assignedToId)
      const event = new ErinnerungErstelltEvent(erinnerungId, einsatzId, titel, faelligAm, erstelltVon, null);

      // Then: Properties correct
      expect(event.erinnerungId).toBe(erinnerungId);
      expect(event.einsatzId).toBe(einsatzId);
      expect(event.titel).toBe(titel);
      expect(event.faelligAm).toBe(faelligAm);
      expect(event.erstelltVon).toBe(erstelltVon);
      expect(event.assignedToId).toBeNull();
      expect(event.eventId.length).toBeGreaterThanOrEqual(20);
      expect(event.eventId.length).toBeLessThanOrEqual(30);
      expect(event.eventId).toMatch(/^[a-z][a-z0-9]+$/);
      expect(event.occurredAt).toBeInstanceOf(Date);
    });

    it('should return correct event name', () => {
      expect(ErinnerungErstelltEvent.eventName()).toBe('erinnerung.erstellt');
    });

    it('should return default event version', () => {
      expect(ErinnerungErstelltEvent.eventVersion()).toBe(1);
    });

    it('should auto-generate unique event IDs', () => {
      // Given: Two events created sequentially
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const userId = UserId.create().value!;
      const event1 = new ErinnerungErstelltEvent(erinnerungId, einsatzId, 'Test', new Date(), userId, null);
      const event2 = new ErinnerungErstelltEvent(erinnerungId, einsatzId, 'Test', new Date(), userId, null);

      // Then: Different IDs (uniqueness)
      expect(event1.eventId).not.toBe(event2.eventId);
    });

    it('should support optional aggregateId', () => {
      // Given: aggregateId provided (Story 3.3: assignedToId vor aggregateId)
      const aggregateId = 'aggregate-123';
      const event = new ErinnerungErstelltEvent(ErinnerungId.create().value!, EinsatzId.create().value!, 'Test', new Date(), UserId.create().value!, null, aggregateId);

      // Then: aggregateId is stored
      expect(event.aggregateId).toBe(aggregateId);
    });
  });

  describe('ErinnerungAktualisiertEvent', () => {
    it('should create event with valid properties', () => {
      // Given: Valid event data
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const aktualisierVon = UserId.create().value!;
      const aenderungen = { titel: 'Neuer Titel', faelligAm: new Date() };

      // When: Creating event
      const event = new ErinnerungAktualisiertEvent(erinnerungId, einsatzId, aenderungen, aktualisierVon, 'Alter Titel');

      // Then: Properties correct
      expect(event.erinnerungId).toBe(erinnerungId);
      expect(event.einsatzId).toBe(einsatzId);
      expect(event.aenderungen).toBe(aenderungen);
      expect(event.aktualisierVon).toBe(aktualisierVon);
      expect(event.titel).toBe('Alter Titel');
      expect(event.eventId).toMatch(/^[a-z][a-z0-9]+$/);
    });

    it('should return correct event name', () => {
      expect(ErinnerungAktualisiertEvent.eventName()).toBe('erinnerung.aktualisiert');
    });

    it('should return default event version', () => {
      expect(ErinnerungAktualisiertEvent.eventVersion()).toBe(1);
    });
  });

  describe('ErinnerungGeloeschtEvent', () => {
    it('should create event with valid properties', () => {
      // Given: Valid event data
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const geloeschtVon = UserId.create().value!;
      const titel = 'Lagebesprechung';

      // When: Creating event
      const event = new ErinnerungGeloeschtEvent(erinnerungId, einsatzId, titel, geloeschtVon);

      // Then: Properties correct
      expect(event.erinnerungId).toBe(erinnerungId);
      expect(event.einsatzId).toBe(einsatzId);
      expect(event.titel).toBe(titel);
      expect(event.geloeschtVon).toBe(geloeschtVon);
      expect(event.eventId).toMatch(/^[a-z][a-z0-9]+$/);
    });

    it('should return correct event name', () => {
      expect(ErinnerungGeloeschtEvent.eventName()).toBe('erinnerung.geloescht');
    });

    it('should return default event version', () => {
      expect(ErinnerungGeloeschtEvent.eventVersion()).toBe(1);
    });

    it('should support optional aggregateId', () => {
      const aggregateId = 'aggregate-123';
      const event = new ErinnerungGeloeschtEvent(ErinnerungId.create().value!, EinsatzId.create().value!, 'Test', UserId.create().value!, aggregateId);

      expect(event.aggregateId).toBe(aggregateId);
    });
  });

  describe('ErinnerungAusgeloestEvent', () => {
    it('should create event with valid properties', () => {
      // Given: Valid event data
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const ausgeloestAm = new Date('2026-01-20T15:00:00.000Z');
      const titel = 'Lagebesprechung';
      const erstelltVon = UserId.create().value!;

      // When: Creating event
      const event = new ErinnerungAusgeloestEvent(erinnerungId, einsatzId, ausgeloestAm, titel, erstelltVon);

      // Then: Properties correct
      expect(event.erinnerungId).toBe(erinnerungId);
      expect(event.einsatzId).toBe(einsatzId);
      expect(event.ausgeloestAm).toBe(ausgeloestAm);
      expect(event.titel).toBe(titel);
      expect(event.erstelltVon).toBe(erstelltVon);
      expect(event.eventId.length).toBeGreaterThanOrEqual(20);
      expect(event.eventId.length).toBeLessThanOrEqual(30);
      expect(event.eventId).toMatch(/^[a-z][a-z0-9]+$/);
      expect(event.occurredAt).toBeInstanceOf(Date);
    });

    it('should return correct event name', () => {
      // Given/When: Event class
      // Then: Event name is lowercase dot-separated deutsch
      expect(ErinnerungAusgeloestEvent.eventName()).toBe('erinnerung.ausgeloest');
    });

    it('should return default event version', () => {
      // Given/When: Event class
      // Then: Event version is 1 (default from base class)
      expect(ErinnerungAusgeloestEvent.eventVersion()).toBe(1);
    });

    it('should auto-generate unique event IDs', () => {
      // Given: Two events created sequentially
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const ausgeloestAm = new Date();
      const erstelltVon = UserId.create().value!;
      const event1 = new ErinnerungAusgeloestEvent(erinnerungId, einsatzId, ausgeloestAm, 'Test', erstelltVon);
      const event2 = new ErinnerungAusgeloestEvent(erinnerungId, einsatzId, ausgeloestAm, 'Test', erstelltVon);

      // When: Comparing eventIds
      // Then: Different IDs (uniqueness)
      expect(event1.eventId).not.toBe(event2.eventId);
      expect(event1.eventId).toMatch(/^[a-z][a-z0-9]+$/);
      expect(event2.eventId).toMatch(/^[a-z][a-z0-9]+$/);
    });

    it('should generate recent occurredAt timestamp', () => {
      // Given/When: Creating event
      const before = new Date();
      const event = new ErinnerungAusgeloestEvent(ErinnerungId.create().value!, EinsatzId.create().value!, new Date(), 'Test', UserId.create().value!);
      const after = new Date();

      // Then: Timestamp is recent (within 1 second)
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should support optional aggregateId', () => {
      // Given: aggregateId provided
      const aggregateId = 'aggregate-123';
      const event = new ErinnerungAusgeloestEvent(ErinnerungId.create().value!, EinsatzId.create().value!, new Date(), 'Test', UserId.create().value!, aggregateId);

      // When/Then: aggregateId is stored
      expect(event.aggregateId).toBe(aggregateId);
    });

    it('should have undefined aggregateId when not provided', () => {
      // Given: No aggregateId
      const event = new ErinnerungAusgeloestEvent(ErinnerungId.create().value!, EinsatzId.create().value!, new Date(), 'Test', UserId.create().value!);

      // When/Then: aggregateId is undefined
      expect(event.aggregateId).toBeUndefined();
    });

    it('should have readonly properties (immutability)', () => {
      // Given: Event instance
      const event = new ErinnerungAusgeloestEvent(ErinnerungId.create().value!, EinsatzId.create().value!, new Date(), 'Test', UserId.create().value!);

      // When/Then: Properties are readonly (TypeScript compile-time check)
      expect(event.erinnerungId).toBeDefined();
      expect(event.einsatzId).toBeDefined();
      expect(event.ausgeloestAm).toBeDefined();
      expect(event.titel).toBeDefined();
      expect(event.erstelltVon).toBeDefined();
      expect(event.eventId).toBeDefined();
      expect(event.occurredAt).toBeDefined();
    });

    it('should work with typed value objects', () => {
      // Given: Typed value objects
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const erstelltVon = UserId.create().value!;

      // When: Creating event
      const event = new ErinnerungAusgeloestEvent(erinnerungId, einsatzId, new Date(), 'Test', erstelltVon);

      // Then: Types are preserved
      expect(event.erinnerungId).toBeInstanceOf(ErinnerungId);
      expect(event.einsatzId).toBeInstanceOf(EinsatzId);
      expect(event.erstelltVon).toBeInstanceOf(UserId);
    });

    it('should preserve ausgeloestAm timestamp exactly', () => {
      // Given: Specific trigger timestamp
      const ausgeloestAm = new Date('2026-01-20T15:00:00.000Z');
      const event = new ErinnerungAusgeloestEvent(ErinnerungId.create().value!, EinsatzId.create().value!, ausgeloestAm, 'Lagebesprechung', UserId.create().value!);

      // When/Then: Timestamp is preserved exactly (not auto-generated)
      expect(event.ausgeloestAm).toBe(ausgeloestAm);
      expect(event.ausgeloestAm.toISOString()).toBe('2026-01-20T15:00:00.000Z');
    });

    it('should contain all data for Event-Carried State Transfer', () => {
      // Given: Complete event data
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const ausgeloestAm = new Date();
      const titel = 'Wichtige Lagebesprechung';
      const erstelltVon = UserId.create().value!;

      // When: Creating event
      const event = new ErinnerungAusgeloestEvent(erinnerungId, einsatzId, ausgeloestAm, titel, erstelltVon);

      // Then: All data for handlers is present (no DB query needed)
      expect(event.erinnerungId).toBeDefined();
      expect(event.einsatzId).toBeDefined();
      expect(event.ausgeloestAm).toBeDefined();
      expect(event.titel).toBeDefined();
      expect(event.erstelltVon).toBeDefined();
      expect(event.occurredAt).toBeDefined(); // Base class timestamp
    });
  });
});
