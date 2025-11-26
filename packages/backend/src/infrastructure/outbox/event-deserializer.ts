import { Injectable, Logger } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { DomainEvent } from '@domain/common/domain-event';

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

import type { SerializedEvent } from './event-serializer';

/**
 * Event Deserializer für Transactional Outbox Pattern.
 *
 * Rekonstruiert Domain Events aus JSON-Payloads die in der Outbox-Tabelle persistiert wurden.
 * Value Objects werden aus Primitives via Factory-Methods rekonstruiert.
 *
 * Warum Deserializer als Service?
 * - Zentrale Stelle für JSON → Value Object Konvertierung
 * - Event Registry Map ermöglicht type-safe Event Routing
 * - Result<T> Pattern für explizite Fehlerbehandlung
 * - Testbar und austauschbar (DI)
 *
 * @example
 * ```typescript
 * const deserializer = new EventDeserializer();
 * const result = deserializer.deserialize({
 *   eventId: '...',
 *   eventName: 'einsatz.created',
 *   eventVersion: 1,
 *   occurredAt: '2024-11-26T10:30:00Z',
 *   payload: { einsatzId: 'clw3...', createdBy: 'clv9...', ... }
 * });
 * if (result.isSuccess) {
 *   const domainEvent = result.value; // EinsatzCreatedEvent instance
 * }
 * ```
 */
@Injectable()
export class EventDeserializer {
  private readonly logger = new Logger(EventDeserializer.name);

  /**
   * Event Registry Map für eventName → Deserializer Function Lookup.
   *
   * Jeder Event-Typ hat eine eigene Deserialize-Funktion die:
   * - Value Objects aus Primitives rekonstruiert
   * - Result<DomainEvent> zurückgibt für Error Handling
   */
  private readonly eventRegistry: Map<string, (payload: Record<string, unknown>, aggregateId?: string) => Result<DomainEvent>>;

  constructor() {
    this.eventRegistry = new Map([
      // ===== EINSATZ EVENTS =====
      ['einsatz.created', this.deserializeEinsatzCreated.bind(this)],
      ['einsatz.updated', this.deserializeEinsatzUpdated.bind(this)],
      ['einsatz.status_changed', this.deserializeEinsatzStatusChanged.bind(this)],
      ['einsatz.completed', this.deserializeEinsatzCompleted.bind(this)],
      ['einsatz.archived', this.deserializeEinsatzArchived.bind(this)],

      // ===== ETB EVENTS =====
      ['etb.created', this.deserializeEtbCreated.bind(this)],
      ['etb.eintrag_added', this.deserializeEintragAdded.bind(this)],
      ['etb.eintrag_updated', this.deserializeEintragUpdated.bind(this)],
      ['etb.eintrag_deleted', this.deserializeEintragDeleted.bind(this)],
      ['etb.locked', this.deserializeEtbLocked.bind(this)],

      // ===== LAGEKARTE EVENTS =====
      ['lagekarte.created', this.deserializeLagekarteCreated.bind(this)],
      ['lagekarte.poi_added', this.deserializePoiAdded.bind(this)],
      ['lagekarte.poi_removed', this.deserializePoiRemoved.bind(this)],
      ['lagekarte.poi_position_updated', this.deserializePoiPositionUpdated.bind(this)],

      // ===== USER EVENTS =====
      ['user.created', this.deserializeUserCreated.bind(this)],
      ['user.deleted', this.deserializeUserDeleted.bind(this)],
      ['user.role_changed', this.deserializeUserRoleChanged.bind(this)],
      ['user.permission_granted', this.deserializePermissionGranted.bind(this)],
      ['user.permission_revoked', this.deserializePermissionRevoked.bind(this)],
    ]);
  }

  /**
   * Deserialisiert ein SerializedEvent zurück zu einem Domain Event.
   *
   * @param serialized - Das serialisierte Event aus der Outbox
   * @returns Result<DomainEvent> - Success mit rekonstruiertem Event oder Failure mit Fehlermeldung
   */
  deserialize(serialized: SerializedEvent): Result<DomainEvent> {
    const { eventName, payload, aggregateId } = serialized;

    // Lookup Deserializer Function aus Registry
    const deserializer = this.eventRegistry.get(eventName);

    if (!deserializer) {
      this.logger.error(`Unknown event type: ${eventName}. EventDeserializer needs to be updated.`);
      return Result.fail<DomainEvent>(`Unknown event type: ${eventName}`);
    }

    try {
      return deserializer(payload, aggregateId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to deserialize event ${eventName}: ${errorMessage}`, error instanceof Error ? error.stack : undefined);
      return Result.fail<DomainEvent>(`Deserialization failed for ${eventName}: ${errorMessage}`);
    }
  }

  /**
   * Prüft ob ein Event-Typ im Registry unterstützt wird.
   */
  supportsEventType(eventName: string): boolean {
    return this.eventRegistry.has(eventName);
  }

  /**
   * Gibt alle unterstützten Event-Typen zurück.
   */
  getSupportedEventTypes(): string[] {
    return Array.from(this.eventRegistry.keys());
  }

  // ===== EINSATZ DESERIALIZERS =====

  private deserializeEinsatzCreated(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
    if (einsatzIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
    }

    const createdByResult = UserId.create(payload.createdBy as string);
    if (createdByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid createdBy: ${createdByResult.error}`);
    }

    const event = new EinsatzCreatedEvent(einsatzIdResult.value!, createdByResult.value!, payload.alarmstichwort as string, payload.nummer as string, aggregateId);

    return Result.ok<DomainEvent>(event);
  }

  private deserializeEinsatzUpdated(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
    if (einsatzIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
    }

    const updates = payload.updates as { alarmstichwort?: string; einsatzort?: string; bemerkung?: string };

    const event = new EinsatzUpdatedEvent(einsatzIdResult.value!, updates, aggregateId);

    return Result.ok<DomainEvent>(event);
  }

  private deserializeEinsatzStatusChanged(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
    if (einsatzIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
    }

    const oldStatusResult = EinsatzStatus.create(payload.oldStatus as string);
    if (oldStatusResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid oldStatus: ${oldStatusResult.error}`);
    }

    const newStatusResult = EinsatzStatus.create(payload.newStatus as string);
    if (newStatusResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid newStatus: ${newStatusResult.error}`);
    }

    const event = new EinsatzStatusChangedEvent(einsatzIdResult.value!, oldStatusResult.value!, newStatusResult.value!, aggregateId);

    return Result.ok<DomainEvent>(event);
  }

  private deserializeEinsatzCompleted(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
    if (einsatzIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
    }

    const completedByResult = UserId.create(payload.completedBy as string);
    if (completedByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid completedBy: ${completedByResult.error}`);
    }

    const completedAt = new Date(payload.completedAt as string);

    const event = new EinsatzCompletedEvent(einsatzIdResult.value!, completedByResult.value!, completedAt, aggregateId);

    return Result.ok<DomainEvent>(event);
  }

  private deserializeEinsatzArchived(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
    if (einsatzIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
    }

    const archivedByResult = UserId.create(payload.archivedBy as string);
    if (archivedByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid archivedBy: ${archivedByResult.error}`);
    }

    const event = new EinsatzArchivedEvent(einsatzIdResult.value!, archivedByResult.value!, aggregateId);

    return Result.ok<DomainEvent>(event);
  }

  // ===== ETB DESERIALIZERS =====

  private deserializeEtbCreated(payload: Record<string, unknown>): Result<DomainEvent> {
    const etbIdResult = EtbId.create(payload.etbId as string);
    if (etbIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid etbId: ${etbIdResult.error}`);
    }

    const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
    if (einsatzIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
    }

    const event = new EtbCreatedEvent(etbIdResult.value!, einsatzIdResult.value!);

    return Result.ok<DomainEvent>(event);
  }

  private deserializeEintragAdded(payload: Record<string, unknown>): Result<DomainEvent> {
    const etbIdResult = EtbId.create(payload.etbId as string);
    if (etbIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid etbId: ${etbIdResult.error}`);
    }

    const eintragIdResult = EintragId.create(payload.eintragId as string);
    if (eintragIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid eintragId: ${eintragIdResult.error}`);
    }

    const createdByResult = UserId.create(payload.createdBy as string);
    if (createdByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid createdBy: ${createdByResult.error}`);
    }

    const event = new EintragAddedEvent(etbIdResult.value!, eintragIdResult.value!, payload.sequenceNumber as number, payload.text as string, createdByResult.value!);

    return Result.ok<DomainEvent>(event);
  }

  private deserializeEintragUpdated(payload: Record<string, unknown>): Result<DomainEvent> {
    const etbIdResult = EtbId.create(payload.etbId as string);
    if (etbIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid etbId: ${etbIdResult.error}`);
    }

    const eintragIdResult = EintragId.create(payload.eintragId as string);
    if (eintragIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid eintragId: ${eintragIdResult.error}`);
    }

    const updatedByResult = UserId.create(payload.updatedBy as string);
    if (updatedByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid updatedBy: ${updatedByResult.error}`);
    }

    const event = new EintragUpdatedEvent(etbIdResult.value!, eintragIdResult.value!, payload.oldText as string, payload.newText as string, updatedByResult.value!);

    return Result.ok<DomainEvent>(event);
  }

  private deserializeEintragDeleted(payload: Record<string, unknown>): Result<DomainEvent> {
    const etbIdResult = EtbId.create(payload.etbId as string);
    if (etbIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid etbId: ${etbIdResult.error}`);
    }

    const eintragIdResult = EintragId.create(payload.eintragId as string);
    if (eintragIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid eintragId: ${eintragIdResult.error}`);
    }

    const deletedByResult = UserId.create(payload.deletedBy as string);
    if (deletedByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid deletedBy: ${deletedByResult.error}`);
    }

    const event = new EintragDeletedEvent(etbIdResult.value!, eintragIdResult.value!, deletedByResult.value!);

    return Result.ok<DomainEvent>(event);
  }

  private deserializeEtbLocked(payload: Record<string, unknown>): Result<DomainEvent> {
    const etbIdResult = EtbId.create(payload.etbId as string);
    if (etbIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid etbId: ${etbIdResult.error}`);
    }

    const lockedByResult = UserId.create(payload.lockedBy as string);
    if (lockedByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid lockedBy: ${lockedByResult.error}`);
    }

    const lockedAt = new Date(payload.lockedAt as string);

    const event = new EtbLockedEvent(etbIdResult.value!, lockedByResult.value!, lockedAt);

    return Result.ok<DomainEvent>(event);
  }

  // ===== LAGEKARTE DESERIALIZERS =====

  private deserializeLagekarteCreated(payload: Record<string, unknown>): Result<DomainEvent> {
    const lagekarteIdResult = LagekarteId.create(payload.lagekarteId as string);
    if (lagekarteIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid lagekarteId: ${lagekarteIdResult.error}`);
    }

    const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
    if (einsatzIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
    }

    const createdByResult = UserId.create(payload.createdBy as string);
    if (createdByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid createdBy: ${createdByResult.error}`);
    }

    const event = new LagekarteCreatedEvent(lagekarteIdResult.value!, einsatzIdResult.value!, createdByResult.value!, payload.hasInitialPoi as boolean);

    return Result.ok<DomainEvent>(event);
  }

  private deserializePoiAdded(payload: Record<string, unknown>): Result<DomainEvent> {
    const lagekarteIdResult = LagekarteId.create(payload.lagekarteId as string);
    if (lagekarteIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid lagekarteId: ${lagekarteIdResult.error}`);
    }

    const poiIdResult = PoiId.create(payload.poiId as string);
    if (poiIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid poiId: ${poiIdResult.error}`);
    }

    const coordinateResult = MgrsCoordinate.fromString(payload.coordinate as string);
    if (coordinateResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid coordinate: ${coordinateResult.error}`);
    }

    const categoryResult = PoiCategory.create(payload.category as string);
    if (categoryResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid category: ${categoryResult.error}`);
    }

    const createdByResult = UserId.create(payload.createdBy as string);
    if (createdByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid createdBy: ${createdByResult.error}`);
    }

    const event = new PoiAddedEvent(lagekarteIdResult.value!, poiIdResult.value!, payload.name as string, coordinateResult.value!, categoryResult.value!, createdByResult.value!);

    return Result.ok<DomainEvent>(event);
  }

  private deserializePoiRemoved(payload: Record<string, unknown>): Result<DomainEvent> {
    const lagekarteIdResult = LagekarteId.create(payload.lagekarteId as string);
    if (lagekarteIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid lagekarteId: ${lagekarteIdResult.error}`);
    }

    const poiIdResult = PoiId.create(payload.poiId as string);
    if (poiIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid poiId: ${poiIdResult.error}`);
    }

    const removedByResult = UserId.create(payload.removedBy as string);
    if (removedByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid removedBy: ${removedByResult.error}`);
    }

    const event = new PoiRemovedEvent(lagekarteIdResult.value!, poiIdResult.value!, removedByResult.value!);

    return Result.ok<DomainEvent>(event);
  }

  private deserializePoiPositionUpdated(payload: Record<string, unknown>): Result<DomainEvent> {
    const lagekarteIdResult = LagekarteId.create(payload.lagekarteId as string);
    if (lagekarteIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid lagekarteId: ${lagekarteIdResult.error}`);
    }

    const poiIdResult = PoiId.create(payload.poiId as string);
    if (poiIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid poiId: ${poiIdResult.error}`);
    }

    const oldCoordinateResult = MgrsCoordinate.fromString(payload.oldCoordinate as string);
    if (oldCoordinateResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid oldCoordinate: ${oldCoordinateResult.error}`);
    }

    const newCoordinateResult = MgrsCoordinate.fromString(payload.newCoordinate as string);
    if (newCoordinateResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid newCoordinate: ${newCoordinateResult.error}`);
    }

    const updatedByResult = UserId.create(payload.updatedBy as string);
    if (updatedByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid updatedBy: ${updatedByResult.error}`);
    }

    const event = new PoiPositionUpdatedEvent(lagekarteIdResult.value!, poiIdResult.value!, oldCoordinateResult.value!, newCoordinateResult.value!, updatedByResult.value!);

    return Result.ok<DomainEvent>(event);
  }

  // ===== USER DESERIALIZERS =====

  private deserializeUserCreated(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const userIdResult = UserId.create(payload.userId as string);
    if (userIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid userId: ${userIdResult.error}`);
    }

    const usernameResult = Username.create(payload.username as string);
    if (usernameResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid username: ${usernameResult.error}`);
    }

    const roleResult = UserRole.create(payload.role as string);
    if (roleResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid role: ${roleResult.error}`);
    }

    const event = new UserCreatedEvent(userIdResult.value!, usernameResult.value!, roleResult.value!, aggregateId);

    return Result.ok<DomainEvent>(event);
  }

  private deserializeUserDeleted(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const userIdResult = UserId.create(payload.userId as string);
    if (userIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid userId: ${userIdResult.error}`);
    }

    const deletedByResult = UserId.create(payload.deletedBy as string);
    if (deletedByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid deletedBy: ${deletedByResult.error}`);
    }

    const event = new UserDeletedEvent(userIdResult.value!, deletedByResult.value!, aggregateId);

    return Result.ok<DomainEvent>(event);
  }

  private deserializeUserRoleChanged(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const userIdResult = UserId.create(payload.userId as string);
    if (userIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid userId: ${userIdResult.error}`);
    }

    const oldRoleResult = UserRole.create(payload.oldRole as string);
    if (oldRoleResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid oldRole: ${oldRoleResult.error}`);
    }

    const newRoleResult = UserRole.create(payload.newRole as string);
    if (newRoleResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid newRole: ${newRoleResult.error}`);
    }

    const changedByResult = UserId.create(payload.changedBy as string);
    if (changedByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid changedBy: ${changedByResult.error}`);
    }

    const event = new UserRoleChangedEvent(userIdResult.value!, oldRoleResult.value!, newRoleResult.value!, changedByResult.value!, aggregateId);

    return Result.ok<DomainEvent>(event);
  }

  private deserializePermissionGranted(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const userIdResult = UserId.create(payload.userId as string);
    if (userIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid userId: ${userIdResult.error}`);
    }

    const permissionResult = Permission.create(payload.permission as string);
    if (permissionResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid permission: ${permissionResult.error}`);
    }

    const grantedByResult = UserId.create(payload.grantedBy as string);
    if (grantedByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid grantedBy: ${grantedByResult.error}`);
    }

    const event = new PermissionGrantedEvent(userIdResult.value!, permissionResult.value!, grantedByResult.value!, aggregateId);

    return Result.ok<DomainEvent>(event);
  }

  private deserializePermissionRevoked(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const userIdResult = UserId.create(payload.userId as string);
    if (userIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid userId: ${userIdResult.error}`);
    }

    const permissionResult = Permission.create(payload.permission as string);
    if (permissionResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid permission: ${permissionResult.error}`);
    }

    const revokedByResult = UserId.create(payload.revokedBy as string);
    if (revokedByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid revokedBy: ${revokedByResult.error}`);
    }

    const event = new PermissionRevokedEvent(userIdResult.value!, permissionResult.value!, revokedByResult.value!, aggregateId);

    return Result.ok<DomainEvent>(event);
  }
}
