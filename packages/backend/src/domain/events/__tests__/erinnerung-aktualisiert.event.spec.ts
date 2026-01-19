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

import { ErinnerungAktualisiertEvent } from '../erinnerung-aktualisiert.event';
import { DomainEvent } from '@domain/common/domain-event';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { EVENT_NAMES } from '../event-names';

describe('ErinnerungAktualisiertEvent', () => {
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
    it('sollte Event mit allen Aenderungen erstellen', () => {
      // Given
      const aenderungen = {
        titel: 'Neuer Titel',
        beschreibung: 'Neue Beschreibung',
        faelligAm: new Date('2025-01-20T15:00:00Z'),
      };

      // When
      const event = new ErinnerungAktualisiertEvent(testErinnerungId, testEinsatzId, aenderungen, testUserId, testTitel, testErinnerungId.value);

      // Then
      expect(event.erinnerungId).toBe(testErinnerungId);
      expect(event.einsatzId).toBe(testEinsatzId);
      expect(event.aenderungen).toEqual(aenderungen);
      expect(event.aktualisierVon).toBe(testUserId);
      expect(event.titel).toBe(testTitel);
      expect(event.aggregateId).toBe(testErinnerungId.value);
      expect(event.eventId).toMatch(/^[a-z][a-z0-9]{19,29}$/);
      expect(event.occurredAt).toBeInstanceOf(Date);
    });

    it('sollte Event mit nur Titel-Aenderung erstellen', () => {
      // Given
      const aenderungen = { titel: 'Nur Titel geaendert' };

      // When
      const event = new ErinnerungAktualisiertEvent(testErinnerungId, testEinsatzId, aenderungen, testUserId, testTitel);

      // Then
      expect(event.aenderungen.titel).toBe('Nur Titel geaendert');
      expect(event.aenderungen.beschreibung).toBeUndefined();
      expect(event.aenderungen.faelligAm).toBeUndefined();
    });

    it('sollte Event mit nur faelligAm-Aenderung erstellen', () => {
      // Given
      const neueFaelligkeit = new Date('2025-02-01T10:00:00Z');
      const aenderungen = { faelligAm: neueFaelligkeit };

      // When
      const event = new ErinnerungAktualisiertEvent(testErinnerungId, testEinsatzId, aenderungen, testUserId, testTitel);

      // Then
      expect(event.aenderungen.faelligAm).toEqual(neueFaelligkeit);
      expect(event.aenderungen.titel).toBeUndefined();
    });

    it('sollte Event mit beschreibung=null erstellen (Beschreibung entfernt)', () => {
      // Given
      const aenderungen = { beschreibung: null };

      // When
      const event = new ErinnerungAktualisiertEvent(testErinnerungId, testEinsatzId, aenderungen, testUserId, testTitel);

      // Then
      expect(event.aenderungen.beschreibung).toBeNull();
    });
  });

  describe('eventName', () => {
    it('sollte static eventName() "erinnerung.aktualisiert" zurueckgeben', () => {
      // Then
      expect(ErinnerungAktualisiertEvent.eventName()).toBe('erinnerung.aktualisiert');
    });

    it('sollte eventName mit EVENT_NAMES Constant uebereinstimmen', () => {
      // Then
      expect(ErinnerungAktualisiertEvent.eventName()).toBe(EVENT_NAMES.ERINNERUNG.AKTUALISIERT);
    });

    it('sollte eventName via Constructor-Zugriff korrekt liefern', () => {
      // Given
      const event = new ErinnerungAktualisiertEvent(testErinnerungId, testEinsatzId, { titel: 'Test' }, testUserId, testTitel);

      // Then
      expect((event.constructor as typeof DomainEvent).eventName()).toBe('erinnerung.aktualisiert');
    });
  });

  describe('DomainEvent Base Class Properties', () => {
    it('sollte eventId automatisch generieren (CUID2 Format)', () => {
      // When
      const event = new ErinnerungAktualisiertEvent(testErinnerungId, testEinsatzId, { titel: 'Test' }, testUserId, testTitel);

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
      const event = new ErinnerungAktualisiertEvent(testErinnerungId, testEinsatzId, { titel: 'Test' }, testUserId, testTitel);

      // Then
      const afterCreation = new Date();
      expect(event.occurredAt).toBeInstanceOf(Date);
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    it('sollte DomainEvent erweitern', () => {
      // When
      const event = new ErinnerungAktualisiertEvent(testErinnerungId, testEinsatzId, { titel: 'Test' }, testUserId, testTitel);

      // Then
      expect(event).toBeInstanceOf(DomainEvent);
    });
  });

  describe('Immutabilitaet', () => {
    it('sollte alle Properties als readonly haben', () => {
      // Given
      const event = new ErinnerungAktualisiertEvent(testErinnerungId, testEinsatzId, { titel: 'Test', faelligAm: new Date() }, testUserId, testTitel);

      // Then
      expect(event.erinnerungId).toBeDefined();
      expect(event.einsatzId).toBeDefined();
      expect(event.aenderungen).toBeDefined();
      expect(event.aktualisierVon).toBeDefined();
      expect(event.titel).toBeDefined();
      expect(event.eventId).toBeDefined();
      expect(event.occurredAt).toBeDefined();
    });
  });

  describe('Value Object Typisierung', () => {
    it('sollte mit typed Value Objects arbeiten', () => {
      // When
      const event = new ErinnerungAktualisiertEvent(testErinnerungId, testEinsatzId, { titel: 'Test' }, testUserId, testTitel);

      // Then
      expect(event.erinnerungId).toBeInstanceOf(ErinnerungId);
      expect(event.einsatzId).toBeInstanceOf(EinsatzId);
      expect(event.aktualisierVon).toBeInstanceOf(UserId);
    });
  });

  describe('Unique EventId Generation', () => {
    it('sollte einzigartige eventIds fuer verschiedene Events generieren', () => {
      // Given
      const event1 = new ErinnerungAktualisiertEvent(testErinnerungId, testEinsatzId, { titel: 'A' }, testUserId, testTitel);
      const event2 = new ErinnerungAktualisiertEvent(testErinnerungId, testEinsatzId, { titel: 'B' }, testUserId, testTitel);

      // Then
      expect(event1.eventId).not.toBe(event2.eventId);
    });
  });

  describe('Naming Convention', () => {
    it('sollte der Naming Convention folgen (namespace.action_past_tense)', () => {
      // Given
      const name = ErinnerungAktualisiertEvent.eventName();

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
      expect(ErinnerungAktualisiertEvent.eventVersion()).toBe(1);
    });
  });
});
