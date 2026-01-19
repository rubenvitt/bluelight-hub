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

import { Erinnerung } from '@domain/entities/erinnerung.entity';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { ErinnerungStatus } from '@domain/value-objects/erinnerung-status';
import { ErinnerungTitel } from '@domain/value-objects/erinnerung-titel';
import { UserId } from '@domain/value-objects/user-id';
import { ErinnerungAktualisiertEvent } from '@domain/events/erinnerung-aktualisiert.event';

describe('Erinnerung Entity', () => {
  let testEinsatzId: EinsatzId;
  let testUserId: UserId;

  beforeEach(() => {
    jest.clearAllMocks();
    testEinsatzId = EinsatzId.create().value!;
    testUserId = UserId.create().value!;
  });

  // Helper: Create valid Erinnerung
  function createGeplantErinnerung(overrides?: { titel?: string; beschreibung?: string; faelligAm?: Date }): Erinnerung {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    const result = Erinnerung.create({
      einsatzId: testEinsatzId,
      titel: overrides?.titel ?? 'Test Erinnerung',
      beschreibung: overrides?.beschreibung,
      faelligAm: overrides?.faelligAm ?? futureDate,
      erstelltVon: testUserId,
    });
    expect(result.isSuccess).toBe(true);
    return result.value!;
  }

  // Helper: Create Erinnerung with specific status
  function createErinnerungWithStatus(status: ErinnerungStatus): Erinnerung {
    const id = ErinnerungId.create().value!;
    const titel = ErinnerungTitel.create('Test').value!;
    return Erinnerung.reconstruct({
      id,
      einsatzId: testEinsatzId,
      titel,
      beschreibung: null,
      faelligAm: new Date(Date.now() + 60 * 60 * 1000),
      status,
      erstelltVon: testUserId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  describe('update()', () => {
    describe('Status Validation (AC3)', () => {
      it('sollte Update erlauben wenn Status GEPLANT ist', () => {
        // Given
        const erinnerung = createGeplantErinnerung();

        // When
        const result = erinnerung.update({ titel: 'Neuer Titel' });

        // Then
        expect(result.isSuccess).toBe(true);
        expect(erinnerung.titel.value).toBe('Neuer Titel');
      });

      it('sollte Update verweigern wenn Status AUSGELOEST ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.AUSGELOEST());

        // When
        const result = erinnerung.update({ titel: 'Neuer Titel' });

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_EDITABLE');
      });

      it('sollte Update verweigern wenn Status ACKNOWLEDGED ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());

        // When
        const result = erinnerung.update({ titel: 'Neuer Titel' });

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_EDITABLE');
      });

      it('sollte Update verweigern wenn Status SNOOZED ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.SNOOZED());

        // When
        const result = erinnerung.update({ titel: 'Neuer Titel' });

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_EDITABLE');
      });

      it('sollte Update verweigern wenn Status ESKALIERT ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ESKALIERT());

        // When
        const result = erinnerung.update({ titel: 'Neuer Titel' });

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_EDITABLE');
      });

      it('sollte Update verweigern wenn Status ERLEDIGT ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ERLEDIGT());

        // When
        const result = erinnerung.update({ titel: 'Neuer Titel' });

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_EDITABLE');
      });
    });

    describe('Titel Update', () => {
      it('sollte Titel erfolgreich aktualisieren', () => {
        // Given
        const erinnerung = createGeplantErinnerung({ titel: 'Alter Titel' });

        // When
        const result = erinnerung.update({ titel: 'Neuer Titel' });

        // Then
        expect(result.isSuccess).toBe(true);
        expect(erinnerung.titel.value).toBe('Neuer Titel');
      });

      it('sollte leeren Titel ablehnen', () => {
        // Given
        const erinnerung = createGeplantErinnerung();

        // When
        const result = erinnerung.update({ titel: '' });

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('ERINNERUNG_TITEL');
      });

      it('sollte zu langen Titel ablehnen (>100 Zeichen)', () => {
        // Given
        const erinnerung = createGeplantErinnerung();
        const tooLongTitle = 'A'.repeat(101);

        // When
        const result = erinnerung.update({ titel: tooLongTitle });

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('ERINNERUNG_TITEL');
      });
    });

    describe('Beschreibung Update', () => {
      it('sollte Beschreibung hinzufuegen', () => {
        // Given
        const erinnerung = createGeplantErinnerung();
        expect(erinnerung.beschreibung).toBeNull();

        // When
        const result = erinnerung.update({ beschreibung: 'Neue Beschreibung' });

        // Then
        expect(result.isSuccess).toBe(true);
        expect(erinnerung.beschreibung).toBe('Neue Beschreibung');
      });

      it('sollte Beschreibung entfernen (null)', () => {
        // Given
        const erinnerung = createGeplantErinnerung({ beschreibung: 'Existierende Beschreibung' });

        // When
        const result = erinnerung.update({ beschreibung: null });

        // Then
        expect(result.isSuccess).toBe(true);
        expect(erinnerung.beschreibung).toBeNull();
      });

      it('sollte leere Beschreibung als null behandeln', () => {
        // Given
        const erinnerung = createGeplantErinnerung({ beschreibung: 'Existierend' });

        // When
        const result = erinnerung.update({ beschreibung: '   ' }); // Whitespace only

        // Then
        expect(result.isSuccess).toBe(true);
        expect(erinnerung.beschreibung).toBeNull();
      });

      it('sollte zu lange Beschreibung ablehnen (>500 Zeichen)', () => {
        // Given
        const erinnerung = createGeplantErinnerung();
        const tooLong = 'B'.repeat(501);

        // When
        const result = erinnerung.update({ beschreibung: tooLong });

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('ERINNERUNG_BESCHREIBUNG_TOO_LONG');
      });

      it('sollte Beschreibung trimmen', () => {
        // Given
        const erinnerung = createGeplantErinnerung();

        // When
        const result = erinnerung.update({ beschreibung: '  Getrimmt  ' });

        // Then
        expect(result.isSuccess).toBe(true);
        expect(erinnerung.beschreibung).toBe('Getrimmt');
      });
    });

    describe('faelligAm Update', () => {
      it('sollte faelligAm erfolgreich aktualisieren', () => {
        // Given
        const erinnerung = createGeplantErinnerung();
        const newDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

        // When
        const result = erinnerung.update({ faelligAm: newDate });

        // Then
        expect(result.isSuccess).toBe(true);
        expect(erinnerung.faelligAm.getTime()).toBe(newDate.getTime());
      });

      it('sollte faelligAm in Vergangenheit ablehnen', () => {
        // Given
        const erinnerung = createGeplantErinnerung();
        const pastDate = new Date(Date.now() - 1000); // 1 second ago

        // When
        const result = erinnerung.update({ faelligAm: pastDate });

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_FAELLIG_AM_IN_PAST');
      });
    });

    describe('Multiple Field Updates', () => {
      it('sollte mehrere Felder gleichzeitig aktualisieren', () => {
        // Given
        const erinnerung = createGeplantErinnerung({ titel: 'Alt' });
        const newDate = new Date(Date.now() + 3 * 60 * 60 * 1000);

        // When
        const result = erinnerung.update({
          titel: 'Neuer Titel',
          beschreibung: 'Neue Beschreibung',
          faelligAm: newDate,
        });

        // Then
        expect(result.isSuccess).toBe(true);
        expect(erinnerung.titel.value).toBe('Neuer Titel');
        expect(erinnerung.beschreibung).toBe('Neue Beschreibung');
        expect(erinnerung.faelligAm.getTime()).toBe(newDate.getTime());
      });

      it('sollte leere Props ablehnen (keine Aenderungen)', () => {
        // Given
        const erinnerung = createGeplantErinnerung();

        // When
        const result = erinnerung.update({});

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NO_CHANGES');
      });
    });

    describe('Domain Event Emission', () => {
      it('sollte ErinnerungAktualisiertEvent emittieren', () => {
        // Given
        const erinnerung = createGeplantErinnerung();
        erinnerung.clearDomainEvents(); // Clear creation event

        // When
        erinnerung.update({ titel: 'Neuer Titel' });

        // Then
        const events = erinnerung.getDomainEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toBeInstanceOf(ErinnerungAktualisiertEvent);
      });

      it('sollte korrekte Aenderungen im Event enthalten', () => {
        // Given
        const erinnerung = createGeplantErinnerung();
        erinnerung.clearDomainEvents();
        const newDate = new Date(Date.now() + 5 * 60 * 60 * 1000);

        // When
        erinnerung.update({
          titel: 'Geaenderter Titel',
          beschreibung: 'Neue Beschreibung',
          faelligAm: newDate,
        });

        // Then
        const event = erinnerung.getDomainEvents()[0] as ErinnerungAktualisiertEvent;
        expect(event.aenderungen.titel).toBe('Geaenderter Titel');
        expect(event.aenderungen.beschreibung).toBe('Neue Beschreibung');
        expect(event.aenderungen.faelligAm).toEqual(newDate);
      });

      it('sollte nur geaenderte Felder im Event enthalten', () => {
        // Given
        const erinnerung = createGeplantErinnerung({ titel: 'Original' });
        erinnerung.clearDomainEvents();

        // When: Nur Titel ändern
        erinnerung.update({ titel: 'Nur Titel geaendert' });

        // Then: Nur titel im Event
        const event = erinnerung.getDomainEvents()[0] as ErinnerungAktualisiertEvent;
        expect(event.aenderungen.titel).toBe('Nur Titel geaendert');
        expect(event.aenderungen.beschreibung).toBeUndefined();
        expect(event.aenderungen.faelligAm).toBeUndefined();
      });

      it('sollte kein Event emittieren bei Validierungsfehler', () => {
        // Given
        const erinnerung = createGeplantErinnerung();
        erinnerung.clearDomainEvents();

        // When: Ungültige Änderung
        erinnerung.update({ titel: '' }); // Leerer Titel

        // Then: Kein Event
        const events = erinnerung.getDomainEvents();
        expect(events).toHaveLength(0);
      });
    });
  });
});
