import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import { UserId } from '@domain/value-objects/user-id';
import { Address } from '@domain/value-objects/address';
import { EinsatzCreatedEvent } from '@domain/events/einsatz-created.event';
import { EinsatzCompletedEvent } from '@domain/events/einsatz-completed.event';
import { EinsatzArchivedEvent } from '@domain/events/einsatz-archived.event';
import { EinsatzStatusChangedEvent } from '@domain/events/einsatz-status-changed.event';

// Mock CUID2 for Jest compatibility (ESM module issue)
jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn(() => {
    // Generate valid CUID2 format: starts with lowercase letter, 20-30 lowercase alphanumeric chars
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

/**
 * Helper function: Erstellt eine deterministische Test-CUID.
 * Nützlich für Tests, die vorhersagbare IDs benötigen.
 *
 * @param suffix - Optionaler Suffix für Eindeutigkeit zwischen Tests
 * @returns Gültige CUID2-formatierte Test-ID
 */
function _generateTestCuid(suffix = ''): string {
  const base = 'clw3h8x9y0000qwertyu';
  const padding = suffix.padEnd(5, '0').slice(0, 5);
  return base + padding;
}

/**
 * Helper function: Erstellt einen Test-Einsatz mit Standardwerten.
 * Vereinfacht Test-Setup und reduziert Code-Duplizierung.
 *
 * @param overrides - Optional: Props zum Überschreiben der Standardwerte
 * @returns Einsatz Aggregate mit Standardwerten
 */
function createTestEinsatz(overrides?: { alarmstichwort?: string; createdBy?: UserId; einsatzort?: Address; bemerkung?: string }): Einsatz {
  const defaultProps = {
    alarmstichwort: 'Test Wohnungsbrand',
    createdBy: UserId.create().value!,
    einsatzort: Address.create({ plz: '80331', ort: 'München' }).value,
    bemerkung: 'Test Bemerkung',
  };

  const props = { ...defaultProps, ...overrides };
  return Einsatz.create(props).value!;
}

describe('Einsatz Aggregate', () => {
  // Restore original Date after each test
  let originalDate: typeof Date;

  beforeEach(() => {
    originalDate = global.Date;
  });

  afterEach(() => {
    global.Date = originalDate;
  });

  describe('create() - Factory Method', () => {
    it('should create Einsatz with valid props', () => {
      // Given: Valid props
      const props = {
        alarmstichwort: 'Wohnungsbrand',
        createdBy: UserId.create().value!,
        einsatzort: Address.create({ plz: '80331', ort: 'München' }).value,
        bemerkung: 'Obergeschoss',
      };

      // When: Creating Einsatz
      const result = Einsatz.create(props);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.value).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(result.value?.alarmstichwort).toBe('Wohnungsbrand');
      expect(result.value?.einsatzort).toBe(props.einsatzort);
      expect(result.value?.bemerkung).toBe('Obergeschoss');
      expect(result.value?.status.value).toBe('ANGELEGT');
    });

    it('should create Einsatz with minimal props (only required fields)', () => {
      // Given: Minimal props (nur alarmstichwort + createdBy)
      const props = {
        alarmstichwort: 'Verkehrsunfall',
        createdBy: UserId.create().value!,
      };

      // When: Creating Einsatz
      const result = Einsatz.create(props);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.value?.alarmstichwort).toBe('Verkehrsunfall');
      expect(result.value?.einsatzort).toBeUndefined();
      expect(result.value?.bemerkung).toBeUndefined();
    });

    it('should trim alarmstichwort whitespace', () => {
      // Given: Alarmstichwort with leading/trailing whitespace
      const props = {
        alarmstichwort: '  Wohnungsbrand  ',
        createdBy: UserId.create().value!,
      };

      // When: Creating Einsatz
      const result = Einsatz.create(props);

      // Then: Trimmed
      expect(result.isSuccess).toBe(true);
      expect(result.value?.alarmstichwort).toBe('Wohnungsbrand');
    });

    it('should trim bemerkung whitespace', () => {
      // Given: Bemerkung with leading/trailing whitespace
      const props = {
        alarmstichwort: 'Test',
        createdBy: UserId.create().value!,
        bemerkung: '  Test Bemerkung  ',
      };

      // When: Creating Einsatz
      const result = Einsatz.create(props);

      // Then: Trimmed
      expect(result.isSuccess).toBe(true);
      expect(result.value?.bemerkung).toBe('Test Bemerkung');
    });

    it('should fail when alarmstichwort is empty string', () => {
      // Given: Empty alarmstichwort
      const props = {
        alarmstichwort: '',
        createdBy: UserId.create().value!,
      };

      // When: Creating Einsatz
      const result = Einsatz.create(props);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
      expect(result.value).toBeUndefined();
      expect(result.error).toContain('Alarmstichwort ist erforderlich');
    });

    it('should fail when alarmstichwort is whitespace-only', () => {
      // Given: Whitespace-only alarmstichwort
      const props = {
        alarmstichwort: '   ',
        createdBy: UserId.create().value!,
      };

      // When: Creating Einsatz
      const result = Einsatz.create(props);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Alarmstichwort ist erforderlich');
    });

    it('should auto-generate nummer in format E{YEAR}-{CUID-8}', () => {
      // Given: Valid props
      const props = {
        alarmstichwort: 'Test',
        createdBy: UserId.create().value!,
      };

      // When: Creating Einsatz
      const result = Einsatz.create(props);

      // Then: Nummer matches pattern E{YEAR}-{8-char-cuid}
      const year = new Date().getFullYear();
      expect(result.value?.nummer).toMatch(new RegExp(`^E${year}-[a-z0-9]{8}$`));
    });

    it('should generate unique nummer for each Einsatz', () => {
      // Given: Multiple Einsatz creations
      const props = {
        alarmstichwort: 'Test',
        createdBy: UserId.create().value!,
      };

      // When: Creating multiple Einsaetze
      const einsatz1 = Einsatz.create(props).value!;
      const einsatz2 = Einsatz.create(props).value!;
      const einsatz3 = Einsatz.create(props).value!;

      // Then: All nummern are different
      expect(einsatz1.nummer).not.toBe(einsatz2.nummer);
      expect(einsatz2.nummer).not.toBe(einsatz3.nummer);
      expect(einsatz1.nummer).not.toBe(einsatz3.nummer);
    });

    it('should auto-generate EinsatzId (valid CUID)', () => {
      // Given: Valid props
      const props = {
        alarmstichwort: 'Test',
        createdBy: UserId.create().value!,
      };

      // When: Creating Einsatz
      const einsatz = Einsatz.create(props).value!;

      // Then: Valid EinsatzId (CUID format: lowercase letter followed by lowercase alphanumeric)
      expect(einsatz.id).toBeDefined();
      expect(einsatz.id.value).toMatch(/^[a-z][a-z0-9]+$/);
    });

    it('should set initial status to ANGELEGT', () => {
      // Given: Valid props
      const props = {
        alarmstichwort: 'Test',
        createdBy: UserId.create().value!,
      };

      // When: Creating Einsatz
      const einsatz = Einsatz.create(props).value!;

      // Then: Initial status is ANGELEGT
      expect(einsatz.status.value).toBe('ANGELEGT');
      expect(einsatz.status.equals(EinsatzStatus.ANGELEGT())).toBe(true);
    });

    it('should emit EinsatzCreatedEvent', () => {
      // Given: Valid props
      const userId = UserId.create().value!;
      const props = {
        alarmstichwort: 'Wohnungsbrand',
        createdBy: userId,
      };

      // When: Creating Einsatz
      const einsatz = Einsatz.create(props).value!;

      // Then: Event emitted
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(EinsatzCreatedEvent);
      expect((events[0] as EinsatzCreatedEvent).einsatzId).toBe(einsatz.id);
      expect((events[0] as EinsatzCreatedEvent).createdBy).toBe(userId);
      expect((events[0] as EinsatzCreatedEvent).alarmstichwort).toBe('Wohnungsbrand');
    });

    it('should set createdBy property correctly', () => {
      // Given: UserId
      const userId = UserId.create().value!;
      const props = {
        alarmstichwort: 'Test',
        createdBy: userId,
      };

      // When: Creating Einsatz
      const einsatz = Einsatz.create(props).value!;

      // Then: createdBy is set
      expect(einsatz.createdBy).toBe(userId);
    });
  });

  describe('Getters - Readonly Properties', () => {
    it('should provide readonly access to nummer', () => {
      // Given: Einsatz
      const einsatz = createTestEinsatz();

      // When: Accessing nummer
      const nummer = einsatz.nummer;

      // Then: Returns auto-generated nummer (CUID format)
      expect(nummer).toMatch(/^E\d{4}-[a-z0-9]{8}$/);
    });

    it('should provide readonly access to alarmstichwort', () => {
      // Given: Einsatz
      const einsatz = createTestEinsatz({ alarmstichwort: 'Verkehrsunfall' });

      // When: Accessing alarmstichwort
      const alarmstichwort = einsatz.alarmstichwort;

      // Then: Returns alarmstichwort
      expect(alarmstichwort).toBe('Verkehrsunfall');
    });

    it('should provide readonly access to status', () => {
      // Given: Einsatz
      const einsatz = createTestEinsatz();

      // When: Accessing status
      const status = einsatz.status;

      // Then: Returns EinsatzStatus instance
      expect(status).toBeInstanceOf(EinsatzStatus);
      expect(status.value).toBe('ANGELEGT');
    });

    it('should provide readonly access to einsatzort', () => {
      // Given: Einsatz with einsatzort
      const address = Address.create({ plz: '12345', ort: 'Berlin' }).value!;
      const einsatz = createTestEinsatz({ einsatzort: address });

      // When: Accessing einsatzort
      const einsatzort = einsatz.einsatzort;

      // Then: Returns Address instance
      expect(einsatzort).toBe(address);
    });

    it('should return undefined for einsatzort when not provided', () => {
      // Given: Einsatz without einsatzort
      const einsatz = Einsatz.create({
        alarmstichwort: 'Test',
        createdBy: UserId.create().value!,
      }).value!;

      // When: Accessing einsatzort
      const einsatzort = einsatz.einsatzort;

      // Then: Returns undefined
      expect(einsatzort).toBeUndefined();
    });

    it('should provide readonly access to bemerkung', () => {
      // Given: Einsatz with bemerkung
      const einsatz = createTestEinsatz({ bemerkung: 'Wichtige Notiz' });

      // When: Accessing bemerkung
      const bemerkung = einsatz.bemerkung;

      // Then: Returns bemerkung
      expect(bemerkung).toBe('Wichtige Notiz');
    });

    it('should return undefined for bemerkung when not provided', () => {
      // Given: Einsatz without bemerkung
      const einsatz = Einsatz.create({
        alarmstichwort: 'Test',
        createdBy: UserId.create().value!,
      }).value!;

      // When: Accessing bemerkung
      const bemerkung = einsatz.bemerkung;

      // Then: Returns undefined
      expect(bemerkung).toBeUndefined();
    });

    it('should provide readonly access to createdBy', () => {
      // Given: Einsatz
      const userId = UserId.create().value!;
      const einsatz = createTestEinsatz({ createdBy: userId });

      // When: Accessing createdBy
      const createdBy = einsatz.createdBy;

      // Then: Returns UserId instance
      expect(createdBy).toBe(userId);
    });

    it('should return undefined for abgeschlossenAt initially', () => {
      // Given: Newly created Einsatz
      const einsatz = createTestEinsatz();

      // When: Accessing abgeschlossenAt
      const abgeschlossenAt = einsatz.abgeschlossenAt;

      // Then: Returns undefined (not completed yet)
      expect(abgeschlossenAt).toBeUndefined();
    });

    it('should return undefined for archivedAt initially', () => {
      // Given: Newly created Einsatz
      const einsatz = createTestEinsatz();

      // When: Accessing archivedAt
      const archivedAt = einsatz.archivedAt;

      // Then: Returns undefined (not archived yet)
      expect(archivedAt).toBeUndefined();
    });
  });

  describe('Status Transitions - Valid Paths', () => {
    it('should transition ANGELEGT -> ABGESCHLOSSEN via complete()', () => {
      // Given: Einsatz in ANGELEGT status
      const einsatz = createTestEinsatz();
      const userId = UserId.create().value!;

      // When: Completing einsatz
      const result = einsatz.complete(userId);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.error).toBeUndefined();
      expect(einsatz.status.value).toBe('ABGESCHLOSSEN');
    });

    it('should transition ANGELEGT -> IN_BEARBEITUNG via updateStatus()', () => {
      // Given: Einsatz in ANGELEGT status
      const einsatz = createTestEinsatz();

      // When: Transitioning to IN_BEARBEITUNG
      const result = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(einsatz.status.value).toBe('IN_BEARBEITUNG');
    });

    it('should transition ANGELEGT -> ARCHIVIERT via archive()', () => {
      // Given: Einsatz in ANGELEGT status
      const einsatz = createTestEinsatz();
      const userId = UserId.create().value!;

      // When: Archiving directly
      const result = einsatz.archive(userId);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(einsatz.status.value).toBe('ARCHIVIERT');
    });

    it('should transition IN_BEARBEITUNG -> ABGESCHLOSSEN via complete()', () => {
      // Given: Einsatz in IN_BEARBEITUNG status
      const einsatz = createTestEinsatz();
      einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
      const userId = UserId.create().value!;

      // When: Completing einsatz
      const result = einsatz.complete(userId);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(einsatz.status.value).toBe('ABGESCHLOSSEN');
    });

    it('should transition IN_BEARBEITUNG -> ARCHIVIERT via archive()', () => {
      // Given: Einsatz in IN_BEARBEITUNG status
      const einsatz = createTestEinsatz();
      einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
      const userId = UserId.create().value!;

      // When: Archiving
      const result = einsatz.archive(userId);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(einsatz.status.value).toBe('ARCHIVIERT');
    });

    it('should transition ABGESCHLOSSEN -> ARCHIVIERT via archive()', () => {
      // Given: Einsatz in ABGESCHLOSSEN status
      const einsatz = createTestEinsatz();
      const userId = UserId.create().value!;
      einsatz.complete(userId);

      // When: Archiving
      const result = einsatz.archive(userId);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(einsatz.status.value).toBe('ARCHIVIERT');
    });

    it('should set abgeschlossenAt timestamp on complete()', () => {
      // Given: Einsatz
      const einsatz = createTestEinsatz();
      const before = new Date();

      // When: Completing
      const userId = UserId.create().value!;
      einsatz.complete(userId);
      const after = new Date();

      // Then: Timestamp set and within expected range
      expect(einsatz.abgeschlossenAt).toBeInstanceOf(Date);
      expect(einsatz.abgeschlossenAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(einsatz.abgeschlossenAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should set archivedAt timestamp on archive()', () => {
      // Given: Einsatz
      const einsatz = createTestEinsatz();
      const before = new Date();

      // When: Archiving
      const userId = UserId.create().value!;
      einsatz.archive(userId);
      const after = new Date();

      // Then: Timestamp set and within expected range
      expect(einsatz.archivedAt).toBeInstanceOf(Date);
      expect(einsatz.archivedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(einsatz.archivedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should emit EinsatzCompletedEvent and EinsatzStatusChangedEvent on complete()', () => {
      // Given: Einsatz
      const einsatz = createTestEinsatz();
      einsatz.clearDomainEvents(); // Clear creation event
      const userId = UserId.create().value!;

      // When: Completing
      einsatz.complete(userId);

      // Then: 2 events emitted
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(2);
      expect(events[0]).toBeInstanceOf(EinsatzCompletedEvent);
      expect(events[1]).toBeInstanceOf(EinsatzStatusChangedEvent);

      // Validate EinsatzCompletedEvent properties
      const completedEvent = events[0] as EinsatzCompletedEvent;
      expect(completedEvent.einsatzId).toBe(einsatz.id);
      expect(completedEvent.completedBy).toBe(userId);
      expect(completedEvent.completedAt).toBe(einsatz.abgeschlossenAt);

      // Validate EinsatzStatusChangedEvent properties
      const statusChangedEvent = events[1] as EinsatzStatusChangedEvent;
      expect(statusChangedEvent.einsatzId).toBe(einsatz.id);
      expect(statusChangedEvent.oldStatus.value).toBe('ANGELEGT');
      expect(statusChangedEvent.newStatus.value).toBe('ABGESCHLOSSEN');
    });

    it('should emit EinsatzArchivedEvent and EinsatzStatusChangedEvent on archive()', () => {
      // Given: Einsatz
      const einsatz = createTestEinsatz();
      einsatz.clearDomainEvents(); // Clear creation event
      const userId = UserId.create().value!;

      // When: Archiving
      einsatz.archive(userId);

      // Then: 2 events emitted
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(2);
      expect(events[0]).toBeInstanceOf(EinsatzArchivedEvent);
      expect(events[1]).toBeInstanceOf(EinsatzStatusChangedEvent);

      // Validate EinsatzArchivedEvent properties
      const archivedEvent = events[0] as EinsatzArchivedEvent;
      expect(archivedEvent.einsatzId).toBe(einsatz.id);
      expect(archivedEvent.archivedBy).toBe(userId);

      // Validate EinsatzStatusChangedEvent properties
      const statusChangedEvent = events[1] as EinsatzStatusChangedEvent;
      expect(statusChangedEvent.einsatzId).toBe(einsatz.id);
      expect(statusChangedEvent.oldStatus.value).toBe('ANGELEGT');
      expect(statusChangedEvent.newStatus.value).toBe('ARCHIVIERT');
    });

    it('should emit EinsatzStatusChangedEvent on updateStatus()', () => {
      // Given: Einsatz
      const einsatz = createTestEinsatz();
      einsatz.clearDomainEvents(); // Clear creation event

      // When: Updating status
      einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

      // Then: 1 event emitted
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(EinsatzStatusChangedEvent);

      // Validate event properties
      const event = events[0] as EinsatzStatusChangedEvent;
      expect(event.einsatzId).toBe(einsatz.id);
      expect(event.oldStatus.value).toBe('ANGELEGT');
      expect(event.newStatus.value).toBe('IN_BEARBEITUNG');
    });
  });

  describe('Status Transitions - Invalid Paths', () => {
    it('should block backward transition ABGESCHLOSSEN -> ANGELEGT', () => {
      // Given: Einsatz in ABGESCHLOSSEN status
      const einsatz = createTestEinsatz();
      einsatz.complete(UserId.create().value!);

      // When: Attempting backward transition
      const result = einsatz.updateStatus(EinsatzStatus.ANGELEGT());

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('Ungültige Status-Transition');
      expect(result.error).toContain('ABGESCHLOSSEN');
      expect(result.error).toContain('ANGELEGT');
      expect(einsatz.status.value).toBe('ABGESCHLOSSEN'); // Status unchanged
    });

    it('should block backward transition ABGESCHLOSSEN -> IN_BEARBEITUNG', () => {
      // Given: Einsatz in ABGESCHLOSSEN status
      const einsatz = createTestEinsatz();
      einsatz.complete(UserId.create().value!);

      // When: Attempting backward transition
      const result = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Ungültige Status-Transition');
      expect(einsatz.status.value).toBe('ABGESCHLOSSEN');
    });

    it('should block backward transition IN_BEARBEITUNG -> ANGELEGT', () => {
      // Given: Einsatz in IN_BEARBEITUNG status
      const einsatz = createTestEinsatz();
      einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

      // When: Attempting backward transition
      const result = einsatz.updateStatus(EinsatzStatus.ANGELEGT());

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Ungültige Status-Transition');
      expect(einsatz.status.value).toBe('IN_BEARBEITUNG');
    });

    it('should block all transitions from ARCHIVIERT via updateStatus()', () => {
      // Given: Archived Einsatz
      const einsatz = createTestEinsatz();
      einsatz.archive(UserId.create().value!);

      // When: Attempting any transition
      const result = einsatz.updateStatus(EinsatzStatus.ANGELEGT());

      // Then: Failure (archived is immutable)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Archivierte Einsätze können nicht geändert werden');
      expect(einsatz.status.value).toBe('ARCHIVIERT');
    });

    it('should block transition from ARCHIVIERT to IN_BEARBEITUNG', () => {
      // Given: Archived Einsatz
      const einsatz = createTestEinsatz();
      einsatz.archive(UserId.create().value!);

      // When: Attempting transition
      const result = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Archivierte Einsätze können nicht geändert werden');
      expect(einsatz.status.value).toBe('ARCHIVIERT');
    });

    it('should block transition from ARCHIVIERT to ABGESCHLOSSEN', () => {
      // Given: Archived Einsatz
      const einsatz = createTestEinsatz();
      einsatz.archive(UserId.create().value!);

      // When: Attempting transition
      const result = einsatz.updateStatus(EinsatzStatus.ABGESCHLOSSEN());

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Archivierte Einsätze können nicht geändert werden');
    });

    it('should reject complete() when already archived', () => {
      // Given: Archived Einsatz
      const einsatz = createTestEinsatz();
      einsatz.archive(UserId.create().value!);

      // When: Attempting to complete
      const result = einsatz.complete(UserId.create().value!);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Archivierte Einsätze können nicht abgeschlossen werden');
    });

    it('should reject archive() when already archived', () => {
      // Given: Already archived Einsatz
      const einsatz = createTestEinsatz();
      const userId = UserId.create().value!;
      einsatz.archive(userId);

      // When: Attempting to archive again
      const result = einsatz.archive(userId);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Einsatz ist bereits archiviert');
    });
  });

  describe('NO-DELETE Policy', () => {
    it('should ALWAYS return false for canBeDeleted() when ANGELEGT', () => {
      // Given: Einsatz in ANGELEGT status
      const einsatz = createTestEinsatz();

      // When/Then: Returns false
      expect(einsatz.canBeDeleted()).toBe(false);
    });

    it('should ALWAYS return false for canBeDeleted() when IN_BEARBEITUNG', () => {
      // Given: Einsatz in IN_BEARBEITUNG status
      const einsatz = createTestEinsatz();
      einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

      // When/Then: Returns false
      expect(einsatz.canBeDeleted()).toBe(false);
    });

    it('should ALWAYS return false for canBeDeleted() when ABGESCHLOSSEN', () => {
      // Given: Einsatz in ABGESCHLOSSEN status
      const einsatz = createTestEinsatz();
      einsatz.complete(UserId.create().value!);

      // When/Then: Returns false
      expect(einsatz.canBeDeleted()).toBe(false);
    });

    it('should ALWAYS return false for canBeDeleted() when ARCHIVIERT', () => {
      // Given: Archived Einsatz
      const einsatz = createTestEinsatz();
      einsatz.archive(UserId.create().value!);

      // When/Then: Returns false
      expect(einsatz.canBeDeleted()).toBe(false);
    });

    it('should enforce NO-DELETE policy for all statuses', () => {
      // Given: Einsaetze in verschiedenen Zustaenden
      const einsatzAngelegt = createTestEinsatz();
      const einsatzInBearbeitung = createTestEinsatz();
      einsatzInBearbeitung.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
      const einsatzAbgeschlossen = createTestEinsatz();
      einsatzAbgeschlossen.complete(UserId.create().value!);
      const einsatzArchiviert = createTestEinsatz();
      einsatzArchiviert.archive(UserId.create().value!);

      // When/Then: All return false (NO-DELETE Policy)
      expect(einsatzAngelegt.canBeDeleted()).toBe(false);
      expect(einsatzInBearbeitung.canBeDeleted()).toBe(false);
      expect(einsatzAbgeschlossen.canBeDeleted()).toBe(false);
      expect(einsatzArchiviert.canBeDeleted()).toBe(false);
    });
  });

  describe('Archival Immutability', () => {
    it('should reject updateStatus() when archived', () => {
      // Given: Archived Einsatz
      const einsatz = createTestEinsatz();
      einsatz.archive(UserId.create().value!);

      // When: Attempting status change
      const result = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Archivierte Einsätze können nicht geändert werden');
    });

    it('should reject complete() when already archived', () => {
      // Given: Archived Einsatz
      const einsatz = createTestEinsatz();
      einsatz.archive(UserId.create().value!);

      // When: Attempting to complete
      const result = einsatz.complete(UserId.create().value!);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Archivierte Einsätze können nicht abgeschlossen werden');
    });

    it('should preserve immutability for all status changes after archiving', () => {
      // Given: Archived Einsatz
      const einsatz = createTestEinsatz();
      const userId = UserId.create().value!;
      einsatz.archive(userId);

      // When: Attempting various mutations
      const result1 = einsatz.updateStatus(EinsatzStatus.ANGELEGT());
      const result2 = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
      const result3 = einsatz.updateStatus(EinsatzStatus.ABGESCHLOSSEN());
      const result4 = einsatz.complete(userId);

      // Then: All fail
      expect(result1.isFailure).toBe(true);
      expect(result2.isFailure).toBe(true);
      expect(result3.isFailure).toBe(true);
      expect(result4.isFailure).toBe(true);

      // Status remains ARCHIVIERT
      expect(einsatz.status.value).toBe('ARCHIVIERT');
    });
  });

  describe('Event Accumulation', () => {
    it('should accumulate events from create()', () => {
      // Given: Einsatz creation
      const einsatz = createTestEinsatz();

      // When: Getting events
      const events = einsatz.getDomainEvents();

      // Then: 1 event (EinsatzCreatedEvent)
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(EinsatzCreatedEvent);
    });

    it('should accumulate events from create() + complete()', () => {
      // Given: Einsatz
      const einsatz = createTestEinsatz();

      // When: Completing
      einsatz.complete(UserId.create().value!);

      // Then: 3 events (Created, Completed, StatusChanged)
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(3);
      expect(events[0]).toBeInstanceOf(EinsatzCreatedEvent);
      expect(events[1]).toBeInstanceOf(EinsatzCompletedEvent);
      expect(events[2]).toBeInstanceOf(EinsatzStatusChangedEvent);
    });

    it('should accumulate events from create() + updateStatus()', () => {
      // Given: Einsatz
      const einsatz = createTestEinsatz();

      // When: Updating status
      einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

      // Then: 2 events (Created, StatusChanged)
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(2);
      expect(events[0]).toBeInstanceOf(EinsatzCreatedEvent);
      expect(events[1]).toBeInstanceOf(EinsatzStatusChangedEvent);
    });

    it('should accumulate multiple events from full lifecycle', () => {
      // Given: Einsatz
      const einsatz = createTestEinsatz();
      const userId = UserId.create().value!;

      // When: Performing multiple operations
      einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG()); // +1 event (StatusChanged)
      einsatz.complete(userId); // +2 events (Completed, StatusChanged)
      einsatz.archive(userId); // +2 events (Archived, StatusChanged)

      // Then: 6 events accumulated (1 Created + 1 StatusChanged + 2 Complete + 2 Archive)
      const events = einsatz.getDomainEvents();
      expect(events).toHaveLength(6);
      expect(events[0]).toBeInstanceOf(EinsatzCreatedEvent);
      expect(events[1]).toBeInstanceOf(EinsatzStatusChangedEvent); // IN_BEARBEITUNG
      expect(events[2]).toBeInstanceOf(EinsatzCompletedEvent);
      expect(events[3]).toBeInstanceOf(EinsatzStatusChangedEvent); // ABGESCHLOSSEN
      expect(events[4]).toBeInstanceOf(EinsatzArchivedEvent);
      expect(events[5]).toBeInstanceOf(EinsatzStatusChangedEvent); // ARCHIVIERT
    });

    it('should return shallow copy from getDomainEvents()', () => {
      // Given: Einsatz with events
      const einsatz = createTestEinsatz();

      // When: Getting events twice
      const events1 = einsatz.getDomainEvents();
      const events2 = einsatz.getDomainEvents();

      // Then: Different array instances (shallow copy)
      expect(events1).not.toBe(events2);
      expect(events1).toEqual(events2); // Same content
    });

    it('should clear events via clearDomainEvents()', () => {
      // Given: Einsatz with events
      const einsatz = createTestEinsatz();
      expect(einsatz.getDomainEvents()).toHaveLength(1);

      // When: Clearing events
      einsatz.clearDomainEvents();

      // Then: Events cleared
      expect(einsatz.getDomainEvents()).toHaveLength(0);
    });

    it('should not emit event on no-op status change (same status)', () => {
      // Given: Einsatz in ANGELEGT status
      const einsatz = createTestEinsatz();
      einsatz.clearDomainEvents();

      // When: Attempting to set same status
      const result = einsatz.updateStatus(EinsatzStatus.ANGELEGT());

      // Then: Success but no event emitted (no-op)
      expect(result.isSuccess).toBe(true);
      expect(einsatz.getDomainEvents()).toHaveLength(0);
    });

    it('should not mutate original events array when getting shallow copy', () => {
      // Given: Einsatz with events
      const einsatz = createTestEinsatz();

      // When: Getting events and mutating copy
      const events1 = einsatz.getDomainEvents();
      const originalLength = events1.length;
      // biome-ignore lint/suspicious/noExplicitAny: Test verifies shallow copy behavior
      events1.push({} as any); // Mutate copy

      // Then: Original events unchanged
      const events2 = einsatz.getDomainEvents();
      expect(events2).toHaveLength(originalLength);
    });
  });

  describe('Aggregate Equality', () => {
    it('should return true for same instance (identity equality)', () => {
      // Given: Same Einsatz instance
      const einsatz1 = createTestEinsatz();
      const einsatz2 = einsatz1; // Same reference

      // When: Comparing
      const areEqual = einsatz1.equals(einsatz2);

      // Then: Equals returns true
      expect(areEqual).toBe(true);
    });

    it('should return false for different instances with different IDs', () => {
      // Given: Two different Einsaetze
      const einsatz1 = createTestEinsatz();
      const einsatz2 = createTestEinsatz();

      // When: Comparing
      const areEqual = einsatz1.equals(einsatz2);

      // Then: Equals returns false (different IDs)
      expect(areEqual).toBe(false);
      expect(einsatz1.id.equals(einsatz2.id)).toBe(false);
    });

    it('should return false when comparing with undefined', () => {
      // Given: Einsatz and undefined
      const einsatz = createTestEinsatz();

      // When: Comparing with undefined
      // biome-ignore lint/suspicious/noExplicitAny: Test verifies null-safety
      const areEqual = einsatz.equals(undefined as any);

      // Then: Returns false
      expect(areEqual).toBe(false);
    });

    it('should return false when comparing with null', () => {
      // Given: Einsatz and null
      const einsatz = createTestEinsatz();

      // When: Comparing with null
      // biome-ignore lint/suspicious/noExplicitAny: Test verifies null-safety
      const areEqual = einsatz.equals(null as any);

      // Then: Returns false
      expect(areEqual).toBe(false);
    });

    it('should use identity equality (not structural equality)', () => {
      // Given: Two Einsaetze with identical properties (but different IDs)
      const props = {
        alarmstichwort: 'Identical',
        createdBy: UserId.create().value!,
      };
      const einsatz1 = Einsatz.create(props).value!;
      const einsatz2 = Einsatz.create(props).value!;

      // When: Comparing
      const areEqual = einsatz1.equals(einsatz2);

      // Then: Returns false (identity, not structural)
      expect(areEqual).toBe(false);
      expect(einsatz1.alarmstichwort).toBe(einsatz2.alarmstichwort);
      expect(einsatz1.id.equals(einsatz2.id)).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle complete() on already completed Einsatz (no-op allowed)', () => {
      // Given: Already completed Einsatz
      const einsatz = createTestEinsatz();
      const userId = UserId.create().value!;
      einsatz.complete(userId);
      const firstCompletedAt = einsatz.abgeschlossenAt;

      // When: Attempting to complete again
      const result = einsatz.complete(userId);

      // Then: Failure (can't transition ABGESCHLOSSEN -> ABGESCHLOSSEN)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Ungültige Status-Transition');
      expect(einsatz.abgeschlossenAt).toBe(firstCompletedAt); // Unchanged
    });

    it('should handle multiple status changes maintaining consistency', () => {
      // Given: Einsatz
      const einsatz = createTestEinsatz();

      // When: Multiple valid transitions
      einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
      expect(einsatz.status.value).toBe('IN_BEARBEITUNG');

      einsatz.updateStatus(EinsatzStatus.ABGESCHLOSSEN());
      expect(einsatz.status.value).toBe('ABGESCHLOSSEN');

      // Then: Status is consistent
      expect(einsatz.status.value).toBe('ABGESCHLOSSEN');
    });

    it('should maintain timestamps consistency across operations', () => {
      // Given: Einsatz
      const einsatz = createTestEinsatz();
      const createdAt = einsatz.createdAt;

      // When: Completing and archiving
      const userId = UserId.create().value!;
      einsatz.complete(userId);
      const abgeschlossenAt = einsatz.abgeschlossenAt;

      einsatz.archive(userId);
      const archivedAt = einsatz.archivedAt;

      // Then: Timestamps are sequential
      expect(createdAt).toBeInstanceOf(Date);
      expect(abgeschlossenAt).toBeInstanceOf(Date);
      expect(archivedAt).toBeInstanceOf(Date);
      expect(abgeschlossenAt!.getTime()).toBeGreaterThanOrEqual(createdAt.getTime());
      expect(archivedAt!.getTime()).toBeGreaterThanOrEqual(abgeschlossenAt!.getTime());
    });

    it('should preserve all properties after status transitions', () => {
      // Given: Einsatz with all properties
      const userId = UserId.create().value!;
      const address = Address.create({ plz: '12345', ort: 'Berlin' }).value!;
      const einsatz = createTestEinsatz({
        alarmstichwort: 'Wohnungsbrand',
        createdBy: userId,
        einsatzort: address,
        bemerkung: 'Test',
      });

      const originalId = einsatz.id;
      const originalNummer = einsatz.nummer;
      const originalAlarmstichwort = einsatz.alarmstichwort;
      const originalEinsatzort = einsatz.einsatzort;
      const originalBemerkung = einsatz.bemerkung;
      const originalCreatedBy = einsatz.createdBy;

      // When: Multiple transitions
      einsatz.complete(userId);
      einsatz.archive(userId);

      // Then: All properties preserved
      expect(einsatz.id).toBe(originalId);
      expect(einsatz.nummer).toBe(originalNummer);
      expect(einsatz.alarmstichwort).toBe(originalAlarmstichwort);
      expect(einsatz.einsatzort).toBe(originalEinsatzort);
      expect(einsatz.bemerkung).toBe(originalBemerkung);
      expect(einsatz.createdBy).toBe(originalCreatedBy);
    });

    it('should handle rapid status changes without state corruption', () => {
      // Given: Einsatz
      const einsatz = createTestEinsatz();
      const userId = UserId.create().value!;

      // When: Rapid valid transitions
      const result1 = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
      const result2 = einsatz.complete(userId);
      const result3 = einsatz.archive(userId);

      // Then: All succeed and final state is correct
      expect(result1.isSuccess).toBe(true);
      expect(result2.isSuccess).toBe(true);
      expect(result3.isSuccess).toBe(true);
      expect(einsatz.status.value).toBe('ARCHIVIERT');
      expect(einsatz.abgeschlossenAt).toBeDefined();
      expect(einsatz.archivedAt).toBeDefined();
    });

    it('should fail gracefully on invalid transitions without corrupting state', () => {
      // Given: Einsatz in ABGESCHLOSSEN
      const einsatz = createTestEinsatz();
      einsatz.complete(UserId.create().value!);
      const statusBeforeFailure = einsatz.status.value;

      // When: Attempting invalid transition
      const result = einsatz.updateStatus(EinsatzStatus.ANGELEGT());

      // Then: Fails but state unchanged
      expect(result.isFailure).toBe(true);
      expect(einsatz.status.value).toBe(statusBeforeFailure);
      expect(einsatz.status.value).toBe('ABGESCHLOSSEN');
    });
  });

  describe('Type Safety and Value Objects', () => {
    it('should work with EinsatzId value object', () => {
      // Given: Einsatz
      const einsatz = createTestEinsatz();

      // When: Accessing ID
      const id = einsatz.id;

      // Then: Is EinsatzId instance with valid CUID format
      expect(id).toBeInstanceOf(EinsatzId);
      expect(id.value).toMatch(/^[a-z][a-z0-9]+$/);
    });

    it('should work with EinsatzStatus value object', () => {
      // Given: Einsatz
      const einsatz = createTestEinsatz();

      // When: Accessing status
      const status = einsatz.status;

      // Then: Is EinsatzStatus instance
      expect(status).toBeInstanceOf(EinsatzStatus);
      expect(status.value).toBe('ANGELEGT');
    });

    it('should work with UserId value object', () => {
      // Given: UserId
      const userId = UserId.create().value!;
      const einsatz = createTestEinsatz({ createdBy: userId });

      // When: Accessing createdBy
      const createdBy = einsatz.createdBy;

      // Then: Is UserId instance
      expect(createdBy).toBeInstanceOf(UserId);
      expect(createdBy).toBe(userId);
    });

    it('should work with Address value object', () => {
      // Given: Address
      const address = Address.create({ plz: '12345', ort: 'Berlin' }).value!;
      const einsatz = createTestEinsatz({ einsatzort: address });

      // When: Accessing einsatzort
      const einsatzort = einsatz.einsatzort;

      // Then: Is Address instance
      expect(einsatzort).toBeInstanceOf(Address);
      expect(einsatzort).toBe(address);
    });
  });

  describe('AggregateRoot Integration', () => {
    it('should inherit from AggregateRoot', () => {
      // Given: Einsatz
      const einsatz = createTestEinsatz();

      // When: Checking inheritance
      // Then: Has AggregateRoot methods
      expect(typeof einsatz.getDomainEvents).toBe('function');
      expect(typeof einsatz.clearDomainEvents).toBe('function');
      expect(typeof einsatz.equals).toBe('function');
    });

    it('should have createdAt timestamp from AggregateRoot', () => {
      // Given: Einsatz
      const before = new Date();
      const einsatz = createTestEinsatz();
      const after = new Date();

      // When: Accessing createdAt
      const createdAt = einsatz.createdAt;

      // Then: Timestamp set
      expect(createdAt).toBeInstanceOf(Date);
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should have updatedAt timestamp from AggregateRoot', () => {
      // Given: Einsatz
      const einsatz = createTestEinsatz();

      // When: Accessing updatedAt
      const updatedAt = einsatz.updatedAt;

      // Then: Timestamp set
      expect(updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Business Rule Validation', () => {
    it('should enforce alarmstichwort required rule', () => {
      // Given: Missing alarmstichwort
      const props = {
        alarmstichwort: '',
        createdBy: UserId.create().value!,
      };

      // When: Creating Einsatz
      const result = Einsatz.create(props);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Alarmstichwort ist erforderlich');
    });

    it('should enforce forward-only state transitions', () => {
      // Given: Einsatz in ABGESCHLOSSEN
      const einsatz = createTestEinsatz();
      einsatz.complete(UserId.create().value!);

      // When: Attempting backward transition
      const result = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Ungültige Status-Transition');
    });

    it('should enforce archival immutability', () => {
      // Given: Archived Einsatz
      const einsatz = createTestEinsatz();
      einsatz.archive(UserId.create().value!);

      // When: Attempting mutation
      const result = einsatz.updateStatus(EinsatzStatus.ANGELEGT());

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Archivierte Einsätze können nicht geändert werden');
    });

    it('should enforce NO-DELETE policy', () => {
      // Given: Any Einsatz
      const einsatz = createTestEinsatz();

      // When: Checking deletion
      const canDelete = einsatz.canBeDeleted();

      // Then: Always false
      expect(canDelete).toBe(false);
    });
  });
});
