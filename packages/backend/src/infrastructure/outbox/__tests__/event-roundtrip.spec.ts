/**
 * Round-Trip Tests für Event Serializer & Deserializer.
 *
 * Diese Tests validieren dass Events nach Serialisierung → Deserialisierung
 * ihre ursprünglichen Daten vollständig behalten (AC 3.6).
 *
 * Round-Trip ist kritisch für:
 * - Transactional Outbox Pattern (Events müssen exakt rekonstruierbar sein)
 * - Event Replay (Event Sourcing)
 * - DRK Compliance (Audit Trail, Nachvollziehbarkeit)
 *
 * Epic 4 Story 4.4 | AC 3.6
 */

import { EventSerializer } from '../event-serializer';
import { EventDeserializer } from '../event-deserializer';

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

describe('Event Round-Trip (Serialize → Deserialize)', () => {
  let serializer: EventSerializer;
  let deserializer: EventDeserializer;

  // Test Value Objects
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
  let einsatzStatusAktiv: EinsatzStatus;
  let einsatzStatusAbgeschlossen: EinsatzStatus;

  beforeAll(() => {
    // Create Value Objects once
    einsatzId = EinsatzId.create().value!;
    userId = UserId.create().value!;
    userId2 = UserId.create().value!;
    etbId = EtbId.create().value!;
    eintragId = EintragId.create().value!;
    lagekarteId = LagekarteId.create().value!;
    poiId = PoiId.create().value!;
    // Use valid German MGRS: Zone(33) + LatBand(U) + SquareId(UU) + 10-digit coords
    mgrsCoordinate = MgrsCoordinate.fromString('33UUU1234567890').value!;
    mgrsCoordinate2 = MgrsCoordinate.fromString('33UUU9876543210').value!;
    poiCategory = PoiCategory.create('EINSATZSTELLE').value!;
    userRole = UserRole.create('USER').value!;
    userRole2 = UserRole.create('ADMIN').value!;
    username = Username.create('testuser').value!;
    // Permission format is resource:action (with colon, not dot)
    permission = Permission.create('einsatz:read').value!;
    // Use valid EinsatzStatus values: ANGELEGT, IN_BEARBEITUNG, ABGESCHLOSSEN, ARCHIVIERT
    einsatzStatusAktiv = EinsatzStatus.create('ANGELEGT').value!;
    einsatzStatusAbgeschlossen = EinsatzStatus.create('ABGESCHLOSSEN').value!;
  });

  beforeEach(() => {
    serializer = new EventSerializer();
    deserializer = new EventDeserializer();
  });

  // ===== EINSATZ EVENTS ROUND-TRIP =====

  describe('Einsatz Events Round-Trip', () => {
    it('EinsatzCreatedEvent should survive round-trip', () => {
      const original = new EinsatzCreatedEvent(einsatzId, userId, 'Wohnungsbrand', 'E2024-abc12345', 'agg-123');

      const serialized = serializer.serialize(original);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as EinsatzCreatedEvent;

      expect(restored.einsatzId.value).toBe(original.einsatzId.value);
      expect(restored.createdBy.value).toBe(original.createdBy.value);
      expect(restored.alarmstichwort).toBe(original.alarmstichwort);
      expect(restored.nummer).toBe(original.nummer);
    });

    it('EinsatzUpdatedEvent should survive round-trip', () => {
      const updates = { alarmstichwort: 'Kellerbrand', einsatzort: 'Musterstraße 1', bemerkung: 'Test' };
      const original = new EinsatzUpdatedEvent(einsatzId, updates, 'agg-456');

      const serialized = serializer.serialize(original);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as EinsatzUpdatedEvent;

      expect(restored.einsatzId.value).toBe(original.einsatzId.value);
      expect(restored.updates).toEqual(original.updates);
    });

    it('EinsatzStatusChangedEvent should survive round-trip', () => {
      const original = new EinsatzStatusChangedEvent(einsatzId, einsatzStatusAktiv, einsatzStatusAbgeschlossen, 'agg-789');

      const serialized = serializer.serialize(original);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as EinsatzStatusChangedEvent;

      expect(restored.einsatzId.value).toBe(original.einsatzId.value);
      expect(restored.oldStatus.value).toBe(original.oldStatus.value);
      expect(restored.newStatus.value).toBe(original.newStatus.value);
    });

    it('EinsatzCompletedEvent should survive round-trip', () => {
      const completedAt = new Date('2024-11-26T14:30:00.000Z');
      const original = new EinsatzCompletedEvent(einsatzId, userId, completedAt, 'agg-completed');

      const serialized = serializer.serialize(original);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as EinsatzCompletedEvent;

      expect(restored.einsatzId.value).toBe(original.einsatzId.value);
      expect(restored.completedBy.value).toBe(original.completedBy.value);
      expect(restored.completedAt.toISOString()).toBe(original.completedAt.toISOString());
    });

    it('EinsatzArchivedEvent should survive round-trip', () => {
      const original = new EinsatzArchivedEvent(einsatzId, userId, 'agg-archived');

      const serialized = serializer.serialize(original);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as EinsatzArchivedEvent;

      expect(restored.einsatzId.value).toBe(original.einsatzId.value);
      expect(restored.archivedBy.value).toBe(original.archivedBy.value);
    });
  });

  // ===== ETB EVENTS ROUND-TRIP =====

  describe('ETB Events Round-Trip', () => {
    it('EtbCreatedEvent should survive round-trip', () => {
      const original = new EtbCreatedEvent(etbId, einsatzId);

      const serialized = serializer.serialize(original);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as EtbCreatedEvent;

      expect(restored.etbId.value).toBe(original.etbId.value);
      expect(restored.einsatzId.value).toBe(original.einsatzId.value);
    });

    it('EintragAddedEvent should survive round-trip', () => {
      const original = new EintragAddedEvent(etbId, eintragId, 5, 'Einsatzleiter vor Ort', userId);

      const serialized = serializer.serialize(original);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as EintragAddedEvent;

      expect(restored.etbId.value).toBe(original.etbId.value);
      expect(restored.eintragId.value).toBe(original.eintragId.value);
      expect(restored.sequenceNumber).toBe(original.sequenceNumber);
      expect(restored.text).toBe(original.text);
      expect(restored.createdBy.value).toBe(original.createdBy.value);
    });

    it('EintragUpdatedEvent should survive round-trip', () => {
      const original = new EintragUpdatedEvent(etbId, eintragId, 'Alter Text', 'Neuer Text', userId);

      const serialized = serializer.serialize(original);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as EintragUpdatedEvent;

      expect(restored.etbId.value).toBe(original.etbId.value);
      expect(restored.eintragId.value).toBe(original.eintragId.value);
      expect(restored.oldText).toBe(original.oldText);
      expect(restored.newText).toBe(original.newText);
      expect(restored.updatedBy.value).toBe(original.updatedBy.value);
    });

    it('EintragDeletedEvent should survive round-trip', () => {
      const original = new EintragDeletedEvent(etbId, eintragId, userId);

      const serialized = serializer.serialize(original);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as EintragDeletedEvent;

      expect(restored.etbId.value).toBe(original.etbId.value);
      expect(restored.eintragId.value).toBe(original.eintragId.value);
      expect(restored.deletedBy.value).toBe(original.deletedBy.value);
    });

    it('EtbLockedEvent should survive round-trip', () => {
      const lockedAt = new Date('2024-11-26T16:00:00.000Z');
      const original = new EtbLockedEvent(etbId, userId, lockedAt);

      const serialized = serializer.serialize(original);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as EtbLockedEvent;

      expect(restored.etbId.value).toBe(original.etbId.value);
      expect(restored.lockedBy.value).toBe(original.lockedBy.value);
      expect(restored.lockedAt.toISOString()).toBe(original.lockedAt.toISOString());
    });
  });

  // ===== LAGEKARTE EVENTS ROUND-TRIP =====

  describe('Lagekarte Events Round-Trip', () => {
    it('LagekarteCreatedEvent should survive round-trip', () => {
      const original = new LagekarteCreatedEvent(lagekarteId, einsatzId, userId, true);

      const serialized = serializer.serialize(original);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as LagekarteCreatedEvent;

      expect(restored.lagekarteId.value).toBe(original.lagekarteId.value);
      expect(restored.einsatzId.value).toBe(original.einsatzId.value);
      expect(restored.createdBy.value).toBe(original.createdBy.value);
      expect(restored.hasInitialPoi).toBe(original.hasInitialPoi);
    });

    it('PoiAddedEvent should survive round-trip', () => {
      const original = new PoiAddedEvent(lagekarteId, poiId, 'Einsatzleitwagen', mgrsCoordinate, poiCategory, userId);

      const serialized = serializer.serialize(original);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as PoiAddedEvent;

      expect(restored.lagekarteId.value).toBe(original.lagekarteId.value);
      expect(restored.poiId.value).toBe(original.poiId.value);
      expect(restored.name).toBe(original.name);
      expect(restored.coordinate.value).toBe(original.coordinate.value);
      expect(restored.category.value).toBe(original.category.value);
      expect(restored.createdBy.value).toBe(original.createdBy.value);
    });

    it('PoiRemovedEvent should survive round-trip', () => {
      const original = new PoiRemovedEvent(lagekarteId, poiId, userId);

      const serialized = serializer.serialize(original);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as PoiRemovedEvent;

      expect(restored.lagekarteId.value).toBe(original.lagekarteId.value);
      expect(restored.poiId.value).toBe(original.poiId.value);
      expect(restored.removedBy.value).toBe(original.removedBy.value);
    });

    it('PoiPositionUpdatedEvent should survive round-trip', () => {
      const original = new PoiPositionUpdatedEvent(lagekarteId, poiId, mgrsCoordinate, mgrsCoordinate2, userId);

      const serialized = serializer.serialize(original);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as PoiPositionUpdatedEvent;

      expect(restored.lagekarteId.value).toBe(original.lagekarteId.value);
      expect(restored.poiId.value).toBe(original.poiId.value);
      expect(restored.oldCoordinate.value).toBe(original.oldCoordinate.value);
      expect(restored.newCoordinate.value).toBe(original.newCoordinate.value);
      expect(restored.updatedBy.value).toBe(original.updatedBy.value);
    });
  });

  // ===== USER EVENTS ROUND-TRIP =====

  describe('User Events Round-Trip', () => {
    it('UserCreatedEvent should survive round-trip', () => {
      const original = new UserCreatedEvent(userId, username, userRole, 'agg-user');

      const serialized = serializer.serialize(original);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as UserCreatedEvent;

      expect(restored.userId.value).toBe(original.userId.value);
      expect(restored.username.value).toBe(original.username.value);
      expect(restored.role.value).toBe(original.role.value);
    });

    it('UserDeletedEvent should survive round-trip', () => {
      const original = new UserDeletedEvent(userId, userId2, 'agg-deleted');

      const serialized = serializer.serialize(original);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as UserDeletedEvent;

      expect(restored.userId.value).toBe(original.userId.value);
      expect(restored.deletedBy.value).toBe(original.deletedBy.value);
    });

    it('UserRoleChangedEvent should survive round-trip', () => {
      const original = new UserRoleChangedEvent(userId, userRole, userRole2, userId2, 'agg-role');

      const serialized = serializer.serialize(original);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as UserRoleChangedEvent;

      expect(restored.userId.value).toBe(original.userId.value);
      expect(restored.oldRole.value).toBe(original.oldRole.value);
      expect(restored.newRole.value).toBe(original.newRole.value);
      expect(restored.changedBy.value).toBe(original.changedBy.value);
    });

    it('PermissionGrantedEvent should survive round-trip', () => {
      const original = new PermissionGrantedEvent(userId, permission, userId2, 'agg-perm');

      const serialized = serializer.serialize(original);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as PermissionGrantedEvent;

      expect(restored.userId.value).toBe(original.userId.value);
      expect(restored.permission.value).toBe(original.permission.value);
      expect(restored.grantedBy.value).toBe(original.grantedBy.value);
    });

    it('PermissionRevokedEvent should survive round-trip', () => {
      const original = new PermissionRevokedEvent(userId, permission, userId2, 'agg-revoke');

      const serialized = serializer.serialize(original);
      const result = deserializer.deserialize(serialized);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as PermissionRevokedEvent;

      expect(restored.userId.value).toBe(original.userId.value);
      expect(restored.permission.value).toBe(original.permission.value);
      expect(restored.revokedBy.value).toBe(original.revokedBy.value);
    });
  });

  // ===== JSON PERSISTENCE SIMULATION =====

  describe('JSON Persistence Simulation', () => {
    it('should survive JSON.stringify → JSON.parse → deserialize (DB simulation)', () => {
      const original = new EinsatzCreatedEvent(einsatzId, userId, 'Wohnungsbrand', 'E2024-abc12345', 'agg-123');

      // Serialize
      const serialized = serializer.serialize(original);

      // Simulate DB storage (JSON round-trip)
      const jsonString = JSON.stringify(serialized);
      const parsedFromDb = JSON.parse(jsonString);

      // Deserialize
      const result = deserializer.deserialize(parsedFromDb);

      expect(result.isSuccess).toBe(true);
      const restored = result.value as EinsatzCreatedEvent;

      expect(restored.einsatzId.value).toBe(original.einsatzId.value);
      expect(restored.alarmstichwort).toBe(original.alarmstichwort);
    });

    it('should preserve all 19 events through JSON persistence', () => {
      const events = [
        new EinsatzCreatedEvent(einsatzId, userId, 'Test', 'E2024-001'),
        new EinsatzUpdatedEvent(einsatzId, { alarmstichwort: 'Updated' }),
        new EinsatzStatusChangedEvent(einsatzId, einsatzStatusAktiv, einsatzStatusAbgeschlossen),
        new EinsatzCompletedEvent(einsatzId, userId, new Date()),
        new EinsatzArchivedEvent(einsatzId, userId),
        new EtbCreatedEvent(etbId, einsatzId),
        new EintragAddedEvent(etbId, eintragId, 1, 'Text', userId),
        new EintragUpdatedEvent(etbId, eintragId, 'Old', 'New', userId),
        new EintragDeletedEvent(etbId, eintragId, userId),
        new EtbLockedEvent(etbId, userId, new Date()),
        new LagekarteCreatedEvent(lagekarteId, einsatzId, userId, false),
        new PoiAddedEvent(lagekarteId, poiId, 'POI', mgrsCoordinate, poiCategory, userId),
        new PoiRemovedEvent(lagekarteId, poiId, userId),
        new PoiPositionUpdatedEvent(lagekarteId, poiId, mgrsCoordinate, mgrsCoordinate2, userId),
        new UserCreatedEvent(userId, username, userRole),
        new UserDeletedEvent(userId, userId2),
        new UserRoleChangedEvent(userId, userRole, userRole2, userId2),
        new PermissionGrantedEvent(userId, permission, userId2),
        new PermissionRevokedEvent(userId, permission, userId2),
      ];

      expect(events.length).toBe(19);

      for (const original of events) {
        const serialized = serializer.serialize(original);
        const jsonString = JSON.stringify(serialized);
        const parsed = JSON.parse(jsonString);
        const result = deserializer.deserialize(parsed);

        expect(result.isSuccess).toBe(true);
      }
    });
  });
});
