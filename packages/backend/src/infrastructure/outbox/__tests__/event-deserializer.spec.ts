// @ts-nocheck
/**
 * Unit Tests für EventDeserializer (Infrastructure Layer).
 *
 * Diese Tests validieren die Deserialisierung von JSON-Payloads zurück zu Domain Events:
 * - Value Objects werden korrekt aus Primitives rekonstruiert
 * - Result<T> Pattern für Error Handling
 * - Event Registry Map funktioniert korrekt
 *
 * Epic 4 Story 4.4 | AC 3.4-3.6
 */

import { Test, type TestingModule } from '@nestjs/testing';
import { EventDeserializer } from '../event-deserializer';
import { EventSerializer } from '../event-serializer';
import type { SerializedEvent } from '../event-serializer';
import type { ILogger } from '@domain/ports/i-logger.port';
import { LOGGER } from '@infrastructure/di-tokens';

// Einsatz Events
import { EinsatzCreatedEvent } from '@domain/events/einsatz-created.event';
import { EinsatzUpdatedEvent } from '@domain/events/einsatz-updated.event';
import { EinsatzStatusChangedEvent } from '@domain/events/einsatz-status-changed.event';
import { EinsatzCompletedEvent } from '@domain/events/einsatz-completed.event';
import { EinsatzArchivedEvent } from '@domain/events/einsatz-archived.event';

// ETB Events
import { EtbCreatedEvent } from '@domain/events/etb-created.event';
import { EintragAddedEvent } from '@domain/events/eintrag-added.event';
import { EintragUpdatedEvent } from '@domain/events/eintrag-updated.event';
import { EintragDeletedEvent } from '@domain/events/eintrag-deleted.event';
import { EtbLockedEvent } from '@domain/events/etb-locked.event';

// Lagekarte Events
import { LagekarteCreatedEvent } from '@domain/events/lagekarte-created.event';
import { PoiAddedEvent } from '@domain/events/poi-added.event';
import { PoiRemovedEvent } from '@domain/events/poi-removed.event';
import { PoiPositionUpdatedEvent } from '@domain/events/poi-position-updated.event';

// User Events
import { UserCreatedEvent } from '@domain/events/user-created.event';
import { UserDeletedEvent } from '@domain/events/user-deleted.event';
import { UserRoleChangedEvent } from '@domain/events/user-role-changed.event';
import { PermissionGrantedEvent } from '@domain/events/permission-granted.event';
import { PermissionRevokedEvent } from '@domain/events/permission-revoked.event';

// Kraefte Events
import { PersonZuFahrzeugZugewiesenEvent } from '@domain/kraefte/events/person-zu-fahrzeug-zugewiesen.event';
import { PersonVonFahrzeugEntferntEvent } from '@domain/kraefte/events/person-von-fahrzeug-entfernt.event';
import { RolleBesetzt } from '@domain/kraefte/events/rolle-besetzt.event';
import { RolleFreigegeben } from '@domain/kraefte/events/rolle-freigegeben.event';

// Befehl Events
import { BefehlQuittiertEvent } from '@domain/events/befehl-quittiert.event';

// Erinnerung Events
import { ErinnerungErstelltEvent } from '@domain/events/erinnerung-erstellt.event';
import { ErinnerungAusgeloestEvent } from '@domain/events/erinnerung-ausgeloest.event';
import { ErinnerungAcknowledgedEvent } from '@domain/events/erinnerung-acknowledged.event';
import { ErinnerungSnoozedEvent } from '@domain/events/erinnerung-snoozed.event';
import { ErinnerungRetriggeredEvent } from '@domain/events/erinnerung-retriggered.event';
import { ErinnerungErledigtEvent } from '@domain/events/erinnerung-erledigt.event';
import { ErinnerungAssignedEvent } from '@domain/events/erinnerung-assigned.event';
import { ErinnerungEskaliertEvent } from '@domain/events/erinnerung-eskaliert.event';
import { ErinnerungIntensiviertEvent } from '@domain/events/erinnerung-intensiviert.event';
import { ErinnerungAktualisiertEvent } from '@domain/events/erinnerung-aktualisiert.event';
import { ErinnerungGeloeschtEvent } from '@domain/events/erinnerung-geloescht.event';

// Value Objects (für Test IDs)
import { BefehlId } from '@domain/value-objects/befehl-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { EtbId } from '@domain/value-objects/etb-id';
import { EintragId } from '@domain/value-objects/eintrag-id';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { PoiId } from '@domain/value-objects/poi-id';
import { UserId } from '@domain/value-objects/user-id';

describe('EventDeserializer', () => {
  let deserializer: EventDeserializer;
  let mockLogger: jest.Mocked<ILogger>;

  // Test IDs (Nanoid format)
  let befehlIdValue: string;
  let einsatzIdValue: string;
  let userIdValue: string;
  let userId2Value: string;
  let etbIdValue: string;
  let eintragIdValue: string;
  let erinnerungIdValue: string;
  let lagekarteIdValue: string;
  let poiIdValue: string;

  beforeAll(() => {
    // Create valid Nanoid IDs
    befehlIdValue = BefehlId.create().value?.value;
    einsatzIdValue = EinsatzId.create().value?.value;
    userIdValue = UserId.create().value?.value;
    userId2Value = UserId.create().value?.value;
    etbIdValue = EtbId.create().value?.value;
    eintragIdValue = EintragId.create().value?.value;
    erinnerungIdValue = ErinnerungId.create().value?.value;
    lagekarteIdValue = LagekarteId.create().value?.value;
    poiIdValue = PoiId.create().value?.value;
  });

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock logger
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<ILogger>;

    // Create test module with DI
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventDeserializer, { provide: LOGGER, useValue: mockLogger }],
    }).compile();

    deserializer = module.get<EventDeserializer>(EventDeserializer);
  });

  // ===== HELPER FUNCTIONS =====

  /**
   * Erstellt ein SerializedEvent mit Standard-Werten.
   */
  function createSerializedEvent(eventName: string, payload: Record<string, unknown>, aggregateId?: string): SerializedEvent {
    return {
      eventId: 'test-event-id',
      eventName,
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateId,
      payload,
    };
  }

  // ===== EINSATZ EVENTS =====

  describe('Einsatz Events', () => {
    it('should deserialize EinsatzCreatedEvent correctly', () => {
      const serialized = createSerializedEvent(
        'einsatz.created',
        {
          einsatzId: einsatzIdValue,
          createdBy: userIdValue,
          alarmstichwort: 'Wohnungsbrand',
          nummer: 'E2026-001',
        },
        'agg-123',
      );

      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as EinsatzCreatedEvent;
      expect(event).toBeInstanceOf(EinsatzCreatedEvent);
      expect(event.einsatzId.value).toBe(einsatzIdValue);
      expect(event.createdBy.value).toBe(userIdValue);
      expect(event.alarmstichwort).toBe('Wohnungsbrand');
      expect(event.nummer).toBe('E2026-001');
    });

    it('should deserialize EinsatzUpdatedEvent correctly', () => {
      const serialized = createSerializedEvent('einsatz.updated', {
        einsatzId: einsatzIdValue,
        updates: { alarmstichwort: 'Kellerbrand', bemerkung: 'Test' },
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as EinsatzUpdatedEvent;
      expect(event).toBeInstanceOf(EinsatzUpdatedEvent);
      expect(event.einsatzId.value).toBe(einsatzIdValue);
      expect(event.updates).toEqual({
        alarmstichwort: 'Kellerbrand',
        bemerkung: 'Test',
      });
    });

    it('should deserialize EinsatzStatusChangedEvent correctly', () => {
      // Use valid EinsatzStatus values: ANGELEGT, IN_BEARBEITUNG, ABGESCHLOSSEN, ARCHIVIERT
      const serialized = createSerializedEvent('einsatz.status_changed', {
        einsatzId: einsatzIdValue,
        oldStatus: 'ANGELEGT',
        newStatus: 'ABGESCHLOSSEN',
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as EinsatzStatusChangedEvent;
      expect(event).toBeInstanceOf(EinsatzStatusChangedEvent);
      expect(event.einsatzId.value).toBe(einsatzIdValue);
      expect(event.oldStatus.value).toBe('ANGELEGT');
      expect(event.newStatus.value).toBe('ABGESCHLOSSEN');
    });

    it('should deserialize EinsatzCompletedEvent correctly', () => {
      const completedAt = '2024-11-26T14:30:00.000Z';
      const serialized = createSerializedEvent('einsatz.completed', {
        einsatzId: einsatzIdValue,
        completedBy: userIdValue,
        completedAt,
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as EinsatzCompletedEvent;
      expect(event).toBeInstanceOf(EinsatzCompletedEvent);
      expect(event.completedAt.toISOString()).toBe(completedAt);
    });

    it('should deserialize EinsatzArchivedEvent correctly', () => {
      const serialized = createSerializedEvent('einsatz.archived', {
        einsatzId: einsatzIdValue,
        archivedBy: userIdValue,
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as EinsatzArchivedEvent;
      expect(event).toBeInstanceOf(EinsatzArchivedEvent);
    });
  });

  // ===== ETB EVENTS =====

  describe('ETB Events', () => {
    it('should deserialize EtbCreatedEvent correctly', () => {
      const serialized = createSerializedEvent('etb.created', {
        etbId: etbIdValue,
        einsatzId: einsatzIdValue,
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as EtbCreatedEvent;
      expect(event).toBeInstanceOf(EtbCreatedEvent);
      expect(event.etbId.value).toBe(etbIdValue);
      expect(event.einsatzId.value).toBe(einsatzIdValue);
    });

    it('should deserialize EintragAddedEvent correctly', () => {
      const serialized = createSerializedEvent('etb.eintrag_added', {
        etbId: etbIdValue,
        eintragId: eintragIdValue,
        sequenceNumber: 5,
        text: 'Einsatzleiter vor Ort',
        createdBy: userIdValue,
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as EintragAddedEvent;
      expect(event).toBeInstanceOf(EintragAddedEvent);
      expect(event.sequenceNumber).toBe(5);
      expect(event.text).toBe('Einsatzleiter vor Ort');
    });

    it('should deserialize EintragUpdatedEvent correctly', () => {
      const serialized = createSerializedEvent('etb.eintrag_updated', {
        etbId: etbIdValue,
        eintragId: eintragIdValue,
        oldText: 'Alter Text',
        newText: 'Neuer Text',
        updatedBy: userIdValue,
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as EintragUpdatedEvent;
      expect(event).toBeInstanceOf(EintragUpdatedEvent);
      expect(event.oldText).toBe('Alter Text');
      expect(event.newText).toBe('Neuer Text');
    });

    it('should deserialize EintragDeletedEvent correctly', () => {
      const serialized = createSerializedEvent('etb.eintrag_deleted', {
        etbId: etbIdValue,
        eintragId: eintragIdValue,
        deletedBy: userIdValue,
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as EintragDeletedEvent;
      expect(event).toBeInstanceOf(EintragDeletedEvent);
    });

    it('should deserialize EtbLockedEvent correctly', () => {
      const lockedAt = '2024-11-26T16:00:00.000Z';
      const serialized = createSerializedEvent('etb.locked', {
        etbId: etbIdValue,
        lockedBy: userIdValue,
        lockedAt,
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as EtbLockedEvent;
      expect(event).toBeInstanceOf(EtbLockedEvent);
      expect(event.lockedAt.toISOString()).toBe(lockedAt);
    });
  });

  // ===== LAGEKARTE EVENTS =====

  describe('Lagekarte Events', () => {
    it('should deserialize LagekarteCreatedEvent correctly', () => {
      const serialized = createSerializedEvent('lagekarte.created', {
        lagekarteId: lagekarteIdValue,
        einsatzId: einsatzIdValue,
        createdBy: userIdValue,
        hasInitialPoi: true,
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as LagekarteCreatedEvent;
      expect(event).toBeInstanceOf(LagekarteCreatedEvent);
      expect(event.hasInitialPoi).toBe(true);
    });

    it('should deserialize PoiAddedEvent correctly', () => {
      // Use valid German MGRS: Zone(33) + LatBand(U) + SquareId(UU) + 10-digit coords
      const serialized = createSerializedEvent('lagekarte.poi_added', {
        lagekarteId: lagekarteIdValue,
        poiId: poiIdValue,
        name: 'Einsatzleitwagen',
        coordinate: '33UUU1234567890',
        category: 'EINSATZSTELLE',
        createdBy: userIdValue,
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as PoiAddedEvent;
      expect(event).toBeInstanceOf(PoiAddedEvent);
      expect(event.name).toBe('Einsatzleitwagen');
      expect(event.coordinate.value).toBe('33UUU1234567890');
      expect(event.category.value).toBe('EINSATZSTELLE');
    });

    it('should deserialize PoiRemovedEvent correctly', () => {
      const serialized = createSerializedEvent('lagekarte.poi_removed', {
        lagekarteId: lagekarteIdValue,
        poiId: poiIdValue,
        removedBy: userIdValue,
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as PoiRemovedEvent;
      expect(event).toBeInstanceOf(PoiRemovedEvent);
    });

    it('should deserialize PoiPositionUpdatedEvent correctly', () => {
      // Use valid German MGRS: Zone(33) + LatBand(U) + SquareId(UU) + 10-digit coords
      const serialized = createSerializedEvent('lagekarte.poi_position_updated', {
        lagekarteId: lagekarteIdValue,
        poiId: poiIdValue,
        oldCoordinate: '33UUU1234567890',
        newCoordinate: '33UUU9876543210',
        updatedBy: userIdValue,
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as PoiPositionUpdatedEvent;
      expect(event).toBeInstanceOf(PoiPositionUpdatedEvent);
      expect(event.oldCoordinate.value).toBe('33UUU1234567890');
      expect(event.newCoordinate.value).toBe('33UUU9876543210');
    });
  });

  // ===== USER EVENTS =====

  describe('User Events', () => {
    it('should deserialize UserCreatedEvent correctly', () => {
      const serialized = createSerializedEvent(
        'user.created',
        {
          userId: userIdValue,
          username: 'testuser',
          role: 'USER',
        },
        'agg-user',
      );

      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as UserCreatedEvent;
      expect(event).toBeInstanceOf(UserCreatedEvent);
      expect(event.username.value).toBe('testuser');
      expect(event.role.value).toBe('USER');
    });

    it('should deserialize UserDeletedEvent correctly', () => {
      const serialized = createSerializedEvent('user.deleted', {
        userId: userIdValue,
        deletedBy: userId2Value,
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as UserDeletedEvent;
      expect(event).toBeInstanceOf(UserDeletedEvent);
    });

    it('should deserialize UserRoleChangedEvent correctly', () => {
      const serialized = createSerializedEvent('user.role_changed', {
        userId: userIdValue,
        oldRole: 'USER',
        newRole: 'ADMIN',
        changedBy: userId2Value,
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as UserRoleChangedEvent;
      expect(event).toBeInstanceOf(UserRoleChangedEvent);
      expect(event.oldRole.value).toBe('USER');
      expect(event.newRole.value).toBe('ADMIN');
    });

    it('should deserialize PermissionGrantedEvent correctly', () => {
      // Permission format is resource:action (with colon, not dot)
      const serialized = createSerializedEvent('user.permission_granted', {
        userId: userIdValue,
        permission: 'einsatz:read',
        grantedBy: userId2Value,
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as PermissionGrantedEvent;
      expect(event).toBeInstanceOf(PermissionGrantedEvent);
      expect(event.permission.value).toBe('einsatz:read');
    });

    it('should deserialize PermissionRevokedEvent correctly', () => {
      // Permission format is resource:action (with colon, not dot)
      const serialized = createSerializedEvent('user.permission_revoked', {
        userId: userIdValue,
        permission: 'einsatz:read',
        revokedBy: userId2Value,
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as PermissionRevokedEvent;
      expect(event).toBeInstanceOf(PermissionRevokedEvent);
    });
  });

  // ===== KRAEFTE EVENTS =====

  describe('Kraefte Events', () => {
    it('should deserialize PersonZuFahrzeugZugewiesenEvent correctly', () => {
      // Given
      const serialized = createSerializedEvent(
        'einsatz_person.zu_fahrzeug_zugewiesen',
        {
          einsatzId: einsatzIdValue,
          personId: userIdValue, // EinsatzPersonId uses same format as UserId (CUID2)
          fahrzeugId: userId2Value, // EinsatzFahrzeugId uses same format as UserId (CUID2)
          personVorname: 'Max',
          personNachname: 'Mustermann',
          fahrzeugFunkrufname: 'LF 10/1',
          zugewiesenVon: userIdValue,
        },
        userIdValue, // aggregateId = personId
      );

      // When
      const result = deserializer.deserialize(serialized);

      // Then
      expect(result.isSuccess).toBe(true);
      const event = result.value as PersonZuFahrzeugZugewiesenEvent;
      expect(event).toBeInstanceOf(PersonZuFahrzeugZugewiesenEvent);
      expect(event.einsatzId).toBe(einsatzIdValue);
      expect(event.personId).toBe(userIdValue);
      expect(event.fahrzeugId).toBe(userId2Value);
      expect(event.personVorname).toBe('Max');
      expect(event.personNachname).toBe('Mustermann');
      expect(event.fahrzeugFunkrufname).toBe('LF 10/1');
      expect(event.zugewiesenVon).toBe(userIdValue);
    });

    it('should deserialize PersonVonFahrzeugEntferntEvent correctly', () => {
      // Given
      const serialized = createSerializedEvent(
        'einsatz_person.von_fahrzeug_entfernt',
        {
          einsatzId: einsatzIdValue,
          personId: userIdValue,
          fahrzeugId: userId2Value,
          personVorname: 'Max',
          personNachname: 'Mustermann',
          fahrzeugFunkrufname: 'LF 10/1',
          entferntVon: userIdValue,
        },
        userIdValue, // aggregateId = personId
      );

      // When
      const result = deserializer.deserialize(serialized);

      // Then
      expect(result.isSuccess).toBe(true);
      const event = result.value as PersonVonFahrzeugEntferntEvent;
      expect(event).toBeInstanceOf(PersonVonFahrzeugEntferntEvent);
      expect(event.einsatzId).toBe(einsatzIdValue);
      expect(event.personId).toBe(userIdValue);
      expect(event.fahrzeugId).toBe(userId2Value);
      expect(event.personVorname).toBe('Max');
      expect(event.personNachname).toBe('Mustermann');
      expect(event.fahrzeugFunkrufname).toBe('LF 10/1');
      expect(event.entferntVon).toBe(userIdValue);
    });
  });

  // ===== KRAEFTE ROLLEN-BESETZUNG EVENTS (TD2.7) =====

  describe('Kraefte RollenBesetzung Events (TD2.7 - AC2)', () => {
    // Test CUID2 values
    const testEinsatzId = 'cm5h8k2x1000008l87v8g3c5a';
    const testEinsatzPersonId = 'cm5h8k2x1000008l87v8g3c5b';
    const testRollenDefinitionId = 'cm5h8k2x1000008l87v8g3c5c';
    const testBesetztVon = 'cm5h8k2x1000008l87v8g3c5d';
    const testFreigegebenVon = 'cm5h8k2x1000008l87v8g3c5e';

    it('should deserialize RolleBesetzt correctly', () => {
      // Given
      const serialized = createSerializedEvent(
        'rollen_besetzung.besetzt',
        {
          einsatzId: testEinsatzId,
          einsatzPersonId: testEinsatzPersonId,
          rollenDefinitionId: testRollenDefinitionId,
          rollenName: 'Leitender Notarzt (LNA)',
          personVorname: 'Max',
          personNachname: 'Mustermann',
          besetztVon: testBesetztVon,
        },
        testEinsatzPersonId, // aggregateId
      );

      // When
      const result = deserializer.deserialize(serialized);

      // Then
      expect(result.isSuccess).toBe(true);
      const event = result.value as RolleBesetzt;
      expect(event).toBeInstanceOf(RolleBesetzt);
      expect(event.einsatzId).toBe(testEinsatzId);
      expect(event.einsatzPersonId).toBe(testEinsatzPersonId);
      expect(event.rollenDefinitionId).toBe(testRollenDefinitionId);
      expect(event.rollenName).toBe('Leitender Notarzt (LNA)');
      expect(event.personVorname).toBe('Max');
      expect(event.personNachname).toBe('Mustermann');
      expect(event.besetztVon).toBe(testBesetztVon);
    });

    it('should deserialize RolleFreigegeben correctly', () => {
      // Given
      const serialized = createSerializedEvent(
        'rollen_besetzung.freigegeben',
        {
          einsatzId: testEinsatzId,
          einsatzPersonId: testEinsatzPersonId,
          rollenDefinitionId: testRollenDefinitionId,
          rollenName: 'Organisatorischer Leiter (OrgL)',
          personVorname: 'Anna',
          personNachname: 'Schmidt',
          freigegebenVon: testFreigegebenVon,
        },
        testEinsatzPersonId, // aggregateId
      );

      // When
      const result = deserializer.deserialize(serialized);

      // Then
      expect(result.isSuccess).toBe(true);
      const event = result.value as RolleFreigegeben;
      expect(event).toBeInstanceOf(RolleFreigegeben);
      expect(event.einsatzId).toBe(testEinsatzId);
      expect(event.einsatzPersonId).toBe(testEinsatzPersonId);
      expect(event.rollenDefinitionId).toBe(testRollenDefinitionId);
      expect(event.rollenName).toBe('Organisatorischer Leiter (OrgL)');
      expect(event.personVorname).toBe('Anna');
      expect(event.personNachname).toBe('Schmidt');
      expect(event.freigegebenVon).toBe(testFreigegebenVon);
    });

    it('should roundtrip RolleBesetzt: serialize -> deserialize -> equals original', () => {
      // Given - Originale Event-Instanz
      const originalEvent = new RolleBesetzt(testEinsatzId, testEinsatzPersonId, testRollenDefinitionId, 'Zugführer', 'Hans', 'Meier', testBesetztVon);

      // Serialized payload (wie es in der DB gespeichert wäre)
      const serialized = createSerializedEvent(
        'rollen_besetzung.besetzt',
        {
          einsatzId: originalEvent.einsatzId,
          einsatzPersonId: originalEvent.einsatzPersonId,
          rollenDefinitionId: originalEvent.rollenDefinitionId,
          rollenName: originalEvent.rollenName,
          personVorname: originalEvent.personVorname,
          personNachname: originalEvent.personNachname,
          besetztVon: originalEvent.besetztVon,
        },
        originalEvent.aggregateId,
      );

      // When - Deserialisieren
      const result = deserializer.deserialize(serialized);

      // Then - Alle Felder stimmen überein
      expect(result.isSuccess).toBe(true);
      const deserializedEvent = result.value as RolleBesetzt;

      expect(deserializedEvent.einsatzId).toBe(originalEvent.einsatzId);
      expect(deserializedEvent.einsatzPersonId).toBe(originalEvent.einsatzPersonId);
      expect(deserializedEvent.rollenDefinitionId).toBe(originalEvent.rollenDefinitionId);
      expect(deserializedEvent.rollenName).toBe(originalEvent.rollenName);
      expect(deserializedEvent.personVorname).toBe(originalEvent.personVorname);
      expect(deserializedEvent.personNachname).toBe(originalEvent.personNachname);
      expect(deserializedEvent.besetztVon).toBe(originalEvent.besetztVon);
    });

    it('should roundtrip RolleFreigegeben: serialize -> deserialize -> equals original', () => {
      // Given - Originale Event-Instanz
      const originalEvent = new RolleFreigegeben(testEinsatzId, testEinsatzPersonId, testRollenDefinitionId, 'Gruppenführer', 'Peter', 'Weber', testFreigegebenVon);

      // Serialized payload (wie es in der DB gespeichert wäre)
      const serialized = createSerializedEvent(
        'rollen_besetzung.freigegeben',
        {
          einsatzId: originalEvent.einsatzId,
          einsatzPersonId: originalEvent.einsatzPersonId,
          rollenDefinitionId: originalEvent.rollenDefinitionId,
          rollenName: originalEvent.rollenName,
          personVorname: originalEvent.personVorname,
          personNachname: originalEvent.personNachname,
          freigegebenVon: originalEvent.freigegebenVon,
        },
        originalEvent.aggregateId,
      );

      // When - Deserialisieren
      const result = deserializer.deserialize(serialized);

      // Then - Alle Felder stimmen überein
      expect(result.isSuccess).toBe(true);
      const deserializedEvent = result.value as RolleFreigegeben;

      expect(deserializedEvent.einsatzId).toBe(originalEvent.einsatzId);
      expect(deserializedEvent.einsatzPersonId).toBe(originalEvent.einsatzPersonId);
      expect(deserializedEvent.rollenDefinitionId).toBe(originalEvent.rollenDefinitionId);
      expect(deserializedEvent.rollenName).toBe(originalEvent.rollenName);
      expect(deserializedEvent.personVorname).toBe(originalEvent.personVorname);
      expect(deserializedEvent.personNachname).toBe(originalEvent.personNachname);
      expect(deserializedEvent.freigegebenVon).toBe(originalEvent.freigegebenVon);
    });
  });

  // ===== ERINNERUNG RETRIGGERED EVENTS (Story 2.2) =====

  describe('ErinnerungRetriggeredEvent deserialization (Story 2.2)', () => {
    it('should deserialize ErinnerungRetriggeredEvent correctly with snooze history', () => {
      // Given (Arrange)
      const retriggeredAm = '2026-01-21T10:30:00.000Z';
      const previousSnoozedAt = '2026-01-21T10:00:00.000Z';
      const serialized = createSerializedEvent(
        'erinnerung.retriggered',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          retriggeredAm,
          titel: 'Lagebesprechung',
          erstelltVon: userIdValue,
          snoozeCount: 2,
          previousSnoozedAt,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const event = result.value as ErinnerungRetriggeredEvent;
      expect(event).toBeInstanceOf(ErinnerungRetriggeredEvent);
      expect(event.erinnerungId.value).toBe(erinnerungIdValue);
      expect(event.einsatzId.value).toBe(einsatzIdValue);
      expect(event.retriggeredAm.toISOString()).toBe(retriggeredAm);
      expect(event.titel).toBe('Lagebesprechung');
      expect(event.erstelltVon.value).toBe(userIdValue);
      expect(event.snoozeCount).toBe(2);
      expect(event.previousSnoozedAt).toEqual(new Date(previousSnoozedAt));
    });

    it('should handle null previousSnoozedAt correctly (first retrigger after snooze)', () => {
      // Given (Arrange)
      const retriggeredAm = '2026-01-21T10:30:00.000Z';
      const serialized = createSerializedEvent(
        'erinnerung.retriggered',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          retriggeredAm,
          titel: 'Erster Retrigger',
          erstelltVon: userIdValue,
          snoozeCount: 1,
          previousSnoozedAt: null,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const event = result.value as ErinnerungRetriggeredEvent;
      expect(event).toBeInstanceOf(ErinnerungRetriggeredEvent);
      expect(event.snoozeCount).toBe(1);
      expect(event.previousSnoozedAt).toBeNull();
    });

    it('should fail with invalid erinnerungId', () => {
      // Given (Arrange)
      const serialized = createSerializedEvent(
        'erinnerung.retriggered',
        {
          erinnerungId: 'invalid-id-format!',
          einsatzId: einsatzIdValue,
          retriggeredAm: '2026-01-21T10:30:00.000Z',
          titel: 'Test',
          erstelltVon: userIdValue,
          snoozeCount: 1,
          previousSnoozedAt: null,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid erinnerungId');
    });

    it('should fail with invalid einsatzId', () => {
      // Given (Arrange)
      const serialized = createSerializedEvent(
        'erinnerung.retriggered',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: 'invalid-einsatz-id!',
          retriggeredAm: '2026-01-21T10:30:00.000Z',
          titel: 'Test',
          erstelltVon: userIdValue,
          snoozeCount: 1,
          previousSnoozedAt: null,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid einsatzId');
    });

    it('should fail with invalid erstelltVon userId', () => {
      // Given (Arrange)
      const serialized = createSerializedEvent(
        'erinnerung.retriggered',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          retriggeredAm: '2026-01-21T10:30:00.000Z',
          titel: 'Test',
          erstelltVon: 'invalid-user-id!',
          snoozeCount: 1,
          previousSnoozedAt: null,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid erstelltVon');
    });

    it('should roundtrip ErinnerungRetriggeredEvent: serialize -> deserialize -> equals original', () => {
      // Given - Originale Event-Instanz
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const erstelltVon = UserId.create().value!;
      const retriggeredAm = new Date('2026-01-21T10:30:00.000Z');
      const previousSnoozedAt = new Date('2026-01-21T10:00:00.000Z');

      const originalEvent = new ErinnerungRetriggeredEvent(erinnerungId, einsatzId, retriggeredAm, 'Wichtige Besprechung', erstelltVon, 3, previousSnoozedAt, erinnerungId.value);

      // Serialized payload (wie es in der DB gespeichert wäre)
      const serialized = createSerializedEvent(
        'erinnerung.retriggered',
        {
          erinnerungId: originalEvent.erinnerungId.value,
          einsatzId: originalEvent.einsatzId.value,
          retriggeredAm: originalEvent.retriggeredAm.toISOString(),
          titel: originalEvent.titel,
          erstelltVon: originalEvent.erstelltVon.value,
          snoozeCount: originalEvent.snoozeCount,
          previousSnoozedAt: originalEvent.previousSnoozedAt?.toISOString() ?? null,
        },
        originalEvent.aggregateId,
      );

      // When - Deserialisieren
      const result = deserializer.deserialize(serialized);

      // Then - Alle Felder stimmen überein
      expect(result.isSuccess).toBe(true);
      const deserializedEvent = result.value as ErinnerungRetriggeredEvent;

      expect(deserializedEvent.erinnerungId.value).toBe(originalEvent.erinnerungId.value);
      expect(deserializedEvent.einsatzId.value).toBe(originalEvent.einsatzId.value);
      expect(deserializedEvent.retriggeredAm.toISOString()).toBe(originalEvent.retriggeredAm.toISOString());
      expect(deserializedEvent.titel).toBe(originalEvent.titel);
      expect(deserializedEvent.erstelltVon.value).toBe(originalEvent.erstelltVon.value);
      expect(deserializedEvent.snoozeCount).toBe(originalEvent.snoozeCount);
      expect(deserializedEvent.previousSnoozedAt?.toISOString()).toBe(originalEvent.previousSnoozedAt?.toISOString());
      expect(deserializedEvent.aggregateId).toBe(originalEvent.aggregateId);
    });

    it('should roundtrip ErinnerungRetriggeredEvent with null previousSnoozedAt', () => {
      // Given - Event ohne previousSnoozedAt (erster Retrigger)
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const erstelltVon = UserId.create().value!;
      const retriggeredAm = new Date('2026-01-21T10:30:00.000Z');

      const originalEvent = new ErinnerungRetriggeredEvent(
        erinnerungId,
        einsatzId,
        retriggeredAm,
        'Erste Auslösung nach Snooze',
        erstelltVon,
        1,
        null, // Kein vorheriges Snooze
        erinnerungId.value,
      );

      // Serialized payload (wie es in der DB gespeichert wäre)
      const serialized = createSerializedEvent(
        'erinnerung.retriggered',
        {
          erinnerungId: originalEvent.erinnerungId.value,
          einsatzId: originalEvent.einsatzId.value,
          retriggeredAm: originalEvent.retriggeredAm.toISOString(),
          titel: originalEvent.titel,
          erstelltVon: originalEvent.erstelltVon.value,
          snoozeCount: originalEvent.snoozeCount,
          previousSnoozedAt: null,
        },
        originalEvent.aggregateId,
      );

      // When - Deserialisieren
      const result = deserializer.deserialize(serialized);

      // Then - Alle Felder stimmen überein, previousSnoozedAt ist null
      expect(result.isSuccess).toBe(true);
      const deserializedEvent = result.value as ErinnerungRetriggeredEvent;

      expect(deserializedEvent.snoozeCount).toBe(1);
      expect(deserializedEvent.previousSnoozedAt).toBeNull();
    });
  });

  // ===== ERINNERUNG ERSTELLT EVENT =====

  describe('ErinnerungErstelltEvent deserialization', () => {
    it('should deserialize ErinnerungErstelltEvent correctly', () => {
      // Given (Arrange)
      const faelligAm = '2026-01-21T15:00:00.000Z';
      const serialized = createSerializedEvent(
        'erinnerung.erstellt',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          titel: 'Lagebesprechung',
          faelligAm,
          erstelltVon: userIdValue,
          assignedToId: null,
          eskalationsPersonId: null,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const event = result.value as ErinnerungErstelltEvent;
      expect(event).toBeInstanceOf(ErinnerungErstelltEvent);
      expect(event.erinnerungId.value).toBe(erinnerungIdValue);
      expect(event.einsatzId.value).toBe(einsatzIdValue);
      expect(event.titel).toBe('Lagebesprechung');
      expect(event.faelligAm.toISOString()).toBe(faelligAm);
      expect(event.erstelltVon.value).toBe(userIdValue);
      expect(event.assignedToId).toBeNull();
      expect(event.eskalationsPersonId).toBeNull();
    });

    it('should deserialize ErinnerungErstelltEvent with assignedToId and eskalationsPersonId', () => {
      // Given (Arrange)
      const faelligAm = '2026-01-21T15:00:00.000Z';
      const serialized = createSerializedEvent(
        'erinnerung.erstellt',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          titel: 'Zugewiesene Erinnerung',
          faelligAm,
          erstelltVon: userIdValue,
          assignedToId: userId2Value,
          eskalationsPersonId: userId2Value,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const event = result.value as ErinnerungErstelltEvent;
      expect(event).toBeInstanceOf(ErinnerungErstelltEvent);
      expect(event.assignedToId?.value).toBe(userId2Value);
      expect(event.eskalationsPersonId?.value).toBe(userId2Value);
    });

    it('should fail with invalid erinnerungId', () => {
      // Given (Arrange)
      const serialized = createSerializedEvent(
        'erinnerung.erstellt',
        {
          erinnerungId: 'invalid-id-format!',
          einsatzId: einsatzIdValue,
          titel: 'Test',
          faelligAm: '2026-01-21T15:00:00.000Z',
          erstelltVon: userIdValue,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid erinnerungId');
    });

    it('should roundtrip ErinnerungErstelltEvent: serialize -> deserialize -> equals original', () => {
      // Given - Originale Event-Instanz
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const erstelltVon = UserId.create().value!;
      const faelligAm = new Date('2026-01-21T15:00:00.000Z');

      const originalEvent = new ErinnerungErstelltEvent(erinnerungId, einsatzId, 'Wichtige Besprechung', faelligAm, erstelltVon, null, null, erinnerungId.value);

      // Serialized payload (wie es in der DB gespeichert wäre)
      const serialized = createSerializedEvent(
        'erinnerung.erstellt',
        {
          erinnerungId: originalEvent.erinnerungId.value,
          einsatzId: originalEvent.einsatzId.value,
          titel: originalEvent.titel,
          faelligAm: originalEvent.faelligAm.toISOString(),
          erstelltVon: originalEvent.erstelltVon.value,
          assignedToId: originalEvent.assignedToId?.value ?? null,
          eskalationsPersonId: originalEvent.eskalationsPersonId?.value ?? null,
        },
        originalEvent.aggregateId,
      );

      // When - Deserialisieren
      const result = deserializer.deserialize(serialized);

      // Then - Alle Felder stimmen überein
      expect(result.isSuccess).toBe(true);
      const deserializedEvent = result.value as ErinnerungErstelltEvent;

      expect(deserializedEvent.erinnerungId.value).toBe(originalEvent.erinnerungId.value);
      expect(deserializedEvent.einsatzId.value).toBe(originalEvent.einsatzId.value);
      expect(deserializedEvent.titel).toBe(originalEvent.titel);
      expect(deserializedEvent.faelligAm.toISOString()).toBe(originalEvent.faelligAm.toISOString());
      expect(deserializedEvent.erstelltVon.value).toBe(originalEvent.erstelltVon.value);
      expect(deserializedEvent.aggregateId).toBe(originalEvent.aggregateId);
    });
  });

  // ===== ERINNERUNG AUSGELOEST EVENT =====

  describe('ErinnerungAusgeloestEvent deserialization', () => {
    it('should deserialize ErinnerungAusgeloestEvent correctly', () => {
      // Given (Arrange)
      const ausgeloestAm = '2026-01-21T15:00:00.000Z';
      const serialized = createSerializedEvent(
        'erinnerung.ausgeloest',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          ausgeloestAm,
          titel: 'Lagebesprechung',
          erstelltVon: userIdValue,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const event = result.value as ErinnerungAusgeloestEvent;
      expect(event).toBeInstanceOf(ErinnerungAusgeloestEvent);
      expect(event.erinnerungId.value).toBe(erinnerungIdValue);
      expect(event.einsatzId.value).toBe(einsatzIdValue);
      expect(event.ausgeloestAm.toISOString()).toBe(ausgeloestAm);
      expect(event.titel).toBe('Lagebesprechung');
      expect(event.erstelltVon.value).toBe(userIdValue);
    });

    it('should fail with invalid erinnerungId', () => {
      // Given (Arrange)
      const serialized = createSerializedEvent(
        'erinnerung.ausgeloest',
        {
          erinnerungId: 'invalid-id-format!',
          einsatzId: einsatzIdValue,
          ausgeloestAm: '2026-01-21T15:00:00.000Z',
          titel: 'Test',
          erstelltVon: userIdValue,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid erinnerungId');
    });

    it('should roundtrip ErinnerungAusgeloestEvent: serialize -> deserialize -> equals original', () => {
      // Given - Originale Event-Instanz
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const erstelltVon = UserId.create().value!;
      const ausgeloestAm = new Date('2026-01-21T15:00:00.000Z');

      const originalEvent = new ErinnerungAusgeloestEvent(erinnerungId, einsatzId, ausgeloestAm, 'Timer abgelaufen', erstelltVon, erinnerungId.value);

      // Serialized payload
      const serialized = createSerializedEvent(
        'erinnerung.ausgeloest',
        {
          erinnerungId: originalEvent.erinnerungId.value,
          einsatzId: originalEvent.einsatzId.value,
          ausgeloestAm: originalEvent.ausgeloestAm.toISOString(),
          titel: originalEvent.titel,
          erstelltVon: originalEvent.erstelltVon.value,
        },
        originalEvent.aggregateId,
      );

      // When - Deserialisieren
      const result = deserializer.deserialize(serialized);

      // Then - Alle Felder stimmen überein
      expect(result.isSuccess).toBe(true);
      const deserializedEvent = result.value as ErinnerungAusgeloestEvent;

      expect(deserializedEvent.erinnerungId.value).toBe(originalEvent.erinnerungId.value);
      expect(deserializedEvent.einsatzId.value).toBe(originalEvent.einsatzId.value);
      expect(deserializedEvent.ausgeloestAm.toISOString()).toBe(originalEvent.ausgeloestAm.toISOString());
      expect(deserializedEvent.titel).toBe(originalEvent.titel);
      expect(deserializedEvent.erstelltVon.value).toBe(originalEvent.erstelltVon.value);
    });
  });

  // ===== ERINNERUNG ACKNOWLEDGED EVENT =====

  describe('ErinnerungAcknowledgedEvent deserialization', () => {
    it('should deserialize ErinnerungAcknowledgedEvent correctly', () => {
      // Given (Arrange)
      const acknowledgedAm = '2026-01-21T15:05:00.000Z';
      const serialized = createSerializedEvent(
        'erinnerung.acknowledged',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          acknowledgedAm,
          acknowledgedBy: userIdValue,
          titel: 'Lagebesprechung',
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const event = result.value as ErinnerungAcknowledgedEvent;
      expect(event).toBeInstanceOf(ErinnerungAcknowledgedEvent);
      expect(event.erinnerungId.value).toBe(erinnerungIdValue);
      expect(event.einsatzId.value).toBe(einsatzIdValue);
      expect(event.acknowledgedAm.toISOString()).toBe(acknowledgedAm);
      expect(event.acknowledgedBy.value).toBe(userIdValue);
      expect(event.titel).toBe('Lagebesprechung');
    });

    it('should fail with invalid acknowledgedBy userId', () => {
      // Given (Arrange)
      const serialized = createSerializedEvent(
        'erinnerung.acknowledged',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          acknowledgedAm: '2026-01-21T15:05:00.000Z',
          acknowledgedBy: 'invalid-user-id!',
          titel: 'Test',
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid acknowledgedBy');
    });

    it('should roundtrip ErinnerungAcknowledgedEvent: serialize -> deserialize -> equals original', () => {
      // Given - Originale Event-Instanz
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const acknowledgedBy = UserId.create().value!;
      const acknowledgedAm = new Date('2026-01-21T15:05:00.000Z');

      const originalEvent = new ErinnerungAcknowledgedEvent(erinnerungId, einsatzId, acknowledgedAm, acknowledgedBy, 'Bestätigte Erinnerung', erinnerungId.value);

      // Serialized payload
      const serialized = createSerializedEvent(
        'erinnerung.acknowledged',
        {
          erinnerungId: originalEvent.erinnerungId.value,
          einsatzId: originalEvent.einsatzId.value,
          acknowledgedAm: originalEvent.acknowledgedAm.toISOString(),
          acknowledgedBy: originalEvent.acknowledgedBy.value,
          titel: originalEvent.titel,
        },
        originalEvent.aggregateId,
      );

      // When - Deserialisieren
      const result = deserializer.deserialize(serialized);

      // Then - Alle Felder stimmen überein
      expect(result.isSuccess).toBe(true);
      const deserializedEvent = result.value as ErinnerungAcknowledgedEvent;

      expect(deserializedEvent.erinnerungId.value).toBe(originalEvent.erinnerungId.value);
      expect(deserializedEvent.einsatzId.value).toBe(originalEvent.einsatzId.value);
      expect(deserializedEvent.acknowledgedAm.toISOString()).toBe(originalEvent.acknowledgedAm.toISOString());
      expect(deserializedEvent.acknowledgedBy.value).toBe(originalEvent.acknowledgedBy.value);
      expect(deserializedEvent.titel).toBe(originalEvent.titel);
    });
  });

  // ===== ERINNERUNG SNOOZED EVENT =====

  describe('ErinnerungSnoozedEvent deserialization', () => {
    it('should deserialize ErinnerungSnoozedEvent correctly', () => {
      // Given (Arrange)
      const snoozedAt = '2026-01-21T15:00:00.000Z';
      const snoozedUntil = '2026-01-21T15:05:00.000Z';
      const serialized = createSerializedEvent(
        'erinnerung.snoozed',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          snoozedAt,
          snoozedUntil,
          snoozedBy: userIdValue,
          snoozeMinutes: 5,
          snoozeCount: 1,
          titel: 'Lagebesprechung',
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const event = result.value as ErinnerungSnoozedEvent;
      expect(event).toBeInstanceOf(ErinnerungSnoozedEvent);
      expect(event.erinnerungId.value).toBe(erinnerungIdValue);
      expect(event.einsatzId.value).toBe(einsatzIdValue);
      expect(event.snoozedAt.toISOString()).toBe(snoozedAt);
      expect(event.snoozedUntil.toISOString()).toBe(snoozedUntil);
      expect(event.snoozedBy.value).toBe(userIdValue);
      expect(event.snoozeMinutes).toBe(5);
      expect(event.snoozeCount).toBe(1);
      expect(event.titel).toBe('Lagebesprechung');
    });

    it('should fail with invalid snoozedBy userId', () => {
      // Given (Arrange)
      const serialized = createSerializedEvent(
        'erinnerung.snoozed',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          snoozedAt: '2026-01-21T15:00:00.000Z',
          snoozedUntil: '2026-01-21T15:05:00.000Z',
          snoozedBy: 'invalid-user-id!',
          snoozeMinutes: 5,
          snoozeCount: 1,
          titel: 'Test',
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid snoozedBy');
    });

    it('should roundtrip ErinnerungSnoozedEvent: serialize -> deserialize -> equals original', () => {
      // Given - Originale Event-Instanz
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const snoozedBy = UserId.create().value!;
      const snoozedAt = new Date('2026-01-21T15:00:00.000Z');
      const snoozedUntil = new Date('2026-01-21T15:10:00.000Z');

      const originalEvent = new ErinnerungSnoozedEvent(erinnerungId, einsatzId, snoozedAt, snoozedUntil, snoozedBy, 10, 2, 'Verschobene Erinnerung', erinnerungId.value);

      // Serialized payload
      const serialized = createSerializedEvent(
        'erinnerung.snoozed',
        {
          erinnerungId: originalEvent.erinnerungId.value,
          einsatzId: originalEvent.einsatzId.value,
          snoozedAt: originalEvent.snoozedAt.toISOString(),
          snoozedUntil: originalEvent.snoozedUntil.toISOString(),
          snoozedBy: originalEvent.snoozedBy.value,
          snoozeMinutes: originalEvent.snoozeMinutes,
          snoozeCount: originalEvent.snoozeCount,
          titel: originalEvent.titel,
        },
        originalEvent.aggregateId,
      );

      // When - Deserialisieren
      const result = deserializer.deserialize(serialized);

      // Then - Alle Felder stimmen überein
      expect(result.isSuccess).toBe(true);
      const deserializedEvent = result.value as ErinnerungSnoozedEvent;

      expect(deserializedEvent.erinnerungId.value).toBe(originalEvent.erinnerungId.value);
      expect(deserializedEvent.einsatzId.value).toBe(originalEvent.einsatzId.value);
      expect(deserializedEvent.snoozedAt.toISOString()).toBe(originalEvent.snoozedAt.toISOString());
      expect(deserializedEvent.snoozedUntil.toISOString()).toBe(originalEvent.snoozedUntil.toISOString());
      expect(deserializedEvent.snoozedBy.value).toBe(originalEvent.snoozedBy.value);
      expect(deserializedEvent.snoozeMinutes).toBe(originalEvent.snoozeMinutes);
      expect(deserializedEvent.snoozeCount).toBe(originalEvent.snoozeCount);
      expect(deserializedEvent.titel).toBe(originalEvent.titel);
    });
  });

  // ===== ERINNERUNG ERLEDIGT EVENT =====

  describe('ErinnerungErledigtEvent deserialization', () => {
    it('should deserialize ErinnerungErledigtEvent correctly with erledigungsNotiz', () => {
      // Given (Arrange)
      const erledigtAm = '2026-01-21T16:00:00.000Z';
      const serialized = createSerializedEvent(
        'erinnerung.erledigt',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          erledigtAm,
          erledigtBy: userIdValue,
          titel: 'Lagebesprechung',
          erledigungsNotiz: 'Aufgabe erfolgreich abgeschlossen',
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const event = result.value as ErinnerungErledigtEvent;
      expect(event).toBeInstanceOf(ErinnerungErledigtEvent);
      expect(event.erinnerungId.value).toBe(erinnerungIdValue);
      expect(event.einsatzId.value).toBe(einsatzIdValue);
      expect(event.erledigtAm.toISOString()).toBe(erledigtAm);
      expect(event.erledigtBy.value).toBe(userIdValue);
      expect(event.titel).toBe('Lagebesprechung');
      expect(event.erledigungsNotiz).toBe('Aufgabe erfolgreich abgeschlossen');
    });

    it('should handle null erledigungsNotiz correctly', () => {
      // Given (Arrange)
      const erledigtAm = '2026-01-21T16:00:00.000Z';
      const serialized = createSerializedEvent(
        'erinnerung.erledigt',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          erledigtAm,
          erledigtBy: userIdValue,
          titel: 'Lagebesprechung',
          erledigungsNotiz: null,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const event = result.value as ErinnerungErledigtEvent;
      expect(event).toBeInstanceOf(ErinnerungErledigtEvent);
      expect(event.erledigungsNotiz).toBeNull();
    });

    it('should fail with invalid erledigtBy userId', () => {
      // Given (Arrange)
      const serialized = createSerializedEvent(
        'erinnerung.erledigt',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          erledigtAm: '2026-01-21T16:00:00.000Z',
          erledigtBy: 'invalid-user-id!',
          titel: 'Test',
          erledigungsNotiz: null,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid erledigtBy');
    });

    it('should roundtrip ErinnerungErledigtEvent: serialize -> deserialize -> equals original', () => {
      // Given - Originale Event-Instanz
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const erledigtBy = UserId.create().value!;
      const erledigtAm = new Date('2026-01-21T16:00:00.000Z');

      const originalEvent = new ErinnerungErledigtEvent(erinnerungId, einsatzId, erledigtAm, erledigtBy, 'Erledigte Aufgabe', 'Alles erledigt!', erinnerungId.value);

      // Serialized payload
      const serialized = createSerializedEvent(
        'erinnerung.erledigt',
        {
          erinnerungId: originalEvent.erinnerungId.value,
          einsatzId: originalEvent.einsatzId.value,
          erledigtAm: originalEvent.erledigtAm.toISOString(),
          erledigtBy: originalEvent.erledigtBy.value,
          titel: originalEvent.titel,
          erledigungsNotiz: originalEvent.erledigungsNotiz,
        },
        originalEvent.aggregateId,
      );

      // When - Deserialisieren
      const result = deserializer.deserialize(serialized);

      // Then - Alle Felder stimmen überein
      expect(result.isSuccess).toBe(true);
      const deserializedEvent = result.value as ErinnerungErledigtEvent;

      expect(deserializedEvent.erinnerungId.value).toBe(originalEvent.erinnerungId.value);
      expect(deserializedEvent.einsatzId.value).toBe(originalEvent.einsatzId.value);
      expect(deserializedEvent.erledigtAm.toISOString()).toBe(originalEvent.erledigtAm.toISOString());
      expect(deserializedEvent.erledigtBy.value).toBe(originalEvent.erledigtBy.value);
      expect(deserializedEvent.titel).toBe(originalEvent.titel);
      expect(deserializedEvent.erledigungsNotiz).toBe(originalEvent.erledigungsNotiz);
    });
  });

  // ===== ERINNERUNG ASSIGNED EVENT =====

  describe('ErinnerungAssignedEvent deserialization', () => {
    it('should deserialize ErinnerungAssignedEvent correctly', () => {
      // Given (Arrange)
      const assignedAt = '2026-01-21T14:00:00.000Z';
      const serialized = createSerializedEvent(
        'erinnerung.assigned',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          assignedToId: userId2Value,
          assignedById: userIdValue,
          titel: 'Zugewiesene Aufgabe',
          assignedAt,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const event = result.value as ErinnerungAssignedEvent;
      expect(event).toBeInstanceOf(ErinnerungAssignedEvent);
      expect(event.erinnerungId.value).toBe(erinnerungIdValue);
      expect(event.einsatzId.value).toBe(einsatzIdValue);
      expect(event.assignedToId.value).toBe(userId2Value);
      expect(event.assignedById.value).toBe(userIdValue);
      expect(event.titel).toBe('Zugewiesene Aufgabe');
      expect(event.assignedAt.toISOString()).toBe(assignedAt);
    });

    it('should fail with invalid assignedToId', () => {
      // Given (Arrange)
      const serialized = createSerializedEvent(
        'erinnerung.assigned',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          assignedToId: 'invalid-user-id!',
          assignedById: userIdValue,
          titel: 'Test',
          assignedAt: '2026-01-21T14:00:00.000Z',
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid assignedToId');
    });

    it('should fail with invalid assignedById', () => {
      // Given (Arrange)
      const serialized = createSerializedEvent(
        'erinnerung.assigned',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          assignedToId: userId2Value,
          assignedById: 'invalid-user-id!',
          titel: 'Test',
          assignedAt: '2026-01-21T14:00:00.000Z',
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid assignedById');
    });

    it('should roundtrip ErinnerungAssignedEvent: serialize -> deserialize -> equals original', () => {
      // Given - Originale Event-Instanz
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const assignedToId = UserId.create().value!;
      const assignedById = UserId.create().value!;
      const assignedAt = new Date('2026-01-21T14:00:00.000Z');

      const originalEvent = new ErinnerungAssignedEvent(erinnerungId, einsatzId, assignedToId, assignedById, 'Zugewiesene Erinnerung', assignedAt, erinnerungId.value);

      // Serialized payload
      const serialized = createSerializedEvent(
        'erinnerung.assigned',
        {
          erinnerungId: originalEvent.erinnerungId.value,
          einsatzId: originalEvent.einsatzId.value,
          assignedToId: originalEvent.assignedToId.value,
          assignedById: originalEvent.assignedById.value,
          titel: originalEvent.titel,
          assignedAt: originalEvent.assignedAt.toISOString(),
        },
        originalEvent.aggregateId,
      );

      // When - Deserialisieren
      const result = deserializer.deserialize(serialized);

      // Then - Alle Felder stimmen überein
      expect(result.isSuccess).toBe(true);
      const deserializedEvent = result.value as ErinnerungAssignedEvent;

      expect(deserializedEvent.erinnerungId.value).toBe(originalEvent.erinnerungId.value);
      expect(deserializedEvent.einsatzId.value).toBe(originalEvent.einsatzId.value);
      expect(deserializedEvent.assignedToId.value).toBe(originalEvent.assignedToId.value);
      expect(deserializedEvent.assignedById.value).toBe(originalEvent.assignedById.value);
      expect(deserializedEvent.titel).toBe(originalEvent.titel);
      expect(deserializedEvent.assignedAt.toISOString()).toBe(originalEvent.assignedAt.toISOString());
    });
  });

  // ===== ERINNERUNG ESKALIERT EVENT =====

  describe('ErinnerungEskaliertEvent deserialization', () => {
    it('should deserialize ErinnerungEskaliertEvent correctly with eskalationsPersonId', () => {
      // Given (Arrange)
      const eskaliertAm = '2026-01-21T15:30:00.000Z';
      const serialized = createSerializedEvent(
        'erinnerung.eskaliert',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          eskaliertAm,
          titel: 'Überfällige Erinnerung',
          erstelltVon: userIdValue,
          eskalationsPersonId: userId2Value,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const event = result.value as ErinnerungEskaliertEvent;
      expect(event).toBeInstanceOf(ErinnerungEskaliertEvent);
      expect(event.erinnerungId.toString()).toBe(erinnerungIdValue);
      expect(event.einsatzId.value).toBe(einsatzIdValue);
      expect(event.eskaliertAm.toISOString()).toBe(eskaliertAm);
      expect(event.titel).toBe('Überfällige Erinnerung');
      expect(event.erstelltVon.value).toBe(userIdValue);
      expect(event.eskalationsPersonId?.value).toBe(userId2Value);
    });

    it('should handle null eskalationsPersonId correctly', () => {
      // Given (Arrange)
      const eskaliertAm = '2026-01-21T15:30:00.000Z';
      const serialized = createSerializedEvent(
        'erinnerung.eskaliert',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          eskaliertAm,
          titel: 'Überfällige Erinnerung ohne Eskalationsperson',
          erstelltVon: userIdValue,
          eskalationsPersonId: null,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const event = result.value as ErinnerungEskaliertEvent;
      expect(event).toBeInstanceOf(ErinnerungEskaliertEvent);
      expect(event.eskalationsPersonId).toBeNull();
    });

    it('should fail with invalid erinnerungId', () => {
      // Given (Arrange)
      const serialized = createSerializedEvent(
        'erinnerung.eskaliert',
        {
          erinnerungId: 'invalid-id-format!',
          einsatzId: einsatzIdValue,
          eskaliertAm: '2026-01-21T15:30:00.000Z',
          titel: 'Test',
          erstelltVon: userIdValue,
          eskalationsPersonId: null,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid erinnerungId');
    });

    it('should roundtrip ErinnerungEskaliertEvent: serialize -> deserialize -> equals original', () => {
      // Given - Originale Event-Instanz
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const erstelltVon = UserId.create().value!;
      const eskalationsPersonId = UserId.create().value!;
      const eskaliertAm = new Date('2026-01-21T15:30:00.000Z');

      const originalEvent = new ErinnerungEskaliertEvent(erinnerungId, einsatzId, eskaliertAm, 'Eskalierte Aufgabe', erstelltVon, eskalationsPersonId, erinnerungId.value);

      // Serialized payload
      const serialized = createSerializedEvent(
        'erinnerung.eskaliert',
        {
          erinnerungId: originalEvent.erinnerungId.toString(),
          einsatzId: originalEvent.einsatzId.value,
          eskaliertAm: originalEvent.eskaliertAm.toISOString(),
          titel: originalEvent.titel,
          erstelltVon: originalEvent.erstelltVon.value,
          eskalationsPersonId: originalEvent.eskalationsPersonId?.value ?? null,
        },
        originalEvent.aggregateId,
      );

      // When - Deserialisieren
      const result = deserializer.deserialize(serialized);

      // Then - Alle Felder stimmen überein
      expect(result.isSuccess).toBe(true);
      const deserializedEvent = result.value as ErinnerungEskaliertEvent;

      expect(deserializedEvent.erinnerungId.toString()).toBe(originalEvent.erinnerungId.toString());
      expect(deserializedEvent.einsatzId.value).toBe(originalEvent.einsatzId.value);
      expect(deserializedEvent.eskaliertAm.toISOString()).toBe(originalEvent.eskaliertAm.toISOString());
      expect(deserializedEvent.titel).toBe(originalEvent.titel);
      expect(deserializedEvent.erstelltVon.value).toBe(originalEvent.erstelltVon.value);
      expect(deserializedEvent.eskalationsPersonId?.value).toBe(originalEvent.eskalationsPersonId?.value);
    });
  });

  // ===== ERINNERUNG INTENSIVIERT EVENT =====

  describe('ErinnerungIntensiviertEvent deserialization', () => {
    it('should deserialize ErinnerungIntensiviertEvent correctly', () => {
      // Given (Arrange)
      const intensiviertAm = '2026-01-21T15:35:00.000Z';
      const serialized = createSerializedEvent(
        'erinnerung.intensiviert',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          intensiviertAm,
          titel: 'Überfällige Erinnerung ohne Eskalationsperson',
          erstelltVon: userIdValue,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const event = result.value as ErinnerungIntensiviertEvent;
      expect(event).toBeInstanceOf(ErinnerungIntensiviertEvent);
      expect(event.erinnerungId.toString()).toBe(erinnerungIdValue);
      expect(event.einsatzId.value).toBe(einsatzIdValue);
      expect(event.intensiviertAm.toISOString()).toBe(intensiviertAm);
      expect(event.titel).toBe('Überfällige Erinnerung ohne Eskalationsperson');
      expect(event.erstelltVon.value).toBe(userIdValue);
    });

    it('should fail with invalid erinnerungId', () => {
      // Given (Arrange)
      const serialized = createSerializedEvent(
        'erinnerung.intensiviert',
        {
          erinnerungId: 'invalid-id-format!',
          einsatzId: einsatzIdValue,
          intensiviertAm: '2026-01-21T15:35:00.000Z',
          titel: 'Test',
          erstelltVon: userIdValue,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid erinnerungId');
    });

    it('should roundtrip ErinnerungIntensiviertEvent: serialize -> deserialize -> equals original', () => {
      // Given - Originale Event-Instanz
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const erstelltVon = UserId.create().value!;
      const intensiviertAm = new Date('2026-01-21T15:35:00.000Z');

      const originalEvent = new ErinnerungIntensiviertEvent(erinnerungId, einsatzId, intensiviertAm, 'Intensivierte Aufgabe', erstelltVon, erinnerungId.value);

      // Serialized payload
      const serialized = createSerializedEvent(
        'erinnerung.intensiviert',
        {
          erinnerungId: originalEvent.erinnerungId.toString(),
          einsatzId: originalEvent.einsatzId.value,
          intensiviertAm: originalEvent.intensiviertAm.toISOString(),
          titel: originalEvent.titel,
          erstelltVon: originalEvent.erstelltVon.value,
        },
        originalEvent.aggregateId,
      );

      // When - Deserialisieren
      const result = deserializer.deserialize(serialized);

      // Then - Alle Felder stimmen überein
      expect(result.isSuccess).toBe(true);
      const deserializedEvent = result.value as ErinnerungIntensiviertEvent;

      expect(deserializedEvent.erinnerungId.toString()).toBe(originalEvent.erinnerungId.toString());
      expect(deserializedEvent.einsatzId.value).toBe(originalEvent.einsatzId.value);
      expect(deserializedEvent.intensiviertAm.toISOString()).toBe(originalEvent.intensiviertAm.toISOString());
      expect(deserializedEvent.titel).toBe(originalEvent.titel);
      expect(deserializedEvent.erstelltVon.value).toBe(originalEvent.erstelltVon.value);
    });
  });

  // ===== ERINNERUNG AKTUALISIERT EVENT =====

  describe('ErinnerungAktualisiertEvent deserialization', () => {
    it('should deserialize ErinnerungAktualisiertEvent correctly with all aenderungen', () => {
      // Given (Arrange)
      const neueFaelligAm = '2026-01-22T10:00:00.000Z';
      const serialized = createSerializedEvent(
        'erinnerung.aktualisiert',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          aenderungen: {
            titel: 'Neuer Titel',
            beschreibung: 'Neue Beschreibung',
            faelligAm: neueFaelligAm,
            eskalationsPersonId: userId2Value,
          },
          aktualisierVon: userIdValue,
          titel: 'Aktueller Titel',
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const event = result.value as ErinnerungAktualisiertEvent;
      expect(event).toBeInstanceOf(ErinnerungAktualisiertEvent);
      expect(event.erinnerungId.value).toBe(erinnerungIdValue);
      expect(event.einsatzId.value).toBe(einsatzIdValue);
      expect(event.aenderungen.titel).toBe('Neuer Titel');
      expect(event.aenderungen.beschreibung).toBe('Neue Beschreibung');
      expect(event.aenderungen.faelligAm?.toISOString()).toBe(neueFaelligAm);
      expect(event.aenderungen.eskalationsPersonId?.value).toBe(userId2Value);
      expect(event.aktualisierVon.value).toBe(userIdValue);
      expect(event.titel).toBe('Aktueller Titel');
    });

    it('should handle partial aenderungen correctly', () => {
      // Given (Arrange)
      const serialized = createSerializedEvent(
        'erinnerung.aktualisiert',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          aenderungen: {
            titel: 'Nur Titel geändert',
          },
          aktualisierVon: userIdValue,
          titel: 'Aktueller Titel',
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const event = result.value as ErinnerungAktualisiertEvent;
      expect(event.aenderungen.titel).toBe('Nur Titel geändert');
      expect(event.aenderungen.beschreibung).toBeUndefined();
      expect(event.aenderungen.faelligAm).toBeUndefined();
      expect(event.aenderungen.eskalationsPersonId).toBeUndefined();
    });

    it('should handle null eskalationsPersonId in aenderungen correctly', () => {
      // Given (Arrange)
      const serialized = createSerializedEvent(
        'erinnerung.aktualisiert',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          aenderungen: {
            eskalationsPersonId: null,
          },
          aktualisierVon: userIdValue,
          titel: 'Aktueller Titel',
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const event = result.value as ErinnerungAktualisiertEvent;
      expect(event.aenderungen.eskalationsPersonId).toBeNull();
    });

    it('should fail with invalid aktualisierVon userId', () => {
      // Given (Arrange)
      const serialized = createSerializedEvent(
        'erinnerung.aktualisiert',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          aenderungen: { titel: 'Test' },
          aktualisierVon: 'invalid-user-id!',
          titel: 'Test',
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid aktualisierVon');
    });

    it('should roundtrip ErinnerungAktualisiertEvent: serialize -> deserialize -> equals original', () => {
      // Given - Originale Event-Instanz
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const aktualisierVon = UserId.create().value!;
      const eskalationsPersonId = UserId.create().value!;
      const neueFaelligAm = new Date('2026-01-22T10:00:00.000Z');

      const originalEvent = new ErinnerungAktualisiertEvent(
        erinnerungId,
        einsatzId,
        {
          titel: 'Neuer Titel',
          beschreibung: 'Neue Beschreibung',
          faelligAm: neueFaelligAm,
          eskalationsPersonId: eskalationsPersonId,
        },
        aktualisierVon,
        'Aktueller Titel',
        erinnerungId.value,
      );

      // Serialized payload
      const serialized = createSerializedEvent(
        'erinnerung.aktualisiert',
        {
          erinnerungId: originalEvent.erinnerungId.value,
          einsatzId: originalEvent.einsatzId.value,
          aenderungen: {
            titel: originalEvent.aenderungen.titel,
            beschreibung: originalEvent.aenderungen.beschreibung,
            faelligAm: originalEvent.aenderungen.faelligAm?.toISOString(),
            eskalationsPersonId: originalEvent.aenderungen.eskalationsPersonId?.value ?? null,
          },
          aktualisierVon: originalEvent.aktualisierVon.value,
          titel: originalEvent.titel,
        },
        originalEvent.aggregateId,
      );

      // When - Deserialisieren
      const result = deserializer.deserialize(serialized);

      // Then - Alle Felder stimmen überein
      expect(result.isSuccess).toBe(true);
      const deserializedEvent = result.value as ErinnerungAktualisiertEvent;

      expect(deserializedEvent.erinnerungId.value).toBe(originalEvent.erinnerungId.value);
      expect(deserializedEvent.einsatzId.value).toBe(originalEvent.einsatzId.value);
      expect(deserializedEvent.aenderungen.titel).toBe(originalEvent.aenderungen.titel);
      expect(deserializedEvent.aenderungen.beschreibung).toBe(originalEvent.aenderungen.beschreibung);
      expect(deserializedEvent.aenderungen.faelligAm?.toISOString()).toBe(originalEvent.aenderungen.faelligAm?.toISOString());
      expect(deserializedEvent.aenderungen.eskalationsPersonId?.value).toBe(originalEvent.aenderungen.eskalationsPersonId?.value);
      expect(deserializedEvent.aktualisierVon.value).toBe(originalEvent.aktualisierVon.value);
      expect(deserializedEvent.titel).toBe(originalEvent.titel);
    });
  });

  // ===== ERINNERUNG GELOESCHT EVENT =====

  describe('ErinnerungGeloeschtEvent deserialization', () => {
    it('should deserialize ErinnerungGeloeschtEvent correctly', () => {
      // Given (Arrange)
      const serialized = createSerializedEvent(
        'erinnerung.geloescht',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          titel: 'Gelöschte Erinnerung',
          geloeschtVon: userIdValue,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const event = result.value as ErinnerungGeloeschtEvent;
      expect(event).toBeInstanceOf(ErinnerungGeloeschtEvent);
      expect(event.erinnerungId.value).toBe(erinnerungIdValue);
      expect(event.einsatzId.value).toBe(einsatzIdValue);
      expect(event.titel).toBe('Gelöschte Erinnerung');
      expect(event.geloeschtVon.value).toBe(userIdValue);
    });

    it('should fail with invalid erinnerungId', () => {
      // Given (Arrange)
      const serialized = createSerializedEvent(
        'erinnerung.geloescht',
        {
          erinnerungId: 'invalid-id-format!',
          einsatzId: einsatzIdValue,
          titel: 'Test',
          geloeschtVon: userIdValue,
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid erinnerungId');
    });

    it('should fail with invalid geloeschtVon userId', () => {
      // Given (Arrange)
      const serialized = createSerializedEvent(
        'erinnerung.geloescht',
        {
          erinnerungId: erinnerungIdValue,
          einsatzId: einsatzIdValue,
          titel: 'Test',
          geloeschtVon: 'invalid-user-id!',
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid geloeschtVon');
    });

    it('should roundtrip ErinnerungGeloeschtEvent: serialize -> deserialize -> equals original', () => {
      // Given - Originale Event-Instanz
      const erinnerungId = ErinnerungId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const geloeschtVon = UserId.create().value!;

      const originalEvent = new ErinnerungGeloeschtEvent(erinnerungId, einsatzId, 'Zu löschende Erinnerung', geloeschtVon, erinnerungId.value);

      // Serialized payload
      const serialized = createSerializedEvent(
        'erinnerung.geloescht',
        {
          erinnerungId: originalEvent.erinnerungId.value,
          einsatzId: originalEvent.einsatzId.value,
          titel: originalEvent.titel,
          geloeschtVon: originalEvent.geloeschtVon.value,
        },
        originalEvent.aggregateId,
      );

      // When - Deserialisieren
      const result = deserializer.deserialize(serialized);

      // Then - Alle Felder stimmen überein
      expect(result.isSuccess).toBe(true);
      const deserializedEvent = result.value as ErinnerungGeloeschtEvent;

      expect(deserializedEvent.erinnerungId.value).toBe(originalEvent.erinnerungId.value);
      expect(deserializedEvent.einsatzId.value).toBe(originalEvent.einsatzId.value);
      expect(deserializedEvent.titel).toBe(originalEvent.titel);
      expect(deserializedEvent.geloeschtVon.value).toBe(originalEvent.geloeschtVon.value);
    });
  });

  // ===== ERROR HANDLING =====

  describe('Error Handling', () => {
    it('should return failure for unknown event type', () => {
      const serialized = createSerializedEvent('unknown.event', {});

      const result = deserializer.deserialize(serialized);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Unknown event type: unknown.event');
    });

    it('should return failure for invalid EinsatzId', () => {
      const serialized = createSerializedEvent('einsatz.created', {
        einsatzId: 'invalid-id-format!',
        createdBy: userIdValue,
        alarmstichwort: 'Test',
        nummer: 'E2026-002',
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid einsatzId');
    });

    it('should return failure for invalid UserId', () => {
      const serialized = createSerializedEvent('einsatz.created', {
        einsatzId: einsatzIdValue,
        createdBy: 'invalid-user-id!',
        alarmstichwort: 'Test',
        nummer: 'E2026-002',
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid createdBy');
    });

    it('should return failure for invalid EinsatzStatus', () => {
      // Valid EinsatzStatus values: ANGELEGT, IN_BEARBEITUNG, ABGESCHLOSSEN, ARCHIVIERT
      const serialized = createSerializedEvent('einsatz.status_changed', {
        einsatzId: einsatzIdValue,
        oldStatus: 'INVALID_STATUS',
        newStatus: 'ANGELEGT',
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid oldStatus');
    });

    it('should return failure for invalid MgrsCoordinate', () => {
      const serialized = createSerializedEvent('lagekarte.poi_added', {
        lagekarteId: lagekarteIdValue,
        poiId: poiIdValue,
        name: 'Test',
        coordinate: 'INVALID_MGRS',
        category: 'EINSATZSTELLE',
        createdBy: userIdValue,
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid coordinate');
    });

    it('should return failure for invalid PoiCategory', () => {
      // Use valid German MGRS: Zone(33) + LatBand(U) + SquareId(UU) + 10-digit coords
      const serialized = createSerializedEvent('lagekarte.poi_added', {
        lagekarteId: lagekarteIdValue,
        poiId: poiIdValue,
        name: 'Test',
        coordinate: '33UUU1234567890',
        category: 'INVALID_CATEGORY',
        createdBy: userIdValue,
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid category');
    });

    it('should return failure for invalid UserRole', () => {
      const serialized = createSerializedEvent('user.created', {
        userId: userIdValue,
        username: 'testuser',
        role: 'INVALID_ROLE',
      });

      const result = deserializer.deserialize(serialized);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid role');
    });
  });

  // ===== BEFEHL QUITTIERT EVENT (Story 2.1) =====

  describe('Befehl Quittiert Event', () => {
    it('should deserialize BefehlQuittiertEvent correctly (Happy Path)', () => {
      // Given (Arrange)
      const quittiertAm = '2026-02-18T10:00:00.000Z';
      const serialized = createSerializedEvent(
        'befehl.quittiert',
        {
          befehlId: befehlIdValue,
          einsatzId: einsatzIdValue,
          empfaengerId: userIdValue,
          quittierungArt: 'VERSTANDEN',
          nummer: 'B-001',
          quittiertAm,
        },
        'agg-befehl-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      const event = result.value as BefehlQuittiertEvent;
      expect(event).toBeInstanceOf(BefehlQuittiertEvent);
      expect(event.befehlId.value).toBe(befehlIdValue);
      expect(event.einsatzId.value).toBe(einsatzIdValue);
      expect(event.empfaengerId.value).toBe(userIdValue);
      expect(event.quittierungArt).toBe('VERSTANDEN');
      expect(event.nummer).toBe('B-001');
      expect(event.quittiertAm.toISOString()).toBe(quittiertAm);
    });

    it('should roundtrip BefehlQuittiertEvent: serialize -> deserialize -> equals original', () => {
      // Given - Originale Event-Instanz
      const befehlId = BefehlId.create().value!;
      const einsatzId = EinsatzId.create().value!;
      const empfaengerId = UserId.create().value!;
      const quittiertAm = new Date('2026-02-18T10:00:00.000Z');

      const originalEvent = new BefehlQuittiertEvent(befehlId, einsatzId, empfaengerId, 'RUECKFRAGE', 'B-002', quittiertAm, undefined, undefined, undefined, befehlId.value);

      // Serialize mit EventSerializer
      const serializer = new EventSerializer();
      const serialized = serializer.serialize(originalEvent);

      // When - Deserialisieren
      const result = deserializer.deserialize(serialized);

      // Then - Alle Felder stimmen ueberein
      expect(result.isSuccess).toBe(true);
      const deserializedEvent = result.value as BefehlQuittiertEvent;

      expect(deserializedEvent.befehlId.value).toBe(originalEvent.befehlId.value);
      expect(deserializedEvent.einsatzId.value).toBe(originalEvent.einsatzId.value);
      expect(deserializedEvent.empfaengerId.value).toBe(originalEvent.empfaengerId.value);
      expect(deserializedEvent.quittierungArt).toBe(originalEvent.quittierungArt);
      expect(deserializedEvent.nummer).toBe(originalEvent.nummer);
      expect(deserializedEvent.quittiertAm.toISOString()).toBe(originalEvent.quittiertAm.toISOString());
      expect(deserializedEvent.aggregateId).toBe(originalEvent.aggregateId);
    });

    it('should fail with invalid befehlId', () => {
      // Given (Arrange)
      const serialized = createSerializedEvent(
        'befehl.quittiert',
        {
          befehlId: 'invalid-not-a-cuid',
          einsatzId: einsatzIdValue,
          empfaengerId: userIdValue,
          quittierungArt: 'VERSTANDEN',
          nummer: 'B-001',
          quittiertAm: '2026-02-18T10:00:00.000Z',
        },
        'agg-123',
      );

      // When (Act)
      const result = deserializer.deserialize(serialized);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid befehlId');
    });
  });

  // ===== UTILITY METHODS =====

  describe('Utility Methods', () => {
    it('should return true for supported event types', () => {
      expect(deserializer.supportsEventType('einsatz.created')).toBe(true);
      expect(deserializer.supportsEventType('etb.locked')).toBe(true);
      expect(deserializer.supportsEventType('lagekarte.poi_added')).toBe(true);
      expect(deserializer.supportsEventType('user.permission_revoked')).toBe(true);
    });

    it('should return false for unsupported event types', () => {
      expect(deserializer.supportsEventType('unknown.event')).toBe(false);
      expect(deserializer.supportsEventType('')).toBe(false);
    });

    it('should return all 126 supported event types', () => {
      const supportedTypes = deserializer.getSupportedEventTypes();

      // 79 Event-Typen: Basis + Erinnerung + Erinnerungsvorlage + Notiz + Fuehrungsrhythmus
      // + Fahrzeugtyp + RollenDefinition + FunkStatusConfig + 2 Legacy-Aliases + Kategorie (Story 8.1)
      // + Befehl (Story 1.1 - 4 Events) + BefehlQuittiert (Story 2.1) + RolleGeaendert (Story 5.4)
      // + BefehlAnonymisiert + BefehlGeloescht + AufbewahrungsKonfigurationGeaendert (Story 5.5)
      // + SystemWarnung (Story 5.6) + EintragKorrigiert (Issue #554)
      // + OperativeRolleChanged + StammpersonAssigned + BeitrittsanfrageErstellt + BeitrittsanfrageEntschieden (Issue #98)
      // + InviteCodeCreated + InviteCodeUsed + InviteCodeRevoked (Issue #98)
      // + EinheitErstellt + EinheitStatusGeaendert + EinheitAufgeloest + PersonZuEinheitZugewiesen + PersonVonEinheitEntfernt + FahrzeugEinheitZugewiesen (Issue #411)
      // + GefahrenmatrixAktualisiert (Issue #414)
      // + LagekarteStateUpdated (#638)
      // + TaktischesZeichen: Erstellt, Platziert, Verschoben, Aktualisiert, Entfernt (Issue #636)
      // + Funkkanal: Erstellt, Geaendert, Archiviert, Reihenfolge_Geaendert, Zuordnung_Erstellt, Zuordnung_Entfernt + NotfallAlertRequested (Issue #407)
      // + Alarmierung: Erstellt, EmpfaengerHinzugefuegt, EmpfaengerEntfernt, ZeitpunktKorrigiert, ZeitpunktFmsGesetzt, Abgeschlossen, NachalarmierungErstellt (Issue #408)
      // + Gefahrenzone: Erstellt, GeometryGeaendert, Geloescht (Issue #627)
      // + Eigenschutz: GefaehrdungsbeurteilungErstellt (Story 2.1), GefaehrdungsbeurteilungAktualisiert (Story 2.2),
      //                SicherheitsregelAusgerufen (Story 2.6), SicherheitsregelQuittiert (Story 2.7),
      //                PsaProfilGeaendert (Story 3.1), QuittungAbgegeben (Story 3.4),
      //                LueckeGemeldet (Story 3.6), QuittungUeberfaellig (Story 3.7),
      //                KonfliktErkannt (Story 3.9), KonfliktAufgeloest (Story 3.10),
      //                SicherungspostenEingerichtet (Story 4.1), SicherungspostenAktualisiert (Story 4.1),
      //                VorfallGemeldet (Story 5.1), VorfallGeschlossen (Issue #415), VorfallExportiert (Story 5.6)
      // + Patient: Erfasst (Story 1.2), Gesichtet + SichtungAktualisiert (Story 1.3)
      expect(supportedTypes).toHaveLength(130);
      expect(supportedTypes).toContain('patient.erfasst');
      expect(supportedTypes).toContain('patient.gesichtet');
      expect(supportedTypes).toContain('patient.sichtung-aktualisiert');
      expect(supportedTypes).toContain('eigenschutz.gefaehrdungsbeurteilung_erstellt');
      expect(supportedTypes).toContain('eigenschutz.gefaehrdungsbeurteilung_aktualisiert');
      expect(supportedTypes).toContain('eigenschutz.sicherheitsregel_ausgerufen');
      expect(supportedTypes).toContain('eigenschutz.sicherheitsregel_quittiert');
      expect(supportedTypes).toContain('eigenschutz.psa_profil_geaendert');
      expect(supportedTypes).toContain('eigenschutz.quittung_abgegeben');
      expect(supportedTypes).toContain('eigenschutz.luecke_gemeldet');
      expect(supportedTypes).toContain('eigenschutz.quittung_ueberfaellig');
      expect(supportedTypes).toContain('eigenschutz.konflikt_erkannt');
      expect(supportedTypes).toContain('eigenschutz.konflikt_aufgeloest');
      expect(supportedTypes).toContain('eigenschutz.sicherungsposten_eingerichtet');
      expect(supportedTypes).toContain('eigenschutz.sicherungsposten_aktualisiert');
      expect(supportedTypes).toContain('eigenschutz.vorfall_gemeldet');
      expect(supportedTypes).toContain('eigenschutz.vorfall_geschlossen');
      expect(supportedTypes).toContain('eigenschutz.vorfall_exportiert');
      expect(supportedTypes).toContain('einsatz.created');
      expect(supportedTypes).toContain('etb.created');
      expect(supportedTypes).toContain('lagekarte.created');
      expect(supportedTypes).toContain('user.created');
      expect(supportedTypes).toContain('einsatz_person.hinzugefuegt');
      // Neue Event-Gruppen aus dieser Branch
      expect(supportedTypes).toContain('erinnerungsvorlage.erstellt');
      expect(supportedTypes).toContain('notiz.erstellt');
      expect(supportedTypes).toContain('fuehrungsrhythmus-template.erstellt');
      // Befehl Events (Story 1.1)
      expect(supportedTypes).toContain('befehl.erstellt');
      expect(supportedTypes).toContain('befehl.zugestellt');
      expect(supportedTypes).toContain('befehl.status_geaendert');
      expect(supportedTypes).toContain('befehl.kommentar_hinzugefuegt');
      expect(supportedTypes).toContain('befehl.quittiert');
      // Einsatz-Rolle Events (Story 5.4)
      expect(supportedTypes).toContain('rolle.geaendert');
      // System Monitoring (Story 5.6)
      expect(supportedTypes).toContain('system.warnung');
      // Invite Code Events (Issue #98)
      expect(supportedTypes).toContain('invite_code.created');
      expect(supportedTypes).toContain('invite_code.used');
      expect(supportedTypes).toContain('invite_code.revoked');
      // Einheiten Events (Issue #411)
      expect(supportedTypes).toContain('einsatz_einheit.erstellt');
      expect(supportedTypes).toContain('einsatz_einheit.status_geaendert');
      expect(supportedTypes).toContain('einsatz_einheit.aufgeloest');
      expect(supportedTypes).toContain('einsatz_einheit.person_zugewiesen');
      expect(supportedTypes).toContain('einsatz_einheit.person_entfernt');
      expect(supportedTypes).toContain('einsatz_fahrzeug.einheit_zugewiesen');
      // Funkkanal Events (Issue #407)
      expect(supportedTypes).toContain('funkkanal.erstellt');
      expect(supportedTypes).toContain('funkkanal.geaendert');
      expect(supportedTypes).toContain('funkkanal.archiviert');
      expect(supportedTypes).toContain('funkkanal.reihenfolge_geaendert');
      expect(supportedTypes).toContain('funkkanal.zuordnung_erstellt');
      expect(supportedTypes).toContain('funkkanal.zuordnung_entfernt');
      expect(supportedTypes).toContain('funk.notfall_alert_requested');
      // Gefahrenzone Events (Issue #627)
      expect(supportedTypes).toContain('gefahrenzone.erstellt');
      expect(supportedTypes).toContain('gefahrenzone.geometry-geaendert');
      expect(supportedTypes).toContain('gefahrenzone.geloescht');
    });
  });

  // ===== EVENT COVERAGE =====

  describe('Event Coverage', () => {
    it('should support all 28 domain events', () => {
      const expectedEvents = [
        // Einsatz Events (5)
        'einsatz.created',
        'einsatz.updated',
        'einsatz.status_changed',
        'einsatz.completed',
        'einsatz.archived',
        // ETB Events (6)
        'etb.created',
        'etb.eintrag_added',
        'etb.eintrag_korrigiert',
        'etb.eintrag_updated',
        'etb.eintrag_deleted',
        'etb.locked',
        // Lagekarte Events (4)
        'lagekarte.created',
        'lagekarte.poi_added',
        'lagekarte.poi_removed',
        'lagekarte.poi_position_updated',
        // User Events (5)
        'user.created',
        'user.deleted',
        'user.role_changed',
        'user.permission_granted',
        'user.permission_revoked',
        // EinsatzPerson Events (3)
        'einsatz_person.hinzugefuegt',
        'einsatz_person.zu_fahrzeug_zugewiesen',
        'einsatz_person.von_fahrzeug_entfernt',
        // EinsatzFahrzeug Events (2)
        'einsatz_fahrzeug.erfasst',
        'einsatz_fahrzeug.fms_status_geaendert',
        // StammPerson Events (2)
        'StammPersonCreated',
        'StammPersonUpdated',
        // StammFahrzeug Events (2)
        'StammFahrzeugCreated',
        'StammFahrzeugUpdated',
      ];

      const supportedTypes = deserializer.getSupportedEventTypes();

      for (const eventName of expectedEvents) {
        expect(supportedTypes).toContain(eventName);
      }
    });
  });

  // ===== EIGENSCHUTZ: Gefaehrdungsbeurteilung Aktualisiert (Story 2.3 AC7) =====

  describe('GefaehrdungsbeurteilungAktualisiert (Story 2.3)', () => {
    const VALID_PAYLOAD = {
      einsatzId: 'clw3h8x9y0000qwertyui00002',
      userId: 'clw3h8x9y0000qwertyui00099',
      einheitId: 'clw3h8x9y0000qwertyui00050',
      gefaehrdungsbeurteilungId: 'clw3h8x9y0000qwertyui00077',
      fromVersion: 3,
      toVersion: 4,
      changedFields: {
        added: ['clw3h8x9y0000qwertyui00201'],
        removed: [] as string[],
        updated: [{ id: 'clw3h8x9y0000qwertyui00202', fields: ['title', 'schutzmassnahmen'] }],
        unchanged: 2,
      },
    };

    it('deserialisiert einen validen Payload mit der neuen Per-Item-Shape', () => {
      const serialized = createSerializedEvent('eigenschutz.gefaehrdungsbeurteilung_aktualisiert', VALID_PAYLOAD, VALID_PAYLOAD.gefaehrdungsbeurteilungId);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const event = result.value as import('@domain/eigenschutz/events/gefaehrdungsbeurteilung-aktualisiert.event').GefaehrdungsbeurteilungAktualisiertEvent;
      expect(event.fromVersion).toBe(3);
      expect(event.toVersion).toBe(4);
      expect(event.changedFields).toEqual(VALID_PAYLOAD.changedFields);
    });

    it('rejected Payload mit toVersion === fromVersion (keine Monotonie)', () => {
      const serialized = createSerializedEvent('eigenschutz.gefaehrdungsbeurteilung_aktualisiert', { ...VALID_PAYLOAD, toVersion: VALID_PAYLOAD.fromVersion });
      const result = deserializer.deserialize(serialized);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('version progression');
    });

    it('rejected Payload mit fromVersion < 1', () => {
      const serialized = createSerializedEvent('eigenschutz.gefaehrdungsbeurteilung_aktualisiert', { ...VALID_PAYLOAD, fromVersion: 0, toVersion: 1 });
      const result = deserializer.deserialize(serialized);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('version progression');
    });

    it('rejected Payload mit nicht-Array added', () => {
      const serialized = createSerializedEvent('eigenschutz.gefaehrdungsbeurteilung_aktualisiert', {
        ...VALID_PAYLOAD,
        changedFields: { ...VALID_PAYLOAD.changedFields, added: 2 as unknown as string[] },
      });
      const result = deserializer.deserialize(serialized);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('changedFields');
    });

    it('rejected Payload mit unchanged < 0', () => {
      const serialized = createSerializedEvent('eigenschutz.gefaehrdungsbeurteilung_aktualisiert', {
        ...VALID_PAYLOAD,
        changedFields: { ...VALID_PAYLOAD.changedFields, unchanged: -1 },
      });
      const result = deserializer.deserialize(serialized);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('changedFields');
    });

    it('rejected Payload mit malformed updated-Entry (ohne fields-Array)', () => {
      const serialized = createSerializedEvent('eigenschutz.gefaehrdungsbeurteilung_aktualisiert', {
        ...VALID_PAYLOAD,
        changedFields: {
          ...VALID_PAYLOAD.changedFields,
          updated: [{ id: 'clw3h8x9y0000qwertyui00202' }] as unknown as Array<{ id: string; fields: string[] }>,
        },
      });
      const result = deserializer.deserialize(serialized);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('changedFields');
    });

    it('rejected Payload mit unbekanntem Feld-Key im updated-Entry', () => {
      const serialized = createSerializedEvent('eigenschutz.gefaehrdungsbeurteilung_aktualisiert', {
        ...VALID_PAYLOAD,
        changedFields: {
          ...VALID_PAYLOAD.changedFields,
          updated: [{ id: 'clw3h8x9y0000qwertyui00202', fields: ['risikoklasse'] }],
        },
      });
      const result = deserializer.deserialize(serialized);

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('changedFields');
    });
  });
});
