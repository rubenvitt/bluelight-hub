/**
 * Unit Tests für EinsatzAggregate.
 *
 * Testet alle factory methods, state mutations, query methods, business rules
 * und domain events gemäß AC 1 (>90% Coverage).
 *
 * **Test Coverage Scope:**
 * - Factory Methods: create(), generateNummer()
 * - State Mutations: complete(), archive(), updateStatus(), update()
 * - Query Methods: canBeDeleted(), canBeUpdated(), getters
 * - Business Rules: Status State Machine, NO-DELETE Policy, Archivierung Immutability
 * - Domain Events: EinsatzCreatedEvent, EinsatzStatusChangedEvent, EinsatzCompletedEvent, EinsatzArchivedEvent, EinsatzUpdatedEvent
 *
 * **Test Pattern:**
 * - AAA Pattern (Arrange-Act-Assert) mit deutschen Kommentaren
 * - Result<T> Pattern Assertions
 * - KEINE Framework-Dependencies (pure TypeScript/Jest)
 * - Mock CUID2 für deterministische Tests
 */

import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { EinsatzArchivedEvent } from '@domain/events/einsatz-archived.event';
import { EinsatzCompletedEvent } from '@domain/events/einsatz-completed.event';
import { EinsatzCreatedEvent } from '@domain/events/einsatz-created.event';
import { EinsatzStatusChangedEvent } from '@domain/events/einsatz-status-changed.event';
import { EinsatzUpdatedEvent } from '@domain/events/einsatz-updated.event';
import { Address } from '@domain/value-objects/address';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import { UserId } from '@domain/value-objects/user-id';
import { mockCuid2ForJest } from '@domain/__tests__/test-helpers';

// Mock CUID2 für deterministische Tests
mockCuid2ForJest();

describe('EinsatzAggregate', () => {
  // ============================================
  // FACTORY METHOD: create()
  // ============================================

  describe('create() - Factory Method', () => {
    it('sollte einen validen Einsatz mit allen Feldern erstellen', () => {
      // Given: Valide Props mit allen Feldern
      const createdBy = UserId.create().value!;
      const einsatzort = Address.create({
        strasse: 'Musterstr.',
        hausnummer: '42',
        plz: '80331',
        ort: 'München',
      }).value!;

      const props = {
        alarmstichwort: 'Wohnungsbrand',
        createdBy,
        einsatzort,
        bemerkung: 'Dachstuhl brennt',
      };

      // When: Einsatz wird erstellt
      const result = Einsatz.create(props);

      // Then: Result ist erfolgreich
      expect(result.isSuccess).toBe(true);
      const einsatz = result.value!;
      expect(einsatz).toBeDefined();
      expect(einsatz.alarmstichwort).toBe('Wohnungsbrand');
      expect(einsatz.createdBy).toBe(createdBy);
      expect(einsatz.einsatzort).toBe(einsatzort);
      expect(einsatz.bemerkung).toBe('Dachstuhl brennt');
      expect(einsatz.status.value).toBe('ANGELEGT');
      expect(einsatz.nummer).toBeDefined();
      expect(einsatz.nummer).toMatch(/^E\d{4}-[a-z0-9]{8}$/); // Format: E2024-clw3h8x9
      expect(einsatz.abgeschlossenAt).toBeUndefined();
      expect(einsatz.archivedAt).toBeUndefined();
    });

    it('sollte einen validen Einsatz mit minimalen Feldern erstellen', () => {
      // Given: Valide Props nur mit required Feldern (alarmstichwort, createdBy)
      const createdBy = UserId.create().value!;
      const props = {
        alarmstichwort: 'Verkehrsunfall',
        createdBy,
      };

      // When: Einsatz wird erstellt
      const result = Einsatz.create(props);

      // Then: Result ist erfolgreich und optionale Felder sind undefined
      expect(result.isSuccess).toBe(true);
      const einsatz = result.value!;
      expect(einsatz).toBeDefined();
      expect(einsatz.alarmstichwort).toBe('Verkehrsunfall');
      expect(einsatz.createdBy).toBe(createdBy);
      expect(einsatz.einsatzort).toBeUndefined();
      expect(einsatz.bemerkung).toBeUndefined();
      expect(einsatz.status.value).toBe('ANGELEGT');
    });

    it('sollte fehlschlagen wenn alarmstichwort leer ist', () => {
      // Given: Props mit leerem alarmstichwort
      const createdBy = UserId.create().value!;
      const props = {
        alarmstichwort: '',
        createdBy,
      };

      // When: Einsatz wird erstellt
      const result = Einsatz.create(props);

      // Then: Result scheitert mit passender Fehlermeldung
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Alarmstichwort ist erforderlich');
    });

    it('sollte alarmstichwort trimmen', () => {
      // Given: Props mit alarmstichwort mit leading/trailing whitespace
      const createdBy = UserId.create().value!;
      const props = {
        alarmstichwort: '  Großbrand  ',
        createdBy,
      };

      // When: Einsatz wird erstellt
      const result = Einsatz.create(props);

      // Then: alarmstichwort wurde getrimmt
      expect(result.isSuccess).toBe(true);
      const einsatz = result.value!;
      expect(einsatz.alarmstichwort).toBe('Großbrand');
    });

    it('sollte fehlschlagen wenn alarmstichwort nur whitespace ist', () => {
      // Given: Props mit alarmstichwort das nur aus whitespace besteht
      const createdBy = UserId.create().value!;
      const props = {
        alarmstichwort: '   ',
        createdBy,
      };

      // When: Einsatz wird erstellt
      const result = Einsatz.create(props);

      // Then: Result scheitert da trim() zu leerem String führt
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Alarmstichwort ist erforderlich');
    });

    it('sollte bemerkung trimmen wenn vorhanden', () => {
      // Given: Props mit bemerkung mit whitespace
      const createdBy = UserId.create().value!;
      const props = {
        alarmstichwort: 'Brand',
        createdBy,
        bemerkung: '  Wichtige Info  ',
      };

      // When: Einsatz wird erstellt
      const result = Einsatz.create(props);

      // Then: bemerkung wurde getrimmt
      expect(result.isSuccess).toBe(true);
      const einsatz = result.value!;
      expect(einsatz.bemerkung).toBe('Wichtige Info');
    });

    it('sollte EinsatzCreatedEvent emittieren', () => {
      // Given: Valide Props
      const createdBy = UserId.create().value!;
      const props = {
        alarmstichwort: 'Wohnungsbrand',
        createdBy,
      };

      // When: Einsatz wird erstellt
      const result = Einsatz.create(props);

      // Then: EinsatzCreatedEvent wurde emittiert
      expect(result.isSuccess).toBe(true);
      const einsatz = result.value!;
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(EinsatzCreatedEvent);

      const createdEvent = events[0] as EinsatzCreatedEvent;
      expect(createdEvent.einsatzId).toBe(einsatz.id);
      expect(createdEvent.alarmstichwort).toBe('Wohnungsbrand');
      expect(createdEvent.createdBy).toBe(createdBy);
      expect(createdEvent.nummer).toBe(einsatz.nummer);
    });

    it('sollte unique Einsatznummern generieren', () => {
      // Given: Mehrere Einsätze
      const createdBy = UserId.create().value!;
      const props = {
        alarmstichwort: 'Test',
        createdBy,
      };

      // When: Mehrere Einsätze werden erstellt
      const einsatz1 = Einsatz.create(props).value!;
      const einsatz2 = Einsatz.create(props).value!;
      const einsatz3 = Einsatz.create(props).value!;

      // Then: Alle Einsatznummern sind unique
      const nummern = [einsatz1.nummer, einsatz2.nummer, einsatz3.nummer];
      const uniqueNummern = new Set(nummern);
      expect(uniqueNummern.size).toBe(3);
    });
  });

  // ============================================
  // BUSINESS METHOD: complete()
  // ============================================

  describe('complete() - Business Method', () => {
    it('sollte Einsatz erfolgreich abschließen von Status ANGELEGT', () => {
      // Given: Einsatz mit Status ANGELEGT
      const createdBy = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.clearDomainEvents(); // Clear creation event

      const userId = UserId.create().value!;

      // When: Einsatz wird abgeschlossen
      const result = einsatz.complete(userId);

      // Then: Status ist ABGESCHLOSSEN und abgeschlossenAt ist gesetzt
      expect(result.isSuccess).toBe(true);
      expect(einsatz.status.value).toBe('ABGESCHLOSSEN');
      expect(einsatz.abgeschlossenAt).toBeDefined();
      expect(einsatz.abgeschlossenAt).toBeInstanceOf(Date);

      // Then: Events wurden emittiert
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(2);
      expect(events[0]).toBeInstanceOf(EinsatzCompletedEvent);
      expect(events[1]).toBeInstanceOf(EinsatzStatusChangedEvent);

      const completedEvent = events[0] as EinsatzCompletedEvent;
      expect(completedEvent.einsatzId).toBe(einsatz.id);
      expect(completedEvent.completedBy).toBe(userId);
      expect(completedEvent.completedAt).toBe(einsatz.abgeschlossenAt);

      const statusChangedEvent = events[1] as EinsatzStatusChangedEvent;
      expect(statusChangedEvent.oldStatus.value).toBe('ANGELEGT');
      expect(statusChangedEvent.newStatus.value).toBe('ABGESCHLOSSEN');
    });

    it('sollte Einsatz erfolgreich abschließen von Status IN_BEARBEITUNG', () => {
      // Given: Einsatz mit Status IN_BEARBEITUNG
      const createdBy = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
      einsatz.clearDomainEvents();

      const userId = UserId.create().value!;

      // When: Einsatz wird abgeschlossen
      const result = einsatz.complete(userId);

      // Then: Status ist ABGESCHLOSSEN
      expect(result.isSuccess).toBe(true);
      expect(einsatz.status.value).toBe('ABGESCHLOSSEN');
    });

    it('sollte Einsatz erfolgreich abschließen von Status AUSSTEHEND (nicht im Code, aber test für State Machine)', () => {
      // Given: Einsatz mit Status ANGELEGT (kann direkt zu ABGESCHLOSSEN)
      const createdBy = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.clearDomainEvents();

      const userId = UserId.create().value!;

      // When: Einsatz wird abgeschlossen (direkt von ANGELEGT)
      const result = einsatz.complete(userId);

      // Then: Status ist ABGESCHLOSSEN
      expect(result.isSuccess).toBe(true);
      expect(einsatz.status.value).toBe('ABGESCHLOSSEN');
    });

    it('sollte fehlschlagen wenn Einsatz bereits ABGESCHLOSSEN ist', () => {
      // Given: Einsatz mit Status ABGESCHLOSSEN
      const createdBy = UserId.create().value!;
      const userId = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.complete(userId);
      einsatz.clearDomainEvents();

      // When: Versuche erneut abzuschließen
      const result = einsatz.complete(userId);

      // Then: Result scheitert mit Fehlermeldung
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Ungültige Status-Transition');
      expect(result.error).toContain('ABGESCHLOSSEN → ABGESCHLOSSEN');
    });

    it('sollte fehlschlagen wenn Einsatz ARCHIVIERT ist', () => {
      // Given: Einsatz mit Status ARCHIVIERT
      const createdBy = UserId.create().value!;
      const userId = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.complete(userId);
      einsatz.archive(userId);
      einsatz.clearDomainEvents();

      // When: Versuche archivierten Einsatz abzuschließen
      const result = einsatz.complete(userId);

      // Then: Result scheitert wegen Immutability
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Archivierte Einsätze können nicht abgeschlossen werden');

      // Then: Keine Events emittiert
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(0);
    });
  });

  // ============================================
  // BUSINESS METHOD: archive()
  // ============================================

  describe('archive() - Business Method', () => {
    it('sollte Einsatz erfolgreich archivieren von Status ABGESCHLOSSEN', () => {
      // Given: Einsatz mit Status ABGESCHLOSSEN
      const createdBy = UserId.create().value!;
      const userId = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.complete(userId);
      einsatz.clearDomainEvents();

      // When: Einsatz wird archiviert
      const result = einsatz.archive(userId);

      // Then: Status ist ARCHIVIERT und archivedAt ist gesetzt
      expect(result.isSuccess).toBe(true);
      expect(einsatz.status.value).toBe('ARCHIVIERT');
      expect(einsatz.archivedAt).toBeDefined();
      expect(einsatz.archivedAt).toBeInstanceOf(Date);

      // Then: Events wurden emittiert
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(2);
      expect(events[0]).toBeInstanceOf(EinsatzArchivedEvent);
      expect(events[1]).toBeInstanceOf(EinsatzStatusChangedEvent);

      const archivedEvent = events[0] as EinsatzArchivedEvent;
      expect(archivedEvent.einsatzId).toBe(einsatz.id);
      expect(archivedEvent.archivedBy).toBe(userId);

      const statusChangedEvent = events[1] as EinsatzStatusChangedEvent;
      expect(statusChangedEvent.oldStatus.value).toBe('ABGESCHLOSSEN');
      expect(statusChangedEvent.newStatus.value).toBe('ARCHIVIERT');
    });

    it('sollte Einsatz erfolgreich archivieren von Status ANGELEGT (direkt)', () => {
      // Given: Einsatz mit Status ANGELEGT
      const createdBy = UserId.create().value!;
      const userId = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.clearDomainEvents();

      // When: Einsatz wird direkt archiviert
      const result = einsatz.archive(userId);

      // Then: Status ist ARCHIVIERT
      expect(result.isSuccess).toBe(true);
      expect(einsatz.status.value).toBe('ARCHIVIERT');
    });

    it('sollte Einsatz erfolgreich archivieren von Status IN_BEARBEITUNG (direkt)', () => {
      // Given: Einsatz mit Status IN_BEARBEITUNG
      const createdBy = UserId.create().value!;
      const userId = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
      einsatz.clearDomainEvents();

      // When: Einsatz wird direkt archiviert
      const result = einsatz.archive(userId);

      // Then: Status ist ARCHIVIERT
      expect(result.isSuccess).toBe(true);
      expect(einsatz.status.value).toBe('ARCHIVIERT');
    });

    it('sollte fehlschlagen wenn Einsatz bereits ARCHIVIERT ist', () => {
      // Given: Einsatz mit Status ARCHIVIERT
      const createdBy = UserId.create().value!;
      const userId = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.archive(userId);
      einsatz.clearDomainEvents();

      // When: Versuche erneut zu archivieren
      const result = einsatz.archive(userId);

      // Then: Result scheitert mit Fehlermeldung
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Einsatz ist bereits archiviert');

      // Then: Keine Events emittiert
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(0);
    });

    it('sollte archivierten Einsatz immutable machen', () => {
      // Given: Archivierter Einsatz
      const createdBy = UserId.create().value!;
      const userId = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.archive(userId);
      einsatz.clearDomainEvents();

      // When: Versuche verschiedene Änderungen
      const statusResult = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
      const updateResult = einsatz.update({ alarmstichwort: 'Neuer Einsatz' });
      const completeResult = einsatz.complete(userId);

      // Then: Alle Änderungen scheitern
      expect(statusResult.isFailure).toBe(true);
      expect(statusResult.error).toBe('Archivierte Einsätze können nicht geändert werden');

      expect(updateResult.isFailure).toBe(true);
      expect(updateResult.error).toBe('Archivierte Einsätze können nicht geändert werden');

      expect(completeResult.isFailure).toBe(true);
      expect(completeResult.error).toBe('Archivierte Einsätze können nicht abgeschlossen werden');

      // Then: Keine Events emittiert
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(0);
    });
  });

  // ============================================
  // BUSINESS METHOD: updateStatus()
  // ============================================

  describe('updateStatus() - Business Method', () => {
    describe('Valid Transitions (State Machine)', () => {
      it('sollte gültige Transition ANGELEGT → IN_BEARBEITUNG durchführen', () => {
        // Given: Einsatz mit Status ANGELEGT
        const createdBy = UserId.create().value!;
        const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
        einsatz.clearDomainEvents();

        // When: Status wird zu IN_BEARBEITUNG geändert
        const result = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

        // Then: Transition erfolgreich
        expect(result.isSuccess).toBe(true);
        expect(einsatz.status.value).toBe('IN_BEARBEITUNG');

        // Then: EinsatzStatusChangedEvent wurde emittiert
        const events = einsatz.getDomainEvents();
        expect(events).toHaveLength(1);
        expect(events[0]).toBeInstanceOf(EinsatzStatusChangedEvent);

        const statusEvent = events[0] as EinsatzStatusChangedEvent;
        expect(statusEvent.oldStatus.value).toBe('ANGELEGT');
        expect(statusEvent.newStatus.value).toBe('IN_BEARBEITUNG');
      });

      it('sollte gültige Transition ANGELEGT → ABGESCHLOSSEN durchführen', () => {
        // Given: Einsatz mit Status ANGELEGT
        const createdBy = UserId.create().value!;
        const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
        einsatz.clearDomainEvents();

        // When: Status wird direkt zu ABGESCHLOSSEN geändert
        const result = einsatz.updateStatus(EinsatzStatus.ABGESCHLOSSEN());

        // Then: Transition erfolgreich
        expect(result.isSuccess).toBe(true);
        expect(einsatz.status.value).toBe('ABGESCHLOSSEN');
      });

      it('sollte gültige Transition ANGELEGT → ARCHIVIERT durchführen', () => {
        // Given: Einsatz mit Status ANGELEGT
        const createdBy = UserId.create().value!;
        const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
        einsatz.clearDomainEvents();

        // When: Status wird direkt zu ARCHIVIERT geändert
        const result = einsatz.updateStatus(EinsatzStatus.ARCHIVIERT());

        // Then: Transition erfolgreich
        expect(result.isSuccess).toBe(true);
        expect(einsatz.status.value).toBe('ARCHIVIERT');
      });

      it('sollte gültige Transition IN_BEARBEITUNG → ABGESCHLOSSEN durchführen', () => {
        // Given: Einsatz mit Status IN_BEARBEITUNG
        const createdBy = UserId.create().value!;
        const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
        einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
        einsatz.clearDomainEvents();

        // When: Status wird zu ABGESCHLOSSEN geändert
        const result = einsatz.updateStatus(EinsatzStatus.ABGESCHLOSSEN());

        // Then: Transition erfolgreich
        expect(result.isSuccess).toBe(true);
        expect(einsatz.status.value).toBe('ABGESCHLOSSEN');
      });

      it('sollte gültige Transition IN_BEARBEITUNG → ARCHIVIERT durchführen', () => {
        // Given: Einsatz mit Status IN_BEARBEITUNG
        const createdBy = UserId.create().value!;
        const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
        einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
        einsatz.clearDomainEvents();

        // When: Status wird direkt zu ARCHIVIERT geändert
        const result = einsatz.updateStatus(EinsatzStatus.ARCHIVIERT());

        // Then: Transition erfolgreich
        expect(result.isSuccess).toBe(true);
        expect(einsatz.status.value).toBe('ARCHIVIERT');
      });

      it('sollte gültige Transition ABGESCHLOSSEN → ARCHIVIERT durchführen', () => {
        // Given: Einsatz mit Status ABGESCHLOSSEN
        const createdBy = UserId.create().value!;
        const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
        einsatz.updateStatus(EinsatzStatus.ABGESCHLOSSEN());
        einsatz.clearDomainEvents();

        // When: Status wird zu ARCHIVIERT geändert
        const result = einsatz.updateStatus(EinsatzStatus.ARCHIVIERT());

        // Then: Transition erfolgreich
        expect(result.isSuccess).toBe(true);
        expect(einsatz.status.value).toBe('ARCHIVIERT');
      });
    });

    describe('Invalid Transitions (Backward Transitions)', () => {
      it('sollte ungültige Transition IN_BEARBEITUNG → ANGELEGT verhindern', () => {
        // Given: Einsatz mit Status IN_BEARBEITUNG
        const createdBy = UserId.create().value!;
        const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
        einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
        einsatz.clearDomainEvents();

        // When: Versuche zurück zu ANGELEGT zu gehen
        const result = einsatz.updateStatus(EinsatzStatus.ANGELEGT());

        // Then: Transition scheitert
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Ungültige Status-Transition: IN_BEARBEITUNG → ANGELEGT');
        expect(einsatz.status.value).toBe('IN_BEARBEITUNG'); // Status unverändert

        // Then: Keine Events emittiert
        const events = einsatz.getDomainEvents();
        expect(events).toHaveLength(0);
      });

      it('sollte ungültige Transition ABGESCHLOSSEN → ANGELEGT verhindern', () => {
        // Given: Einsatz mit Status ABGESCHLOSSEN
        const createdBy = UserId.create().value!;
        const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
        einsatz.updateStatus(EinsatzStatus.ABGESCHLOSSEN());
        einsatz.clearDomainEvents();

        // When: Versuche zurück zu ANGELEGT zu gehen
        const result = einsatz.updateStatus(EinsatzStatus.ANGELEGT());

        // Then: Transition scheitert
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Ungültige Status-Transition: ABGESCHLOSSEN → ANGELEGT');
      });

      it('sollte ungültige Transition ABGESCHLOSSEN → IN_BEARBEITUNG verhindern', () => {
        // Given: Einsatz mit Status ABGESCHLOSSEN
        const createdBy = UserId.create().value!;
        const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
        einsatz.updateStatus(EinsatzStatus.ABGESCHLOSSEN());
        einsatz.clearDomainEvents();

        // When: Versuche zurück zu IN_BEARBEITUNG zu gehen
        const result = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

        // Then: Transition scheitert
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Ungültige Status-Transition: ABGESCHLOSSEN → IN_BEARBEITUNG');
      });

      it('sollte ungültige Transition ARCHIVIERT → ANGELEGT verhindern', () => {
        // Given: Einsatz mit Status ARCHIVIERT
        const createdBy = UserId.create().value!;
        const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
        einsatz.updateStatus(EinsatzStatus.ARCHIVIERT());
        einsatz.clearDomainEvents();

        // When: Versuche zurück zu ANGELEGT zu gehen
        const result = einsatz.updateStatus(EinsatzStatus.ANGELEGT());

        // Then: Transition scheitert (State Machine blockiert bereits)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Ungültige Status-Transition: ARCHIVIERT → ANGELEGT');
      });

      it('sollte ungültige Transition ARCHIVIERT → IN_BEARBEITUNG verhindern', () => {
        // Given: Einsatz mit Status ARCHIVIERT
        const createdBy = UserId.create().value!;
        const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
        einsatz.updateStatus(EinsatzStatus.ARCHIVIERT());
        einsatz.clearDomainEvents();

        // When: Versuche zurück zu IN_BEARBEITUNG zu gehen
        const result = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

        // Then: Transition scheitert (State Machine blockiert bereits)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Ungültige Status-Transition: ARCHIVIERT → IN_BEARBEITUNG');
      });

      it('sollte ungültige Transition ARCHIVIERT → ABGESCHLOSSEN verhindern', () => {
        // Given: Einsatz mit Status ARCHIVIERT
        const createdBy = UserId.create().value!;
        const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
        einsatz.updateStatus(EinsatzStatus.ARCHIVIERT());
        einsatz.clearDomainEvents();

        // When: Versuche zurück zu ABGESCHLOSSEN zu gehen
        const result = einsatz.updateStatus(EinsatzStatus.ABGESCHLOSSEN());

        // Then: Transition scheitert (State Machine blockiert bereits)
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Ungültige Status-Transition: ARCHIVIERT → ABGESCHLOSSEN');
      });
    });

    describe('Same Status (No-Op)', () => {
      it('sollte keine Änderung bei gleichem Status durchführen (No-Op)', () => {
        // Given: Einsatz mit Status ANGELEGT
        const createdBy = UserId.create().value!;
        const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
        einsatz.clearDomainEvents();

        // When: Status wird zu gleichem Status geändert
        const result = einsatz.updateStatus(EinsatzStatus.ANGELEGT());

        // Then: Operation erfolgreich aber No-Op
        expect(result.isSuccess).toBe(true);
        expect(einsatz.status.value).toBe('ANGELEGT');

        // Then: Keine Events emittiert (No-Op)
        const events = einsatz.getDomainEvents();
        expect(events).toHaveLength(0);
      });

      it('sollte keine Änderung bei gleichem Status IN_BEARBEITUNG durchführen', () => {
        // Given: Einsatz mit Status IN_BEARBEITUNG
        const createdBy = UserId.create().value!;
        const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
        einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
        einsatz.clearDomainEvents();

        // When: Status wird zu gleichem Status geändert
        const result = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

        // Then: Operation erfolgreich aber No-Op
        expect(result.isSuccess).toBe(true);
        expect(einsatz.status.value).toBe('IN_BEARBEITUNG');

        // Then: Keine Events emittiert
        const events = einsatz.getDomainEvents();
        expect(events).toHaveLength(0);
      });
    });
  });

  // ============================================
  // BUSINESS METHOD: update()
  // ============================================

  describe('update() - Business Method', () => {
    it('sollte alarmstichwort erfolgreich aktualisieren', () => {
      // Given: Einsatz
      const createdBy = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Wohnungsbrand', createdBy }).value!;
      einsatz.clearDomainEvents();

      // When: alarmstichwort wird aktualisiert
      const result = einsatz.update({ alarmstichwort: 'Großbrand' });

      // Then: Aktualisierung erfolgreich
      expect(result.isSuccess).toBe(true);
      expect(einsatz.alarmstichwort).toBe('Großbrand');

      // Then: EinsatzUpdatedEvent wurde emittiert
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(EinsatzUpdatedEvent);

      const updateEvent = events[0] as EinsatzUpdatedEvent;
      expect(updateEvent.updates).toEqual({ alarmstichwort: 'Großbrand' });
    });

    it('sollte einsatzort erfolgreich aktualisieren', () => {
      // Given: Einsatz
      const createdBy = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.clearDomainEvents();

      const neuerOrt = Address.create({
        strasse: 'Neue Str.',
        hausnummer: '1',
        plz: '80331',
        ort: 'München',
      }).value!;

      // When: einsatzort wird aktualisiert
      const result = einsatz.update({ einsatzort: neuerOrt });

      // Then: Aktualisierung erfolgreich
      expect(result.isSuccess).toBe(true);
      expect(einsatz.einsatzort).toBe(neuerOrt);

      // Then: EinsatzUpdatedEvent mit einsatzort toString()
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(EinsatzUpdatedEvent);

      const updateEvent = events[0] as EinsatzUpdatedEvent;
      expect(updateEvent.updates.einsatzort).toBe(neuerOrt.toString());
    });

    it('sollte bemerkung erfolgreich aktualisieren', () => {
      // Given: Einsatz
      const createdBy = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.clearDomainEvents();

      // When: bemerkung wird aktualisiert
      const result = einsatz.update({ bemerkung: 'Neue Bemerkung' });

      // Then: Aktualisierung erfolgreich
      expect(result.isSuccess).toBe(true);
      expect(einsatz.bemerkung).toBe('Neue Bemerkung');

      // Then: EinsatzUpdatedEvent wurde emittiert
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(EinsatzUpdatedEvent);

      const updateEvent = events[0] as EinsatzUpdatedEvent;
      expect(updateEvent.updates).toEqual({ bemerkung: 'Neue Bemerkung' });
    });

    it('sollte mehrere Felder gleichzeitig aktualisieren', () => {
      // Given: Einsatz
      const createdBy = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.clearDomainEvents();

      const neuerOrt = Address.create({
        strasse: 'Test Str.',
        hausnummer: '99',
        plz: '12345',
        ort: 'Berlin',
      }).value!;

      // When: Mehrere Felder werden aktualisiert
      const result = einsatz.update({
        alarmstichwort: 'Schwerer Brand',
        einsatzort: neuerOrt,
        bemerkung: 'Mehrere Verletzte',
      });

      // Then: Alle Felder wurden aktualisiert
      expect(result.isSuccess).toBe(true);
      expect(einsatz.alarmstichwort).toBe('Schwerer Brand');
      expect(einsatz.einsatzort).toBe(neuerOrt);
      expect(einsatz.bemerkung).toBe('Mehrere Verletzte');

      // Then: Event enthält alle Änderungen
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(1);
      const updateEvent = events[0] as EinsatzUpdatedEvent;
      expect(updateEvent.updates).toEqual({
        alarmstichwort: 'Schwerer Brand',
        einsatzort: neuerOrt.toString(),
        bemerkung: 'Mehrere Verletzte',
      });
    });

    it('sollte bemerkung trimmen', () => {
      // Given: Einsatz
      const createdBy = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.clearDomainEvents();

      // When: bemerkung mit whitespace wird aktualisiert
      const result = einsatz.update({ bemerkung: '  Whitespace  ' });

      // Then: bemerkung wurde getrimmt
      expect(result.isSuccess).toBe(true);
      expect(einsatz.bemerkung).toBe('Whitespace');
    });

    it('sollte alarmstichwort trimmen', () => {
      // Given: Einsatz
      const createdBy = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.clearDomainEvents();

      // When: alarmstichwort mit whitespace wird aktualisiert
      const result = einsatz.update({ alarmstichwort: '  Neues Stichwort  ' });

      // Then: alarmstichwort wurde getrimmt
      expect(result.isSuccess).toBe(true);
      expect(einsatz.alarmstichwort).toBe('Neues Stichwort');
    });

    it('sollte fehlschlagen wenn alarmstichwort leer ist', () => {
      // Given: Einsatz
      const createdBy = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.clearDomainEvents();

      // When: Versuche leeres alarmstichwort zu setzen
      const result = einsatz.update({ alarmstichwort: '' });

      // Then: Aktualisierung scheitert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Alarmstichwort darf nicht leer sein');
      expect(einsatz.alarmstichwort).toBe('Brand'); // Unverändert

      // Then: Keine Events emittiert
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(0);
    });

    it('sollte fehlschlagen wenn alarmstichwort nur whitespace ist', () => {
      // Given: Einsatz
      const createdBy = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.clearDomainEvents();

      // When: Versuche whitespace-only alarmstichwort zu setzen
      const result = einsatz.update({ alarmstichwort: '   ' });

      // Then: Aktualisierung scheitert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Alarmstichwort darf nicht leer sein');
    });

    it('sollte fehlschlagen wenn Einsatz ARCHIVIERT ist', () => {
      // Given: Archivierter Einsatz
      const createdBy = UserId.create().value!;
      const userId = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.archive(userId);
      einsatz.clearDomainEvents();

      // When: Versuche archivierten Einsatz zu aktualisieren
      const result = einsatz.update({ alarmstichwort: 'Neuer Brand' });

      // Then: Aktualisierung scheitert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Archivierte Einsätze können nicht geändert werden');

      // Then: Keine Events emittiert
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(0);
    });

    it('sollte kein Event emittieren wenn keine Änderungen vorgenommen wurden', () => {
      // Given: Einsatz
      const createdBy = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.clearDomainEvents();

      // When: Update ohne Felder
      const result = einsatz.update({});

      // Then: Operation erfolgreich aber No-Op
      expect(result.isSuccess).toBe(true);

      // Then: Keine Events emittiert (No-Op)
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(0);
    });
  });

  // ============================================
  // QUERY METHOD: canBeDeleted()
  // ============================================

  describe('canBeDeleted() - NO-DELETE Policy', () => {
    it('sollte IMMER false zurückgeben für Status ANGELEGT', () => {
      // Given: Einsatz mit Status ANGELEGT
      const createdBy = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;

      // When: canBeDeleted() wird aufgerufen
      const canDelete = einsatz.canBeDeleted();

      // Then: IMMER false (NO-DELETE Policy)
      expect(canDelete).toBe(false);
    });

    it('sollte IMMER false zurückgeben für Status IN_BEARBEITUNG', () => {
      // Given: Einsatz mit Status IN_BEARBEITUNG
      const createdBy = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

      // When: canBeDeleted() wird aufgerufen
      const canDelete = einsatz.canBeDeleted();

      // Then: IMMER false
      expect(canDelete).toBe(false);
    });

    it('sollte IMMER false zurückgeben für Status ABGESCHLOSSEN', () => {
      // Given: Einsatz mit Status ABGESCHLOSSEN
      const createdBy = UserId.create().value!;
      const userId = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.complete(userId);

      // When: canBeDeleted() wird aufgerufen
      const canDelete = einsatz.canBeDeleted();

      // Then: IMMER false
      expect(canDelete).toBe(false);
    });

    it('sollte IMMER false zurückgeben für Status ARCHIVIERT', () => {
      // Given: Archivierter Einsatz
      const createdBy = UserId.create().value!;
      const userId = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.archive(userId);

      // When: canBeDeleted() wird aufgerufen
      const canDelete = einsatz.canBeDeleted();

      // Then: IMMER false
      expect(canDelete).toBe(false);
    });
  });

  // ============================================
  // DOMAIN EVENTS
  // ============================================

  describe('Domain Events', () => {
    it('sollte Events über getDomainEvents() abrufen können', () => {
      // Given: Einsatz mit mehreren Operationen
      const createdBy = UserId.create().value!;
      const userId = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;

      // When: Mehrere Operationen
      einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
      einsatz.complete(userId);

      // Then: Alle Events sind abrufbar
      const events = einsatz.getDomainEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toBeInstanceOf(EinsatzCreatedEvent);
      expect(events[1]).toBeInstanceOf(EinsatzStatusChangedEvent);
      expect(events[2]).toBeInstanceOf(EinsatzCompletedEvent);
      expect(events[3]).toBeInstanceOf(EinsatzStatusChangedEvent);
    });

    it('sollte Events über clearEvents() löschen können', () => {
      // Given: Einsatz mit Events
      const createdBy = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      expect(einsatz.getDomainEvents()).toHaveLength(1);

      // When: Events werden gelöscht
      einsatz.clearDomainEvents();

      // Then: Keine Events mehr vorhanden
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(0);
    });

    it('sollte nach clearEvents() neue Events emittieren können', () => {
      // Given: Einsatz mit gelöschten Events
      const createdBy = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;
      einsatz.clearDomainEvents();

      // When: Neue Operation wird durchgeführt
      einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

      // Then: Neues Event wurde emittiert
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(EinsatzStatusChangedEvent);
    });
  });

  // ============================================
  // GETTERS
  // ============================================

  describe('Getters', () => {
    it('sollte alle Getter korrekt zurückgeben', () => {
      // Given: Einsatz mit allen Feldern
      const createdBy = UserId.create().value!;
      const einsatzort = Address.create({
        strasse: 'Test Str.',
        hausnummer: '42',
        plz: '80331',
        ort: 'München',
      }).value!;

      const einsatz = Einsatz.create({
        alarmstichwort: 'Wohnungsbrand',
        createdBy,
        einsatzort,
        bemerkung: 'Test Bemerkung',
      }).value!;

      // Then: Alle Getter funktionieren
      expect(einsatz.id).toBeDefined();
      expect(einsatz.nummer).toBeDefined();
      expect(einsatz.alarmstichwort).toBe('Wohnungsbrand');
      expect(einsatz.status).toBeInstanceOf(EinsatzStatus);
      expect(einsatz.status.value).toBe('ANGELEGT');
      expect(einsatz.createdBy).toBe(createdBy);
      expect(einsatz.einsatzort).toBe(einsatzort);
      expect(einsatz.bemerkung).toBe('Test Bemerkung');
      expect(einsatz.abgeschlossenAt).toBeUndefined();
      expect(einsatz.archivedAt).toBeUndefined();
      expect(einsatz.createdAt).toBeInstanceOf(Date);
      expect(einsatz.updatedAt).toBeInstanceOf(Date);
    });

    it('sollte abgeschlossenAt nach complete() zurückgeben', () => {
      // Given: Abgeschlossener Einsatz
      const createdBy = UserId.create().value!;
      const userId = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;

      // When: Einsatz wird abgeschlossen
      einsatz.complete(userId);

      // Then: abgeschlossenAt ist gesetzt
      expect(einsatz.abgeschlossenAt).toBeDefined();
      expect(einsatz.abgeschlossenAt).toBeInstanceOf(Date);
    });

    it('sollte archivedAt nach archive() zurückgeben', () => {
      // Given: Archivierter Einsatz
      const createdBy = UserId.create().value!;
      const userId = UserId.create().value!;
      const einsatz = Einsatz.create({ alarmstichwort: 'Brand', createdBy }).value!;

      // When: Einsatz wird archiviert
      einsatz.archive(userId);

      // Then: archivedAt ist gesetzt
      expect(einsatz.archivedAt).toBeDefined();
      expect(einsatz.archivedAt).toBeInstanceOf(Date);
    });
  });
});
