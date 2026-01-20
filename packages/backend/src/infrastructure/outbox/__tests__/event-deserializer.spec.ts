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

// Value Objects (für Test IDs)
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EtbId } from '@domain/value-objects/etb-id';
import { EintragId } from '@domain/value-objects/eintrag-id';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { PoiId } from '@domain/value-objects/poi-id';
import { UserId } from '@domain/value-objects/user-id';

describe('EventDeserializer', () => {
  let deserializer: EventDeserializer;
  let mockLogger: jest.Mocked<ILogger>;

  // Test IDs (Nanoid format)
  let einsatzIdValue: string;
  let userIdValue: string;
  let userId2Value: string;
  let etbIdValue: string;
  let eintragIdValue: string;
  let lagekarteIdValue: string;
  let poiIdValue: string;

  beforeAll(() => {
    // Create valid Nanoid IDs
    einsatzIdValue = EinsatzId.create().value!.value;
    userIdValue = UserId.create().value!.value;
    userId2Value = UserId.create().value!.value;
    etbIdValue = EtbId.create().value!.value;
    eintragIdValue = EintragId.create().value!.value;
    lagekarteIdValue = LagekarteId.create().value!.value;
    poiIdValue = PoiId.create().value!.value;
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
          nummer: 'E2024-abc12345',
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
      expect(event.nummer).toBe('E2024-abc12345');
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
        nummer: 'E2024-test',
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
        nummer: 'E2024-test',
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

    it('should return all 40 supported event types', () => {
      const supportedTypes = deserializer.getSupportedEventTypes();

      // 40 Event-Typen: Basis-Events + Erinnerung-Events (Story 1.x)
      expect(supportedTypes).toHaveLength(40);
      expect(supportedTypes).toContain('einsatz.created');
      expect(supportedTypes).toContain('etb.created');
      expect(supportedTypes).toContain('lagekarte.created');
      expect(supportedTypes).toContain('user.created');
      expect(supportedTypes).toContain('einsatz_person.hinzugefuegt');
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
        // ETB Events (5)
        'etb.created',
        'etb.eintrag_added',
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
});
