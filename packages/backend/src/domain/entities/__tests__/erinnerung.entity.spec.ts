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
import { ErinnerungGeloeschtEvent } from '@domain/events/erinnerung-geloescht.event';
import { ErinnerungAcknowledgedEvent } from '@domain/events/erinnerung-acknowledged.event';
import { ErinnerungAusgeloestEvent } from '@domain/events/erinnerung-ausgeloest.event';
import { ErinnerungRetriggeredEvent } from '@domain/events/erinnerung-retriggered.event';
import { ErinnerungErledigtEvent } from '@domain/events/erinnerung-erledigt.event';

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
  function createErinnerungWithStatus(status: ErinnerungStatus, overrides?: { requiresNote?: boolean }): Erinnerung {
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
      requiresNote: overrides?.requiresNote ?? false,
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

  // ============================================================
  // delete() Tests (Story 1.4)
  // ============================================================

  describe('delete()', () => {
    describe('Status Validation (AC1)', () => {
      it('sollte Delete erlauben wenn Status GEPLANT ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.GEPLANT());

        // When
        const result = erinnerung.delete(testUserId);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(erinnerung.isDeleted).toBe(true);
      });

      it('sollte Delete erlauben wenn Status AUSGELOEST ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.AUSGELOEST());

        // When
        const result = erinnerung.delete(testUserId);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(erinnerung.isDeleted).toBe(true);
      });

      it('sollte Delete verweigern wenn Status ACKNOWLEDGED ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());

        // When
        const result = erinnerung.delete(testUserId);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_DELETABLE');
        expect(erinnerung.isDeleted).toBe(false);
      });

      it('sollte Delete verweigern wenn Status SNOOZED ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.SNOOZED());

        // When
        const result = erinnerung.delete(testUserId);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_DELETABLE');
      });

      it('sollte Delete verweigern wenn Status ESKALIERT ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ESKALIERT());

        // When
        const result = erinnerung.delete(testUserId);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_DELETABLE');
      });

      it('sollte Delete verweigern wenn Status ERLEDIGT ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ERLEDIGT());

        // When
        const result = erinnerung.delete(testUserId);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_DELETABLE');
      });
    });

    describe('Soft-Delete Properties', () => {
      it('sollte isDeleted auf true setzen', () => {
        // Given
        const erinnerung = createGeplantErinnerung();
        expect(erinnerung.isDeleted).toBe(false);

        // When
        erinnerung.delete(testUserId);

        // Then
        expect(erinnerung.isDeleted).toBe(true);
      });

      it('sollte deletedAt setzen', () => {
        // Given
        const erinnerung = createGeplantErinnerung();
        const beforeDelete = new Date();

        // When
        erinnerung.delete(testUserId);

        // Then
        const afterDelete = new Date();
        expect(erinnerung.deletedAt).not.toBeNull();
        expect(erinnerung.deletedAt!.getTime()).toBeGreaterThanOrEqual(beforeDelete.getTime());
        expect(erinnerung.deletedAt!.getTime()).toBeLessThanOrEqual(afterDelete.getTime());
      });

      it('sollte deletedBy setzen', () => {
        // Given
        const erinnerung = createGeplantErinnerung();
        const deletingUser = UserId.create().value!;

        // When
        erinnerung.delete(deletingUser);

        // Then
        expect(erinnerung.deletedBy).toBe(deletingUser);
      });

      it('sollte deletedAt als Kopie zurueckgeben (Immutabilitaet)', () => {
        // Given
        const erinnerung = createGeplantErinnerung();
        erinnerung.delete(testUserId);

        // When
        const deletedAt1 = erinnerung.deletedAt;
        const deletedAt2 = erinnerung.deletedAt;

        // Then: Verschiedene Objekte, gleicher Wert
        expect(deletedAt1).not.toBe(deletedAt2);
        expect(deletedAt1!.getTime()).toBe(deletedAt2!.getTime());
      });
    });

    describe('Idempotenz', () => {
      it('sollte Fehler bei doppeltem Delete zurueckgeben', () => {
        // Given
        const erinnerung = createGeplantErinnerung();
        erinnerung.delete(testUserId);

        // When
        const secondDelete = erinnerung.delete(testUserId);

        // Then
        expect(secondDelete.isFailure).toBe(true);
        expect(secondDelete.error).toBe('ERINNERUNG_ALREADY_DELETED');
      });
    });

    describe('Domain Event Emission', () => {
      it('sollte ErinnerungGeloeschtEvent emittieren', () => {
        // Given
        const erinnerung = createGeplantErinnerung();
        erinnerung.clearDomainEvents();

        // When
        erinnerung.delete(testUserId);

        // Then
        const events = erinnerung.getDomainEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toBeInstanceOf(ErinnerungGeloeschtEvent);
      });

      it('sollte Event mit korrekten Properties emittieren', () => {
        // Given
        const erinnerung = createGeplantErinnerung({ titel: 'Lagebesprechung' });
        erinnerung.clearDomainEvents();
        const deletingUser = UserId.create().value!;

        // When
        erinnerung.delete(deletingUser);

        // Then
        const event = erinnerung.getDomainEvents()[0] as ErinnerungGeloeschtEvent;
        expect(event.erinnerungId).toBe(erinnerung.id);
        expect(event.einsatzId).toBe(erinnerung.einsatzId);
        expect(event.titel).toBe('Lagebesprechung');
        expect(event.geloeschtVon).toBe(deletingUser);
      });

      it('sollte kein Event emittieren bei Validierungsfehler', () => {
        // Given: ERLEDIGT Status - nicht loeschbar
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ERLEDIGT());
        erinnerung.clearDomainEvents();

        // When
        erinnerung.delete(testUserId);

        // Then
        const events = erinnerung.getDomainEvents();
        expect(events).toHaveLength(0);
      });

      it('sollte kein Event emittieren bei bereits geloeschter Erinnerung', () => {
        // Given
        const erinnerung = createGeplantErinnerung();
        erinnerung.delete(testUserId);
        erinnerung.clearDomainEvents();

        // When: Zweites Delete
        erinnerung.delete(testUserId);

        // Then
        const events = erinnerung.getDomainEvents();
        expect(events).toHaveLength(0);
      });
    });

    describe('reconstruct() mit Soft-Delete', () => {
      it('sollte geloeschte Erinnerung korrekt rekonstruieren', () => {
        // Given
        const id = ErinnerungId.create().value!;
        const titel = ErinnerungTitel.create('Test').value!;
        const deletedAt = new Date();
        const deletedBy = UserId.create().value!;

        // When
        const erinnerung = Erinnerung.reconstruct({
          id,
          einsatzId: testEinsatzId,
          titel,
          beschreibung: null,
          faelligAm: new Date(Date.now() + 60 * 60 * 1000),
          status: ErinnerungStatus.GEPLANT(),
          erstelltVon: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
          isDeleted: true,
          deletedAt,
          deletedBy,
        });

        // Then
        expect(erinnerung.isDeleted).toBe(true);
        expect(erinnerung.deletedAt).toEqual(deletedAt);
        expect(erinnerung.deletedBy).toBe(deletedBy);
      });

      it('sollte nicht-geloeschte Erinnerung korrekt rekonstruieren (Defaults)', () => {
        // Given
        const id = ErinnerungId.create().value!;
        const titel = ErinnerungTitel.create('Test').value!;

        // When: Ohne Soft-Delete Felder
        const erinnerung = Erinnerung.reconstruct({
          id,
          einsatzId: testEinsatzId,
          titel,
          beschreibung: null,
          faelligAm: new Date(Date.now() + 60 * 60 * 1000),
          status: ErinnerungStatus.GEPLANT(),
          erstelltVon: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Then: Defaults
        expect(erinnerung.isDeleted).toBe(false);
        expect(erinnerung.deletedAt).toBeNull();
        expect(erinnerung.deletedBy).toBeNull();
      });
    });
  });

  // ============================================================
  // acknowledge() Tests (Story 1.6)
  // ============================================================

  describe('acknowledge()', () => {
    describe('Status Validation (AC1)', () => {
      it('sollte Acknowledge erlauben wenn Status AUSGELOEST ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.AUSGELOEST());

        // When
        const result = erinnerung.acknowledge(testUserId);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(erinnerung.status.isAcknowledged()).toBe(true);
      });

      it('sollte Acknowledge verweigern wenn Status GEPLANT ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.GEPLANT());

        // When
        const result = erinnerung.acknowledge(testUserId);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_ACKNOWLEDGEABLE');
      });

      it('sollte Acknowledge verweigern wenn Status ACKNOWLEDGED ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());

        // When
        const result = erinnerung.acknowledge(testUserId);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_ACKNOWLEDGEABLE');
      });

      it('sollte Acknowledge verweigern wenn Status SNOOZED ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.SNOOZED());

        // When
        const result = erinnerung.acknowledge(testUserId);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_ACKNOWLEDGEABLE');
      });

      it('sollte Acknowledge verweigern wenn Status ESKALIERT ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ESKALIERT());

        // When
        const result = erinnerung.acknowledge(testUserId);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_ACKNOWLEDGEABLE');
      });

      it('sollte Acknowledge verweigern wenn Status ERLEDIGT ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ERLEDIGT());

        // When
        const result = erinnerung.acknowledge(testUserId);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_ACKNOWLEDGEABLE');
      });
    });

    describe('Acknowledge Properties', () => {
      it('sollte Status auf ACKNOWLEDGED setzen', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.AUSGELOEST());

        // When
        erinnerung.acknowledge(testUserId);

        // Then
        expect(erinnerung.status.value).toBe('ACKNOWLEDGED');
      });

      it('sollte acknowledgedAm setzen', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.AUSGELOEST());
        const beforeAcknowledge = new Date();

        // When
        erinnerung.acknowledge(testUserId);

        // Then
        const afterAcknowledge = new Date();
        expect(erinnerung.acknowledgedAm).not.toBeNull();
        expect(erinnerung.acknowledgedAm!.getTime()).toBeGreaterThanOrEqual(beforeAcknowledge.getTime());
        expect(erinnerung.acknowledgedAm!.getTime()).toBeLessThanOrEqual(afterAcknowledge.getTime());
      });

      it('sollte acknowledgedBy setzen', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.AUSGELOEST());
        const acknowledgingUser = UserId.create().value!;

        // When
        erinnerung.acknowledge(acknowledgingUser);

        // Then
        expect(erinnerung.acknowledgedBy).toBe(acknowledgingUser);
      });

      it('sollte acknowledgedAm als Kopie zurueckgeben (Immutabilitaet)', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.AUSGELOEST());
        erinnerung.acknowledge(testUserId);

        // When
        const acknowledgedAm1 = erinnerung.acknowledgedAm;
        const acknowledgedAm2 = erinnerung.acknowledgedAm;

        // Then: Verschiedene Objekte, gleicher Wert
        expect(acknowledgedAm1).not.toBe(acknowledgedAm2);
        expect(acknowledgedAm1!.getTime()).toBe(acknowledgedAm2!.getTime());
      });
    });

    describe('Domain Event Emission', () => {
      it('sollte ErinnerungAcknowledgedEvent emittieren', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.AUSGELOEST());
        erinnerung.clearDomainEvents();

        // When
        erinnerung.acknowledge(testUserId);

        // Then
        const events = erinnerung.getDomainEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toBeInstanceOf(ErinnerungAcknowledgedEvent);
      });

      it('sollte Event mit korrekten Properties emittieren', () => {
        // Given
        const id = ErinnerungId.create().value!;
        const titel = ErinnerungTitel.create('Lagebesprechung').value!;
        const erinnerung = Erinnerung.reconstruct({
          id,
          einsatzId: testEinsatzId,
          titel,
          beschreibung: null,
          faelligAm: new Date(Date.now() + 60 * 60 * 1000),
          status: ErinnerungStatus.AUSGELOEST(),
          erstelltVon: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        erinnerung.clearDomainEvents();
        const acknowledgingUser = UserId.create().value!;

        // When
        erinnerung.acknowledge(acknowledgingUser);

        // Then
        const event = erinnerung.getDomainEvents()[0] as ErinnerungAcknowledgedEvent;
        expect(event.erinnerungId).toBe(erinnerung.id);
        expect(event.einsatzId).toBe(erinnerung.einsatzId);
        expect(event.acknowledgedBy).toBe(acknowledgingUser);
        expect(event.titel).toBe('Lagebesprechung');
        expect(event.acknowledgedAm).toBeDefined();
      });

      it('sollte kein Event emittieren bei Validierungsfehler', () => {
        // Given: GEPLANT Status - nicht acknowledgeable
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.GEPLANT());
        erinnerung.clearDomainEvents();

        // When
        erinnerung.acknowledge(testUserId);

        // Then
        const events = erinnerung.getDomainEvents();
        expect(events).toHaveLength(0);
      });
    });

    describe('reconstruct() mit Acknowledge', () => {
      it('sollte acknowledged Erinnerung korrekt rekonstruieren', () => {
        // Given
        const id = ErinnerungId.create().value!;
        const titel = ErinnerungTitel.create('Test').value!;
        const acknowledgedAm = new Date();
        const acknowledgedBy = UserId.create().value!;

        // When
        const erinnerung = Erinnerung.reconstruct({
          id,
          einsatzId: testEinsatzId,
          titel,
          beschreibung: null,
          faelligAm: new Date(Date.now() + 60 * 60 * 1000),
          status: ErinnerungStatus.ACKNOWLEDGED(),
          erstelltVon: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
          acknowledgedAm,
          acknowledgedBy,
        });

        // Then
        expect(erinnerung.status.isAcknowledged()).toBe(true);
        expect(erinnerung.acknowledgedAm).toEqual(acknowledgedAm);
        expect(erinnerung.acknowledgedBy).toBe(acknowledgedBy);
      });

      it('sollte nicht-acknowledged Erinnerung korrekt rekonstruieren (Defaults)', () => {
        // Given
        const id = ErinnerungId.create().value!;
        const titel = ErinnerungTitel.create('Test').value!;

        // When: Ohne Acknowledge Felder
        const erinnerung = Erinnerung.reconstruct({
          id,
          einsatzId: testEinsatzId,
          titel,
          beschreibung: null,
          faelligAm: new Date(Date.now() + 60 * 60 * 1000),
          status: ErinnerungStatus.GEPLANT(),
          erstelltVon: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Then: Defaults
        expect(erinnerung.acknowledgedAm).toBeNull();
        expect(erinnerung.acknowledgedBy).toBeNull();
      });
    });
  });

  // ============================================================
  // ausloesen() Tests (Story 1.5 + Story 2.2)
  // ============================================================

  describe('ausloesen()', () => {
    // Helper: Create SNOOZED Erinnerung with snoozeCount
    function createSnoozedErinnerung(snoozeCount: number): Erinnerung {
      const id = ErinnerungId.create().value!;
      const titel = ErinnerungTitel.create('Test Erinnerung').value!;
      return Erinnerung.reconstruct({
        id,
        einsatzId: testEinsatzId,
        titel,
        beschreibung: null,
        faelligAm: new Date(Date.now() + 60 * 60 * 1000),
        status: ErinnerungStatus.SNOOZED(),
        erstelltVon: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        snoozedAt: new Date(),
        snoozedBy: testUserId,
        snoozedUntil: new Date(Date.now() + 5 * 60 * 1000),
        snoozeCount,
      });
    }

    describe('Status Validation (Story 1.5 AC1 + Story 2.2 AC1)', () => {
      it('sollte Trigger erlauben wenn Status GEPLANT ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.GEPLANT());

        // When
        const result = erinnerung.ausloesen();

        // Then
        expect(result.isSuccess).toBe(true);
        expect(erinnerung.status.isAusgeloest()).toBe(true);
      });

      it('sollte Trigger erlauben wenn Status SNOOZED ist (Story 2.2 AC1)', () => {
        // Given
        const erinnerung = createSnoozedErinnerung(1);

        // When
        const result = erinnerung.ausloesen();

        // Then
        expect(result.isSuccess).toBe(true);
        expect(erinnerung.status.isAusgeloest()).toBe(true);
      });

      it('sollte Trigger verweigern wenn Status AUSGELOEST ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.AUSGELOEST());

        // When
        const result = erinnerung.ausloesen();

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_TRIGGERABLE');
      });

      it('sollte Trigger verweigern wenn Status ACKNOWLEDGED ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());

        // When
        const result = erinnerung.ausloesen();

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_TRIGGERABLE');
      });

      it('sollte Trigger verweigern wenn Status ESKALIERT ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ESKALIERT());

        // When
        const result = erinnerung.ausloesen();

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_TRIGGERABLE');
      });

      it('sollte Trigger verweigern wenn Status ERLEDIGT ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ERLEDIGT());

        // When
        const result = erinnerung.ausloesen();

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_TRIGGERABLE');
      });
    });

    describe('ausgeloestAm Property', () => {
      it('sollte ausgeloestAm setzen', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.GEPLANT());
        const beforeTrigger = new Date();

        // When
        erinnerung.ausloesen();

        // Then
        const afterTrigger = new Date();
        expect(erinnerung.ausgeloestAm).not.toBeNull();
        expect(erinnerung.ausgeloestAm!.getTime()).toBeGreaterThanOrEqual(beforeTrigger.getTime());
        expect(erinnerung.ausgeloestAm!.getTime()).toBeLessThanOrEqual(afterTrigger.getTime());
      });
    });

    describe('Domain Event Emission (Story 1.5 + Story 2.2)', () => {
      it('sollte ErinnerungAusgeloestEvent emittieren bei erstem Trigger (GEPLANT)', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.GEPLANT());
        erinnerung.clearDomainEvents();

        // When
        erinnerung.ausloesen();

        // Then
        const events = erinnerung.getDomainEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toBeInstanceOf(ErinnerungAusgeloestEvent);
      });

      it('sollte ErinnerungRetriggeredEvent emittieren bei Re-Trigger (SNOOZED) (Story 2.2)', () => {
        // Given
        const erinnerung = createSnoozedErinnerung(1);
        erinnerung.clearDomainEvents();

        // When
        erinnerung.ausloesen();

        // Then
        const events = erinnerung.getDomainEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toBeInstanceOf(ErinnerungRetriggeredEvent);
      });

      it('sollte ErinnerungRetriggeredEvent mit korrekten Properties emittieren (Story 2.2 AC2)', () => {
        // Given
        const snoozeCount = 2;
        const erinnerung = createSnoozedErinnerung(snoozeCount);
        const previousSnoozedAt = erinnerung.snoozedAt;
        erinnerung.clearDomainEvents();

        // When
        erinnerung.ausloesen();

        // Then
        const event = erinnerung.getDomainEvents()[0] as ErinnerungRetriggeredEvent;
        expect(event.erinnerungId).toBe(erinnerung.id);
        expect(event.einsatzId).toBe(erinnerung.einsatzId);
        expect(event.titel).toBe('Test Erinnerung');
        expect(event.snoozeCount).toBe(snoozeCount);
        expect(event.previousSnoozedAt).toEqual(previousSnoozedAt);
        expect(event.retriggeredAm).toBeDefined();
      });

      it('sollte ErinnerungAusgeloestEvent mit korrekten Properties emittieren (Story 1.5)', () => {
        // Given
        const id = ErinnerungId.create().value!;
        const titel = ErinnerungTitel.create('Lagebesprechung').value!;
        const erinnerung = Erinnerung.reconstruct({
          id,
          einsatzId: testEinsatzId,
          titel,
          beschreibung: null,
          faelligAm: new Date(Date.now() + 60 * 60 * 1000),
          status: ErinnerungStatus.GEPLANT(),
          erstelltVon: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        erinnerung.clearDomainEvents();

        // When
        erinnerung.ausloesen();

        // Then
        const event = erinnerung.getDomainEvents()[0] as ErinnerungAusgeloestEvent;
        expect(event.erinnerungId).toBe(erinnerung.id);
        expect(event.einsatzId).toBe(erinnerung.einsatzId);
        expect(event.titel).toBe('Lagebesprechung');
        expect(event.ausgeloestAm).toBeDefined();
      });

      it('sollte kein Event emittieren bei Validierungsfehler', () => {
        // Given: ACKNOWLEDGED Status - nicht triggerbar
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());
        erinnerung.clearDomainEvents();

        // When
        erinnerung.ausloesen();

        // Then
        const events = erinnerung.getDomainEvents();
        expect(events).toHaveLength(0);
      });
    });
  });

  // ============================================================
  // markErledigt() Tests (Story 2.5)
  // ============================================================

  describe('markErledigt()', () => {
    describe('Status Validation (AC1)', () => {
      it('sollte MarkErledigt erlauben wenn Status ACKNOWLEDGED ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());

        // When
        const result = erinnerung.markErledigt(testUserId);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(erinnerung.status.isErledigt()).toBe(true);
      });

      it('sollte MarkErledigt erlauben wenn Status ESKALIERT ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ESKALIERT());

        // When
        const result = erinnerung.markErledigt(testUserId);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(erinnerung.status.isErledigt()).toBe(true);
      });

      it('sollte MarkErledigt verweigern wenn Status GEPLANT ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.GEPLANT());

        // When
        const result = erinnerung.markErledigt(testUserId);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_COMPLETEABLE');
      });

      it('sollte MarkErledigt verweigern wenn Status AUSGELOEST ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.AUSGELOEST());

        // When
        const result = erinnerung.markErledigt(testUserId);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_COMPLETEABLE');
      });

      it('sollte MarkErledigt verweigern wenn Status SNOOZED ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.SNOOZED());

        // When
        const result = erinnerung.markErledigt(testUserId);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_COMPLETEABLE');
      });

      it('sollte MarkErledigt verweigern wenn Status bereits ERLEDIGT ist', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ERLEDIGT());

        // When
        const result = erinnerung.markErledigt(testUserId);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOT_COMPLETEABLE');
      });
    });

    describe('Erledigt Properties', () => {
      it('sollte Status auf ERLEDIGT setzen', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());

        // When
        erinnerung.markErledigt(testUserId);

        // Then
        expect(erinnerung.status.value).toBe('ERLEDIGT');
      });

      it('sollte erledigtAm setzen', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());
        const beforeErledigt = new Date();

        // When
        erinnerung.markErledigt(testUserId);

        // Then
        const afterErledigt = new Date();
        expect(erinnerung.erledigtAm).not.toBeNull();
        expect(erinnerung.erledigtAm!.getTime()).toBeGreaterThanOrEqual(beforeErledigt.getTime());
        expect(erinnerung.erledigtAm!.getTime()).toBeLessThanOrEqual(afterErledigt.getTime());
      });

      it('sollte erledigtBy setzen', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());
        const completingUser = UserId.create().value!;

        // When
        erinnerung.markErledigt(completingUser);

        // Then
        expect(erinnerung.erledigtBy).toBe(completingUser);
      });

      it('sollte erledigungsNotiz setzen wenn angegeben', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());
        const notiz = 'Aufgabe erfolgreich abgeschlossen';

        // When
        erinnerung.markErledigt(testUserId, notiz);

        // Then
        expect(erinnerung.erledigungsNotiz).toBe(notiz);
      });

      it('sollte erledigungsNotiz trimmen', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());
        const notiz = '  Getrimmte Notiz  ';

        // When
        erinnerung.markErledigt(testUserId, notiz);

        // Then
        expect(erinnerung.erledigungsNotiz).toBe('Getrimmte Notiz');
      });

      it('sollte leere erledigungsNotiz als null behandeln', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());

        // When
        erinnerung.markErledigt(testUserId, '   '); // Whitespace only

        // Then
        expect(erinnerung.erledigungsNotiz).toBeNull();
      });

      it('sollte erledigungsNotiz null lassen wenn nicht angegeben', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());

        // When
        erinnerung.markErledigt(testUserId);

        // Then
        expect(erinnerung.erledigungsNotiz).toBeNull();
      });
    });

    describe('Notiz Validation (AC2)', () => {
      it('sollte zu lange erledigungsNotiz ablehnen (>500 Zeichen)', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());
        const tooLongNotiz = 'N'.repeat(501);

        // When
        const result = erinnerung.markErledigt(testUserId, tooLongNotiz);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('ERINNERUNG_NOTIZ_TOO_LONG');
        // Status sollte unveraendert sein
        expect(erinnerung.status.isAcknowledged()).toBe(true);
      });

      it('sollte erledigungsNotiz mit exakt 500 Zeichen akzeptieren', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());
        const maxNotiz = 'M'.repeat(500);

        // When
        const result = erinnerung.markErledigt(testUserId, maxNotiz);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(erinnerung.erledigungsNotiz).toBe(maxNotiz);
      });
    });

    describe('Pflicht-Notiz Validation (Story 2.6)', () => {
      describe('AC1: Pflicht-Notiz bei requiresNote=true', () => {
        it('sollte markErledigt verweigern wenn requiresNote=true und keine Notiz angegeben', () => {
          // Given: Erinnerung mit Pflicht-Notiz
          const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED(), { requiresNote: true });

          // When: Erledigung ohne Notiz
          const result = erinnerung.markErledigt(testUserId);

          // Then: Fehler wegen fehlender Pflicht-Notiz
          expect(result.isFailure).toBe(true);
          expect(result.error).toBe('ERINNERUNG_ERLEDIGUNGS_NOTIZ_REQUIRED');
          // Status sollte unveraendert sein
          expect(erinnerung.status.isAcknowledged()).toBe(true);
        });

        it('sollte markErledigt verweigern wenn requiresNote=true und nur Whitespace-Notiz angegeben', () => {
          // Given: Erinnerung mit Pflicht-Notiz
          const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED(), { requiresNote: true });

          // When: Erledigung mit leerer Notiz (nur Whitespace)
          const result = erinnerung.markErledigt(testUserId, '   ');

          // Then: Fehler wegen fehlender Pflicht-Notiz
          expect(result.isFailure).toBe(true);
          expect(result.error).toBe('ERINNERUNG_ERLEDIGUNGS_NOTIZ_REQUIRED');
          expect(erinnerung.status.isAcknowledged()).toBe(true);
        });

        it('sollte markErledigt erlauben wenn requiresNote=true und gueltige Notiz angegeben', () => {
          // Given: Erinnerung mit Pflicht-Notiz
          const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED(), { requiresNote: true });
          const notiz = 'Aufgabe erfolgreich dokumentiert';

          // When: Erledigung mit gueltiger Notiz
          const result = erinnerung.markErledigt(testUserId, notiz);

          // Then: Erfolg
          expect(result.isSuccess).toBe(true);
          expect(erinnerung.status.isErledigt()).toBe(true);
          expect(erinnerung.erledigungsNotiz).toBe(notiz);
        });

        it('sollte requiresNote=false bei Erledigung ohne Notiz akzeptieren', () => {
          // Given: Erinnerung ohne Pflicht-Notiz
          const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED(), { requiresNote: false });

          // When: Erledigung ohne Notiz
          const result = erinnerung.markErledigt(testUserId);

          // Then: Erfolg (Notiz ist optional)
          expect(result.isSuccess).toBe(true);
          expect(erinnerung.status.isErledigt()).toBe(true);
          expect(erinnerung.erledigungsNotiz).toBeNull();
        });

        it('sollte bei ESKALIERT Status mit requiresNote=true auch Notiz fordern', () => {
          // Given: Eskalierte Erinnerung mit Pflicht-Notiz
          const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ESKALIERT(), { requiresNote: true });

          // When: Erledigung ohne Notiz
          const result = erinnerung.markErledigt(testUserId);

          // Then: Fehler wegen fehlender Pflicht-Notiz
          expect(result.isFailure).toBe(true);
          expect(result.error).toBe('ERINNERUNG_ERLEDIGUNGS_NOTIZ_REQUIRED');
        });

        it('sollte ESKALIERT mit requiresNote=true UND gueltiger Notiz erfolgreich erledigen', () => {
          // Given (Arrange)
          const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ESKALIERT(), { requiresNote: true });
          const notiz = 'Eskalation dokumentiert und behoben';

          // When (Act)
          const result = erinnerung.markErledigt(testUserId, notiz);

          // Then (Assert)
          expect(result.isSuccess).toBe(true);
          expect(erinnerung.status.isErledigt()).toBe(true);
          expect(erinnerung.erledigungsNotiz).toBe(notiz);
        });
      });

      describe('AC6: State-Konsistenz bei Validation Errors', () => {
        it('sollte keine Properties aendern wenn Pflicht-Notiz bei ESKALIERT fehlt', () => {
          // Given (Arrange)
          const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ESKALIERT(), { requiresNote: true });
          const originalStatus = erinnerung.status.value;

          // When (Act)
          const result = erinnerung.markErledigt(testUserId);

          // Then (Assert)
          expect(result.isFailure).toBe(true);
          expect(erinnerung.status.value).toBe(originalStatus);
          expect(erinnerung.erledigtAm).toBeNull();
          expect(erinnerung.erledigtBy).toBeNull();
          expect(erinnerung.erledigungsNotiz).toBeNull();
        });

        it('sollte bei whitespace-only Notiz und requiresNote=true keine Properties aendern', () => {
          // Given (Arrange)
          const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED(), { requiresNote: true });

          // When (Act)
          const result = erinnerung.markErledigt(testUserId, '   ');

          // Then (Assert)
          expect(result.isFailure).toBe(true);
          expect(result.error).toBe('ERINNERUNG_ERLEDIGUNGS_NOTIZ_REQUIRED');
          expect(erinnerung.status.isAcknowledged()).toBe(true);
          expect(erinnerung.erledigtAm).toBeNull();
        });
      });

      describe('AC5: Kein Event bei fehlender Pflicht-Notiz', () => {
        it('sollte kein ErinnerungErledigtEvent emittieren wenn Pflicht-Notiz fehlt', () => {
          // Given: Erinnerung mit Pflicht-Notiz
          const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED(), { requiresNote: true });
          erinnerung.clearDomainEvents();

          // When: Erledigung ohne Notiz
          erinnerung.markErledigt(testUserId);

          // Then: Kein Event emittiert
          const events = erinnerung.getDomainEvents();
          expect(events).toHaveLength(0);
        });
      });

      describe('requiresNote Getter', () => {
        it('sollte requiresNote=true korrekt zurueckgeben', () => {
          // Given (Arrange)
          const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED(), { requiresNote: true });

          // Then (Assert) - kein "When" da Getter direkt getestet wird
          expect(erinnerung.requiresNote).toBe(true);
        });

        it('sollte requiresNote=false korrekt zurueckgeben (Default)', () => {
          // Given (Arrange)
          const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());

          // Then (Assert) - kein "When" da Getter direkt getestet wird
          expect(erinnerung.requiresNote).toBe(false);
        });
      });
    });

    describe('Domain Event Emission (AC4)', () => {
      it('sollte ErinnerungErledigtEvent emittieren', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());
        erinnerung.clearDomainEvents();

        // When
        erinnerung.markErledigt(testUserId);

        // Then
        const events = erinnerung.getDomainEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toBeInstanceOf(ErinnerungErledigtEvent);
      });

      it('sollte Event mit korrekten Properties emittieren', () => {
        // Given
        const id = ErinnerungId.create().value!;
        const titel = ErinnerungTitel.create('Lagebesprechung').value!;
        const erinnerung = Erinnerung.reconstruct({
          id,
          einsatzId: testEinsatzId,
          titel,
          beschreibung: null,
          faelligAm: new Date(Date.now() + 60 * 60 * 1000),
          status: ErinnerungStatus.ACKNOWLEDGED(),
          erstelltVon: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        erinnerung.clearDomainEvents();
        const completingUser = UserId.create().value!;
        const notiz = 'Alles erledigt';

        // When
        erinnerung.markErledigt(completingUser, notiz);

        // Then
        const event = erinnerung.getDomainEvents()[0] as ErinnerungErledigtEvent;
        expect(event.erinnerungId).toBe(erinnerung.id);
        expect(event.einsatzId).toBe(erinnerung.einsatzId);
        expect(event.erledigtBy).toBe(completingUser);
        expect(event.titel).toBe('Lagebesprechung');
        expect(event.erledigungsNotiz).toBe('Alles erledigt');
        expect(event.erledigtAm).toBeDefined();
      });

      it('sollte Event ohne Notiz emittieren wenn keine angegeben', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());
        erinnerung.clearDomainEvents();

        // When
        erinnerung.markErledigt(testUserId);

        // Then
        const event = erinnerung.getDomainEvents()[0] as ErinnerungErledigtEvent;
        expect(event.erledigungsNotiz).toBeNull();
      });

      it('sollte kein Event emittieren bei Validierungsfehler (falscher Status)', () => {
        // Given: GEPLANT Status - nicht erledigbar
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.GEPLANT());
        erinnerung.clearDomainEvents();

        // When
        erinnerung.markErledigt(testUserId);

        // Then
        const events = erinnerung.getDomainEvents();
        expect(events).toHaveLength(0);
      });

      it('sollte kein Event emittieren bei Validierungsfehler (zu lange Notiz)', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());
        erinnerung.clearDomainEvents();
        const tooLongNotiz = 'N'.repeat(501);

        // When
        erinnerung.markErledigt(testUserId, tooLongNotiz);

        // Then
        const events = erinnerung.getDomainEvents();
        expect(events).toHaveLength(0);
      });
    });

    describe('istAktiv() nach Erledigung', () => {
      it('sollte Erinnerung als nicht-aktiv markieren nach Erledigung', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());
        expect(erinnerung.istAktiv()).toBe(true);

        // When
        erinnerung.markErledigt(testUserId);

        // Then
        expect(erinnerung.istAktiv()).toBe(false);
      });

      it('sollte GEPLANT Erinnerung als aktiv markieren', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.GEPLANT());

        // Then
        expect(erinnerung.istAktiv()).toBe(true);
      });

      it('sollte AUSGELOEST Erinnerung als aktiv markieren', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.AUSGELOEST());

        // Then
        expect(erinnerung.istAktiv()).toBe(true);
      });

      it('sollte ACKNOWLEDGED Erinnerung als aktiv markieren', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ACKNOWLEDGED());

        // Then
        expect(erinnerung.istAktiv()).toBe(true);
      });

      it('sollte SNOOZED Erinnerung als aktiv markieren', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.SNOOZED());

        // Then
        expect(erinnerung.istAktiv()).toBe(true);
      });

      it('sollte ESKALIERT Erinnerung als aktiv markieren', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ESKALIERT());

        // Then
        expect(erinnerung.istAktiv()).toBe(true);
      });

      it('sollte ERLEDIGT Erinnerung als nicht-aktiv markieren', () => {
        // Given
        const erinnerung = createErinnerungWithStatus(ErinnerungStatus.ERLEDIGT());

        // Then
        expect(erinnerung.istAktiv()).toBe(false);
      });
    });

    describe('reconstruct() mit Erledigt', () => {
      it('sollte erledigte Erinnerung korrekt rekonstruieren', () => {
        // Given
        const id = ErinnerungId.create().value!;
        const titel = ErinnerungTitel.create('Test').value!;
        const erledigtAm = new Date();
        const erledigtBy = UserId.create().value!;
        const erledigungsNotiz = 'Notiz zur Erledigung';

        // When
        const erinnerung = Erinnerung.reconstruct({
          id,
          einsatzId: testEinsatzId,
          titel,
          beschreibung: null,
          faelligAm: new Date(Date.now() + 60 * 60 * 1000),
          status: ErinnerungStatus.ERLEDIGT(),
          erstelltVon: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
          erledigtAm,
          erledigtBy,
          erledigungsNotiz,
        });

        // Then
        expect(erinnerung.status.isErledigt()).toBe(true);
        expect(erinnerung.erledigtAm).toEqual(erledigtAm);
        expect(erinnerung.erledigtBy).toBe(erledigtBy);
        expect(erinnerung.erledigungsNotiz).toBe(erledigungsNotiz);
      });

      it('sollte nicht-erledigte Erinnerung korrekt rekonstruieren (Defaults)', () => {
        // Given
        const id = ErinnerungId.create().value!;
        const titel = ErinnerungTitel.create('Test').value!;

        // When: Ohne Erledigt Felder
        const erinnerung = Erinnerung.reconstruct({
          id,
          einsatzId: testEinsatzId,
          titel,
          beschreibung: null,
          faelligAm: new Date(Date.now() + 60 * 60 * 1000),
          status: ErinnerungStatus.GEPLANT(),
          erstelltVon: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Then: Defaults
        expect(erinnerung.erledigtAm).toBeNull();
        expect(erinnerung.erledigtBy).toBeNull();
        expect(erinnerung.erledigungsNotiz).toBeNull();
      });

      it('sollte requiresNote korrekt rekonstruieren (Story 2.6)', () => {
        // Given
        const id = ErinnerungId.create().value!;
        const titel = ErinnerungTitel.create('Pflicht-Notiz Test').value!;

        // When: Mit requiresNote=true
        const erinnerung = Erinnerung.reconstruct({
          id,
          einsatzId: testEinsatzId,
          titel,
          beschreibung: null,
          faelligAm: new Date(Date.now() + 60 * 60 * 1000),
          status: ErinnerungStatus.GEPLANT(),
          erstelltVon: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
          requiresNote: true,
        });

        // Then
        expect(erinnerung.requiresNote).toBe(true);
      });

      it('sollte requiresNote Default false verwenden (Story 2.6)', () => {
        // Given
        const id = ErinnerungId.create().value!;
        const titel = ErinnerungTitel.create('Test').value!;

        // When: Ohne requiresNote (Default)
        const erinnerung = Erinnerung.reconstruct({
          id,
          einsatzId: testEinsatzId,
          titel,
          beschreibung: null,
          faelligAm: new Date(Date.now() + 60 * 60 * 1000),
          status: ErinnerungStatus.GEPLANT(),
          erstelltVon: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Then: Default false
        expect(erinnerung.requiresNote).toBe(false);
      });
    });
  });

  describe('create() mit requiresNote (Story 2.6)', () => {
    it('sollte Erinnerung mit requiresNote=true erstellen', () => {
      // Given
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);

      // When
      const result = Erinnerung.create({
        einsatzId: testEinsatzId,
        titel: 'Pflicht-Notiz Erinnerung',
        beschreibung: null,
        faelligAm: futureDate,
        erstelltVon: testUserId,
        requiresNote: true,
      });

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.requiresNote).toBe(true);
    });

    it('sollte Erinnerung mit requiresNote=false erstellen', () => {
      // Given
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);

      // When
      const result = Erinnerung.create({
        einsatzId: testEinsatzId,
        titel: 'Normale Erinnerung',
        beschreibung: null,
        faelligAm: futureDate,
        erstelltVon: testUserId,
        requiresNote: false,
      });

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.requiresNote).toBe(false);
    });

    it('sollte Erinnerung mit Default requiresNote=false erstellen wenn nicht angegeben', () => {
      // Given
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);

      // When
      const result = Erinnerung.create({
        einsatzId: testEinsatzId,
        titel: 'Erinnerung ohne requiresNote',
        beschreibung: null,
        faelligAm: futureDate,
        erstelltVon: testUserId,
        // requiresNote nicht angegeben - default false
      });

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.requiresNote).toBe(false);
    });
  });
});
