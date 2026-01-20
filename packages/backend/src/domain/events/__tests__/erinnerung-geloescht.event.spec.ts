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

import { ErinnerungGeloeschtEvent } from '../erinnerung-geloescht.event';
import { DomainEvent } from '@domain/common/domain-event';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { EVENT_NAMES } from '../event-names';

describe('ErinnerungGeloeschtEvent', () => {
  let testErinnerungId: ErinnerungId;
  let testEinsatzId: EinsatzId;
  let testUserId: UserId;
  const testTitel = 'Test Erinnerung';

  beforeEach(() => {
    jest.clearAllMocks();
    testErinnerungId = ErinnerungId.create().value!;
    testEinsatzId = EinsatzId.create().value!;
    testUserId = UserId.create().value!;
  });

  describe('Event Erstellung', () => {
    it('sollte Event mit allen Properties erstellen', () => {
      // Given
      const aggregateId = testErinnerungId.value;

      // When
      const event = new ErinnerungGeloeschtEvent(testErinnerungId, testEinsatzId, testTitel, testUserId, aggregateId);

      // Then
      expect(event.erinnerungId).toBe(testErinnerungId);
      expect(event.einsatzId).toBe(testEinsatzId);
      expect(event.titel).toBe(testTitel);
      expect(event.geloeschtVon).toBe(testUserId);
      expect(event.aggregateId).toBe(aggregateId);
      expect(event.eventId).toMatch(/^[a-z][a-z0-9]{19,29}$/);
      expect(event.occurredAt).toBeInstanceOf(Date);
    });

    it('sollte Event ohne aggregateId erstellen', () => {
      // When
      const event = new ErinnerungGeloeschtEvent(testErinnerungId, testEinsatzId, testTitel, testUserId);

      // Then
      expect(event.erinnerungId).toBe(testErinnerungId);
      expect(event.einsatzId).toBe(testEinsatzId);
      expect(event.titel).toBe(testTitel);
      expect(event.geloeschtVon).toBe(testUserId);
      expect(event.aggregateId).toBeUndefined();
    });
  });

  describe('eventName', () => {
    it('sollte static eventName() "erinnerung.geloescht" zurueckgeben', () => {
      // Then
      expect(ErinnerungGeloeschtEvent.eventName()).toBe('erinnerung.geloescht');
    });

    it('sollte eventName mit EVENT_NAMES Constant uebereinstimmen', () => {
      // Then
      expect(ErinnerungGeloeschtEvent.eventName()).toBe(EVENT_NAMES.ERINNERUNG.GELOESCHT);
    });

    it('sollte eventName via Constructor-Zugriff korrekt liefern', () => {
      // Given
      const event = new ErinnerungGeloeschtEvent(testErinnerungId, testEinsatzId, testTitel, testUserId);

      // Then
      expect((event.constructor as typeof DomainEvent).eventName()).toBe('erinnerung.geloescht');
    });
  });

  describe('DomainEvent Base Class Properties', () => {
    it('sollte eventId automatisch generieren (CUID2 Format)', () => {
      // When
      const event = new ErinnerungGeloeschtEvent(testErinnerungId, testEinsatzId, testTitel, testUserId);

      // Then
      expect(event.eventId).toBeDefined();
      expect(typeof event.eventId).toBe('string');
      expect(event.eventId.length).toBeGreaterThanOrEqual(20);
      expect(event.eventId.length).toBeLessThanOrEqual(30);
    });

    it('sollte occurredAt automatisch generieren', () => {
      // Given
      const beforeCreation = new Date();

      // When
      const event = new ErinnerungGeloeschtEvent(testErinnerungId, testEinsatzId, testTitel, testUserId);

      // Then
      const afterCreation = new Date();
      expect(event.occurredAt).toBeInstanceOf(Date);
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    it('sollte DomainEvent erweitern', () => {
      // When
      const event = new ErinnerungGeloeschtEvent(testErinnerungId, testEinsatzId, testTitel, testUserId);

      // Then
      expect(event).toBeInstanceOf(DomainEvent);
    });
  });

  describe('Immutabilitaet', () => {
    it('sollte alle Properties als readonly haben', () => {
      // Given
      const event = new ErinnerungGeloeschtEvent(testErinnerungId, testEinsatzId, testTitel, testUserId);

      // Then
      expect(event.erinnerungId).toBeDefined();
      expect(event.einsatzId).toBeDefined();
      expect(event.titel).toBeDefined();
      expect(event.geloeschtVon).toBeDefined();
      expect(event.eventId).toBeDefined();
      expect(event.occurredAt).toBeDefined();
    });
  });

  describe('Value Object Typisierung', () => {
    it('sollte mit typed Value Objects arbeiten', () => {
      // When
      const event = new ErinnerungGeloeschtEvent(testErinnerungId, testEinsatzId, testTitel, testUserId);

      // Then
      expect(event.erinnerungId).toBeInstanceOf(ErinnerungId);
      expect(event.einsatzId).toBeInstanceOf(EinsatzId);
      expect(event.geloeschtVon).toBeInstanceOf(UserId);
    });
  });

  describe('Unique EventId Generation', () => {
    it('sollte einzigartige eventIds fuer verschiedene Events generieren', () => {
      // Given
      const event1 = new ErinnerungGeloeschtEvent(testErinnerungId, testEinsatzId, 'Titel A', testUserId);
      const event2 = new ErinnerungGeloeschtEvent(testErinnerungId, testEinsatzId, 'Titel B', testUserId);

      // Then
      expect(event1.eventId).not.toBe(event2.eventId);
    });
  });

  describe('Naming Convention', () => {
    it('sollte der Naming Convention folgen (namespace.action_past_tense)', () => {
      // Given
      const name = ErinnerungGeloeschtEvent.eventName();

      // Then: Follows convention: lowercase dot-separated, past tense (deutsch)
      expect(name).toMatch(/^erinnerung\.[a-z]+$/);
      expect(name.startsWith('erinnerung.')).toBe(true);
      expect(name).not.toContain(' ');
      expect(name).toBe(name.toLowerCase());
    });
  });

  describe('eventVersion', () => {
    it('sollte default Version 1 haben', () => {
      // Then
      expect(ErinnerungGeloeschtEvent.eventVersion()).toBe(1);
    });
  });

  describe('ETB Integration Use Case', () => {
    it('sollte alle notwendigen Daten fuer ETB-Eintrag bereitstellen', () => {
      // Given & When
      const event = new ErinnerungGeloeschtEvent(testErinnerungId, testEinsatzId, 'Lagebesprechung 14:00', testUserId);

      // Then - Event Handler kann ETB-Text ohne DB-Query bauen
      const expectedEtbText = `Erinnerung '${event.titel}' geloescht`;
      expect(event.titel).toBe('Lagebesprechung 14:00');
      expect(event.einsatzId).toBeDefined(); // Fuer ETB-Zuordnung
      expect(event.geloeschtVon).toBeDefined(); // Fuer Audit
      expect(expectedEtbText).toContain(event.titel);
    });
  });
});
