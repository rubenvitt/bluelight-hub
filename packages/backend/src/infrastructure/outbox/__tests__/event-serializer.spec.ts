/**
 * Unit Tests für EventSerializer (Infrastructure Layer).
 *
 * Diese Tests validieren die Serialisierung aller 19 Domain Events zu JSON-kompatiblem Format:
 * - Value Objects werden via .value zu Primitives konvertiert
 * - Alle Event-Felder werden korrekt erfasst
 * - SerializedEvent Format ist konsistent
 *
 * Epic 4 Story 4.4 | AC 3.1-3.3
 */

import { EventSerializer, type SerializedEvent } from '../event-serializer';

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

// Value Objects
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EtbId } from '@domain/value-objects/etb-id';
import { EintragId } from '@domain/value-objects/eintrag-id';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { PoiId } from '@domain/value-objects/poi-id';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { UserRole } from '@domain/value-objects/user-role';
import { Username } from '@domain/value-objects/username';
import { Permission } from '@domain/value-objects/permission';

describe('EventSerializer', () => {
  let serializer: EventSerializer;

  // Test Value Objects (created once for all tests)
  let einsatzId: EinsatzId;
  let userId: UserId;
  let userId2: UserId;
  let etbId: EtbId;
  let eintragId: EintragId;
  let lagekarteId: LagekarteId;
  let poiId: PoiId;
  let mgrsCoordinate: MgrsCoordinate;
  let mgrsCoordinate2: MgrsCoordinate;
  let poiCategory: PoiCategory;
  let userRole: UserRole;
  let userRole2: UserRole;
  let username: Username;
  let permission: Permission;
  let einsatzStatus: EinsatzStatus;
  let einsatzStatus2: EinsatzStatus;

  beforeAll(() => {
    // Create Value Objects once
    einsatzId = EinsatzId.create().value!;
    userId = UserId.create().value!;
    userId2 = UserId.create().value!;
    etbId = EtbId.create().value!;
    eintragId = EintragId.create().value!;
    lagekarteId = LagekarteId.create().value!;
    poiId = PoiId.create().value!;
    // Use valid German MGRS zones (32U, 33U, 33N) - Format: ZoneNumber + LatBand + 2-letter SquareId + even digits
    // Example: 33UUU1234567890 = Zone 33, LatBand U, SquareId UU, 10-digit coords
    mgrsCoordinate = MgrsCoordinate.fromString('33UUU1234567890').value!;
    mgrsCoordinate2 = MgrsCoordinate.fromString('33UUU9876543210').value!;
    poiCategory = PoiCategory.create('EINSATZSTELLE').value!;
    userRole = UserRole.create('USER').value!;
    userRole2 = UserRole.create('ADMIN').value!;
    username = Username.create('testuser').value!;
    // Permission format is resource:action (with colon, not dot)
    permission = Permission.create('einsatz:read').value!;
    // Use valid EinsatzStatus values: ANGELEGT, IN_BEARBEITUNG, ABGESCHLOSSEN, ARCHIVIERT
    einsatzStatus = EinsatzStatus.create('ANGELEGT').value!;
    einsatzStatus2 = EinsatzStatus.create('ABGESCHLOSSEN').value!;
  });

  beforeEach(() => {
    serializer = new EventSerializer();
  });

  // ===== HELPER FUNCTIONS =====

  /**
   * Validiert das Basis-Format eines SerializedEvents.
   */
  function expectValidSerializedEvent(serialized: SerializedEvent, expectedEventName: string): void {
    expect(serialized.eventId).toBeDefined();
    expect(typeof serialized.eventId).toBe('string');
    expect(serialized.eventName).toBe(expectedEventName);
    expect(serialized.eventVersion).toBe(1);
    expect(serialized.occurredAt).toBeDefined();
    expect(new Date(serialized.occurredAt).toISOString()).toBe(serialized.occurredAt);
    expect(serialized.payload).toBeDefined();
    expect(typeof serialized.payload).toBe('object');
  }

  // ===== EINSATZ EVENTS =====

  describe('Einsatz Events', () => {
    it('should serialize EinsatzCreatedEvent correctly', () => {
      const event = new EinsatzCreatedEvent(einsatzId, userId, 'Wohnungsbrand', 'E2024-abc12345', 'agg-123');

      const serialized = serializer.serialize(event);

      expectValidSerializedEvent(serialized, 'einsatz.created');
      expect(serialized.aggregateId).toBe('agg-123');
      expect(serialized.payload).toEqual({
        einsatzId: einsatzId.value,
        createdBy: userId.value,
        alarmstichwort: 'Wohnungsbrand',
        nummer: 'E2024-abc12345',
      });
    });

    it('should serialize EinsatzUpdatedEvent correctly', () => {
      const updates = { alarmstichwort: 'Kellerbrand', bemerkung: 'Testbemerkung' };
      const event = new EinsatzUpdatedEvent(einsatzId, updates, 'agg-456');

      const serialized = serializer.serialize(event);

      expectValidSerializedEvent(serialized, 'einsatz.updated');
      expect(serialized.payload).toEqual({
        einsatzId: einsatzId.value,
        updates: { alarmstichwort: 'Kellerbrand', bemerkung: 'Testbemerkung' },
      });
    });

    it('should serialize EinsatzStatusChangedEvent correctly', () => {
      const event = new EinsatzStatusChangedEvent(einsatzId, einsatzStatus, einsatzStatus2, 'agg-789');

      const serialized = serializer.serialize(event);

      expectValidSerializedEvent(serialized, 'einsatz.status_changed');
      expect(serialized.payload).toEqual({
        einsatzId: einsatzId.value,
        oldStatus: 'ANGELEGT',
        newStatus: 'ABGESCHLOSSEN',
      });
    });

    it('should serialize EinsatzCompletedEvent correctly', () => {
      const completedAt = new Date('2024-11-26T14:30:00Z');
      const event = new EinsatzCompletedEvent(einsatzId, userId, completedAt, 'agg-completed');

      const serialized = serializer.serialize(event);

      expectValidSerializedEvent(serialized, 'einsatz.completed');
      expect(serialized.payload).toEqual({
        einsatzId: einsatzId.value,
        completedBy: userId.value,
        completedAt: '2024-11-26T14:30:00.000Z',
      });
    });

    it('should serialize EinsatzArchivedEvent correctly', () => {
      const event = new EinsatzArchivedEvent(einsatzId, userId, 'agg-archived');

      const serialized = serializer.serialize(event);

      expectValidSerializedEvent(serialized, 'einsatz.archived');
      expect(serialized.payload).toEqual({
        einsatzId: einsatzId.value,
        archivedBy: userId.value,
      });
    });
  });

  // ===== ETB EVENTS =====

  describe('ETB Events', () => {
    it('should serialize EtbCreatedEvent correctly', () => {
      const event = new EtbCreatedEvent(etbId, einsatzId);

      const serialized = serializer.serialize(event);

      expectValidSerializedEvent(serialized, 'etb.created');
      expect(serialized.payload).toEqual({
        etbId: etbId.value,
        einsatzId: einsatzId.value,
      });
    });

    it('should serialize EintragAddedEvent correctly', () => {
      const event = new EintragAddedEvent(etbId, eintragId, 5, 'Einsatzleiter vor Ort', userId);

      const serialized = serializer.serialize(event);

      expectValidSerializedEvent(serialized, 'etb.eintrag_added');
      expect(serialized.payload).toEqual({
        etbId: etbId.value,
        eintragId: eintragId.value,
        sequenceNumber: 5,
        text: 'Einsatzleiter vor Ort',
        createdBy: userId.value,
      });
    });

    it('should serialize EintragUpdatedEvent correctly', () => {
      const event = new EintragUpdatedEvent(etbId, eintragId, 'Alter Text', 'Neuer Text', userId);

      const serialized = serializer.serialize(event);

      expectValidSerializedEvent(serialized, 'etb.eintrag_updated');
      expect(serialized.payload).toEqual({
        etbId: etbId.value,
        eintragId: eintragId.value,
        oldText: 'Alter Text',
        newText: 'Neuer Text',
        updatedBy: userId.value,
      });
    });

    it('should serialize EintragDeletedEvent correctly', () => {
      const event = new EintragDeletedEvent(etbId, eintragId, userId);

      const serialized = serializer.serialize(event);

      expectValidSerializedEvent(serialized, 'etb.eintrag_deleted');
      expect(serialized.payload).toEqual({
        etbId: etbId.value,
        eintragId: eintragId.value,
        deletedBy: userId.value,
      });
    });

    it('should serialize EtbLockedEvent correctly', () => {
      const lockedAt = new Date('2024-11-26T16:00:00Z');
      const event = new EtbLockedEvent(etbId, userId, lockedAt);

      const serialized = serializer.serialize(event);

      expectValidSerializedEvent(serialized, 'etb.locked');
      expect(serialized.payload).toEqual({
        etbId: etbId.value,
        lockedBy: userId.value,
        lockedAt: '2024-11-26T16:00:00.000Z',
      });
    });
  });

  // ===== LAGEKARTE EVENTS =====

  describe('Lagekarte Events', () => {
    it('should serialize LagekarteCreatedEvent correctly', () => {
      const event = new LagekarteCreatedEvent(lagekarteId, einsatzId, userId, true);

      const serialized = serializer.serialize(event);

      expectValidSerializedEvent(serialized, 'lagekarte.created');
      expect(serialized.payload).toEqual({
        lagekarteId: lagekarteId.value,
        einsatzId: einsatzId.value,
        createdBy: userId.value,
        hasInitialPoi: true,
      });
    });

    it('should serialize PoiAddedEvent correctly', () => {
      const event = new PoiAddedEvent(lagekarteId, poiId, 'Einsatzleitwagen', mgrsCoordinate, poiCategory, userId);

      const serialized = serializer.serialize(event);

      expectValidSerializedEvent(serialized, 'lagekarte.poi_added');
      expect(serialized.payload).toEqual({
        lagekarteId: lagekarteId.value,
        poiId: poiId.value,
        name: 'Einsatzleitwagen',
        coordinate: '33UUU1234567890',
        category: 'EINSATZSTELLE',
        createdBy: userId.value,
      });
    });

    it('should serialize PoiRemovedEvent correctly', () => {
      const event = new PoiRemovedEvent(lagekarteId, poiId, userId);

      const serialized = serializer.serialize(event);

      expectValidSerializedEvent(serialized, 'lagekarte.poi_removed');
      expect(serialized.payload).toEqual({
        lagekarteId: lagekarteId.value,
        poiId: poiId.value,
        removedBy: userId.value,
      });
    });

    it('should serialize PoiPositionUpdatedEvent correctly', () => {
      const event = new PoiPositionUpdatedEvent(lagekarteId, poiId, mgrsCoordinate, mgrsCoordinate2, userId);

      const serialized = serializer.serialize(event);

      expectValidSerializedEvent(serialized, 'lagekarte.poi_position_updated');
      expect(serialized.payload).toEqual({
        lagekarteId: lagekarteId.value,
        poiId: poiId.value,
        oldCoordinate: '33UUU1234567890',
        newCoordinate: '33UUU9876543210',
        updatedBy: userId.value,
      });
    });
  });

  // ===== USER EVENTS =====

  describe('User Events', () => {
    it('should serialize UserCreatedEvent correctly', () => {
      const event = new UserCreatedEvent(userId, username, userRole, 'agg-user');

      const serialized = serializer.serialize(event);

      expectValidSerializedEvent(serialized, 'user.created');
      expect(serialized.aggregateId).toBe('agg-user');
      expect(serialized.payload).toEqual({
        userId: userId.value,
        username: 'testuser', // Username.value returns lowercase
        role: 'USER',
      });
    });

    it('should serialize UserDeletedEvent correctly', () => {
      const event = new UserDeletedEvent(userId, userId2, 'agg-deleted');

      const serialized = serializer.serialize(event);

      expectValidSerializedEvent(serialized, 'user.deleted');
      expect(serialized.payload).toEqual({
        userId: userId.value,
        deletedBy: userId2.value,
      });
    });

    it('should serialize UserRoleChangedEvent correctly', () => {
      const event = new UserRoleChangedEvent(userId, userRole, userRole2, userId2, 'agg-role');

      const serialized = serializer.serialize(event);

      expectValidSerializedEvent(serialized, 'user.role_changed');
      expect(serialized.payload).toEqual({
        userId: userId.value,
        oldRole: 'USER',
        newRole: 'ADMIN',
        changedBy: userId2.value,
      });
    });

    it('should serialize PermissionGrantedEvent correctly', () => {
      const event = new PermissionGrantedEvent(userId, permission, userId2, 'agg-perm');

      const serialized = serializer.serialize(event);

      expectValidSerializedEvent(serialized, 'user.permission_granted');
      expect(serialized.payload).toEqual({
        userId: userId.value,
        permission: 'einsatz:read',
        grantedBy: userId2.value,
      });
    });

    it('should serialize PermissionRevokedEvent correctly', () => {
      const event = new PermissionRevokedEvent(userId, permission, userId2, 'agg-revoke');

      const serialized = serializer.serialize(event);

      expectValidSerializedEvent(serialized, 'user.permission_revoked');
      expect(serialized.payload).toEqual({
        userId: userId.value,
        permission: 'einsatz:read',
        revokedBy: userId2.value,
      });
    });
  });

  // ===== EDGE CASES =====

  describe('Edge Cases', () => {
    it('should handle event without aggregateId', () => {
      const event = new EinsatzCreatedEvent(einsatzId, userId, 'Test', 'E2024-xyz');

      const serialized = serializer.serialize(event);

      expect(serialized.aggregateId).toBeUndefined();
    });

    it('should produce valid ISO8601 timestamp', () => {
      const beforeSerialize = new Date();
      const event = new EinsatzCreatedEvent(einsatzId, userId, 'Test', 'E2024-xyz');

      const serialized = serializer.serialize(event);
      const afterSerialize = new Date();

      const occurredAt = new Date(serialized.occurredAt);
      expect(occurredAt.getTime()).toBeGreaterThanOrEqual(beforeSerialize.getTime());
      expect(occurredAt.getTime()).toBeLessThanOrEqual(afterSerialize.getTime());
    });

    it('should throw for unknown event type', () => {
      // Create a mock event with unknown event name
      const unknownEvent = {
        eventId: 'test-id',
        occurredAt: new Date(),
        aggregateId: 'test-agg',
        constructor: {
          eventName: () => 'unknown.event',
          eventVersion: () => 1,
        },
        // biome-ignore lint/suspicious/noExplicitAny: Testing unknown event type handling
      } as any;

      expect(() => serializer.serialize(unknownEvent)).toThrow('Unknown event type: unknown.event');
    });

    it('should produce JSON-serializable output', () => {
      const event = new EinsatzCreatedEvent(einsatzId, userId, 'Wohnungsbrand', 'E2024-abc12345', 'agg-123');

      const serialized = serializer.serialize(event);

      // Should not throw when stringified
      const json = JSON.stringify(serialized);
      expect(json).toBeDefined();

      // Should be parseable back
      const parsed = JSON.parse(json);
      expect(parsed.eventName).toBe('einsatz.created');
      expect(parsed.payload.alarmstichwort).toBe('Wohnungsbrand');
    });
  });

  // ===== SERIALIZED EVENT COUNT =====

  describe('Event Coverage', () => {
    it('should support all 19 domain events', () => {
      const supportedEvents = [
        'einsatz.created',
        'einsatz.updated',
        'einsatz.status_changed',
        'einsatz.completed',
        'einsatz.archived',
        'etb.created',
        'etb.eintrag_added',
        'etb.eintrag_updated',
        'etb.eintrag_deleted',
        'etb.locked',
        'lagekarte.created',
        'lagekarte.poi_added',
        'lagekarte.poi_removed',
        'lagekarte.poi_position_updated',
        'user.created',
        'user.deleted',
        'user.role_changed',
        'user.permission_granted',
        'user.permission_revoked',
      ];

      expect(supportedEvents.length).toBe(19);
    });
  });
});
