import { Injectable } from '@nestjs/common';
import type { DomainEvent } from '@domain/common/domain-event';
import type { EinsatzCreatedEvent } from '@domain/events/einsatz-created.event';
import type { EinsatzUpdatedEvent } from '@domain/events/einsatz-updated.event';
import type { EinsatzStatusChangedEvent } from '@domain/events/einsatz-status-changed.event';
import type { EinsatzCompletedEvent } from '@domain/events/einsatz-completed.event';
import type { EinsatzArchivedEvent } from '@domain/events/einsatz-archived.event';
import type { EtbCreatedEvent } from '@domain/events/etb-created.event';
import type { EintragAddedEvent } from '@domain/events/eintrag-added.event';
import type { EintragUpdatedEvent } from '@domain/events/eintrag-updated.event';
import type { EintragDeletedEvent } from '@domain/events/eintrag-deleted.event';
import type { EtbLockedEvent } from '@domain/events/etb-locked.event';
import type { LagekarteCreatedEvent } from '@domain/events/lagekarte-created.event';
import type { PoiAddedEvent } from '@domain/events/poi-added.event';
import type { PoiRemovedEvent } from '@domain/events/poi-removed.event';
import type { PoiPositionUpdatedEvent } from '@domain/events/poi-position-updated.event';
import type { UserCreatedEvent } from '@domain/events/user-created.event';
import type { UserDeletedEvent } from '@domain/events/user-deleted.event';
import type { UserRoleChangedEvent } from '@domain/events/user-role-changed.event';
import type { PermissionGrantedEvent } from '@domain/events/permission-granted.event';
import type { PermissionRevokedEvent } from '@domain/events/permission-revoked.event';

/**
 * Serialisiertes Event-Payload für Outbox-Persistierung.
 *
 * Warum eigenes Format?
 * - JSON-kompatibel: Value Objects werden zu Primitives konvertiert
 * - Vollständig: Alle Event-Felder werden erfasst (Round-Trip Support)
 * - Versioniert: eventVersion ermöglicht Schema-Evolution
 */
export interface SerializedEvent {
  eventId: string;
  eventName: string;
  eventVersion: number;
  occurredAt: string; // ISO8601
  aggregateId?: string;
  payload: Record<string, unknown>;
}

/**
 * Event Serializer für Transactional Outbox Pattern.
 *
 * Konvertiert Domain Events in JSON-serialisierbare Records für DB-Persistierung.
 * Value Objects werden via .value Getter zu Primitives extrahiert.
 *
 * Warum Serializer als Service?
 * - Zentrale Stelle für Value Object → Primitive Konvertierung
 * - Ermöglicht Schema-Evolution durch eventVersion
 * - Testbar und austauschbar (DI)
 *
 * @example
 * ```typescript
 * const serializer = new EventSerializer();
 * const event = new EinsatzCreatedEvent(einsatzId, createdBy, 'Wohnungsbrand', 'E2024-abc');
 * const serialized = serializer.serialize(event);
 * // { eventId: '...', eventName: 'einsatz.created', payload: { einsatzId: 'cuid...', ... } }
 * ```
 */
@Injectable()
export class EventSerializer {
  /**
   * Serialisiert ein Domain Event zu JSON-kompatiblem Format.
   *
   * Warum serialize() statt JSON.stringify()?
   * - Value Objects haben keine toJSON() Methode
   * - Explizite .value Extraktion für alle ID-Typen
   * - Konsistentes Format für alle 19 Event-Typen
   *
   * @param event - Das zu serialisierende Domain Event
   * @returns SerializedEvent mit allen Feldern als Primitives
   */
  serialize(event: DomainEvent): SerializedEvent {
    // Base Class Properties (auto-generiert)
    const base: SerializedEvent = {
      eventId: event.eventId,
      eventName: this.getEventName(event),
      eventVersion: this.getEventVersion(event),
      occurredAt: event.occurredAt.toISOString(),
      aggregateId: event.aggregateId,
      payload: {},
    };

    // Event-spezifisches Payload (Value Objects → Primitives)
    base.payload = this.serializePayload(event);

    return base;
  }

  /**
   * Extrahiert den Event-Namen aus dem Event.
   * Nutzt die statische eventName() Methode der konkreten Event-Klasse.
   */
  private getEventName(event: DomainEvent): string {
    // Nutze Prototype Chain um statische Methode zu erreichen
    const eventClass = event.constructor as typeof DomainEvent;
    return eventClass.eventName();
  }

  /**
   * Extrahiert die Event-Version aus dem Event.
   * Default: 1 (aus DomainEvent Base Class)
   */
  private getEventVersion(event: DomainEvent): number {
    const eventClass = event.constructor as typeof DomainEvent;
    return eventClass.eventVersion();
  }

  /**
   * Serialisiert das Event-spezifische Payload.
   *
   * WICHTIG: Value Objects werden via .value oder .toString() zu Primitives konvertiert.
   * Dies ermöglicht JSON-Serialisierung ohne custom toJSON() Methoden.
   */
  private serializePayload(event: DomainEvent): Record<string, unknown> {
    const eventName = this.getEventName(event);

    switch (eventName) {
      // ===== EINSATZ EVENTS =====
      case 'einsatz.created':
        return this.serializeEinsatzCreated(event as unknown as EinsatzCreatedEvent);
      case 'einsatz.updated':
        return this.serializeEinsatzUpdated(event as unknown as EinsatzUpdatedEvent);
      case 'einsatz.status_changed':
        return this.serializeEinsatzStatusChanged(event as unknown as EinsatzStatusChangedEvent);
      case 'einsatz.completed':
        return this.serializeEinsatzCompleted(event as unknown as EinsatzCompletedEvent);
      case 'einsatz.archived':
        return this.serializeEinsatzArchived(event as unknown as EinsatzArchivedEvent);

      // ===== ETB EVENTS =====
      case 'etb.created':
        return this.serializeEtbCreated(event as unknown as EtbCreatedEvent);
      case 'etb.eintrag_added':
        return this.serializeEintragAdded(event as unknown as EintragAddedEvent);
      case 'etb.eintrag_updated':
        return this.serializeEintragUpdated(event as unknown as EintragUpdatedEvent);
      case 'etb.eintrag_deleted':
        return this.serializeEintragDeleted(event as unknown as EintragDeletedEvent);
      case 'etb.locked':
        return this.serializeEtbLocked(event as unknown as EtbLockedEvent);

      // ===== LAGEKARTE EVENTS =====
      case 'lagekarte.created':
        return this.serializeLagekarteCreated(event as unknown as LagekarteCreatedEvent);
      case 'lagekarte.poi_added':
        return this.serializePoiAdded(event as unknown as PoiAddedEvent);
      case 'lagekarte.poi_removed':
        return this.serializePoiRemoved(event as unknown as PoiRemovedEvent);
      case 'lagekarte.poi_position_updated':
        return this.serializePoiPositionUpdated(event as unknown as PoiPositionUpdatedEvent);

      // ===== USER EVENTS =====
      case 'user.created':
        return this.serializeUserCreated(event as unknown as UserCreatedEvent);
      case 'user.deleted':
        return this.serializeUserDeleted(event as unknown as UserDeletedEvent);
      case 'user.role_changed':
        return this.serializeUserRoleChanged(event as unknown as UserRoleChangedEvent);
      case 'user.permission_granted':
        return this.serializePermissionGranted(event as unknown as PermissionGrantedEvent);
      case 'user.permission_revoked':
        return this.serializePermissionRevoked(event as unknown as PermissionRevokedEvent);

      default:
        throw new Error(`Unknown event type: ${eventName}. EventSerializer needs to be updated.`);
    }
  }

  // ===== EINSATZ SERIALIZERS =====

  private serializeEinsatzCreated(event: EinsatzCreatedEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId.value,
      createdBy: event.createdBy.value,
      alarmstichwort: event.alarmstichwort,
      nummer: event.nummer,
    };
  }

  private serializeEinsatzUpdated(event: EinsatzUpdatedEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId.value,
      updates: event.updates, // Already primitives (alarmstichwort?, einsatzort?, bemerkung?)
    };
  }

  private serializeEinsatzStatusChanged(event: EinsatzStatusChangedEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId.value,
      oldStatus: event.oldStatus.value, // EinsatzStatus.value → string
      newStatus: event.newStatus.value,
    };
  }

  private serializeEinsatzCompleted(event: EinsatzCompletedEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId.value,
      completedBy: event.completedBy.value,
      completedAt: event.completedAt.toISOString(),
    };
  }

  private serializeEinsatzArchived(event: EinsatzArchivedEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId.value,
      archivedBy: event.archivedBy.value,
    };
  }

  // ===== ETB SERIALIZERS =====

  private serializeEtbCreated(event: EtbCreatedEvent): Record<string, unknown> {
    return {
      etbId: event.etbId.value,
      einsatzId: event.einsatzId.value,
    };
  }

  private serializeEintragAdded(event: EintragAddedEvent): Record<string, unknown> {
    return {
      etbId: event.etbId.value,
      eintragId: event.eintragId.value,
      sequenceNumber: event.sequenceNumber, // Already primitive
      text: event.text,
      createdBy: event.createdBy.value,
    };
  }

  private serializeEintragUpdated(event: EintragUpdatedEvent): Record<string, unknown> {
    return {
      etbId: event.etbId.value,
      eintragId: event.eintragId.value,
      oldText: event.oldText,
      newText: event.newText,
      updatedBy: event.updatedBy.value,
    };
  }

  private serializeEintragDeleted(event: EintragDeletedEvent): Record<string, unknown> {
    return {
      etbId: event.etbId.value,
      eintragId: event.eintragId.value,
      deletedBy: event.deletedBy.value,
    };
  }

  private serializeEtbLocked(event: EtbLockedEvent): Record<string, unknown> {
    return {
      etbId: event.etbId.value,
      lockedBy: event.lockedBy.value,
      lockedAt: event.lockedAt.toISOString(),
    };
  }

  // ===== LAGEKARTE SERIALIZERS =====

  private serializeLagekarteCreated(event: LagekarteCreatedEvent): Record<string, unknown> {
    return {
      lagekarteId: event.lagekarteId.value,
      einsatzId: event.einsatzId.value,
      createdBy: event.createdBy.value,
      hasInitialPoi: event.hasInitialPoi,
    };
  }

  private serializePoiAdded(event: PoiAddedEvent): Record<string, unknown> {
    return {
      lagekarteId: event.lagekarteId.value,
      poiId: event.poiId.value,
      name: event.name,
      coordinate: event.coordinate.value, // MgrsCoordinate.value → MGRS string
      category: event.category.value, // PoiCategory.value → string
      createdBy: event.createdBy.value,
    };
  }

  private serializePoiRemoved(event: PoiRemovedEvent): Record<string, unknown> {
    return {
      lagekarteId: event.lagekarteId.value,
      poiId: event.poiId.value,
      removedBy: event.removedBy.value,
    };
  }

  private serializePoiPositionUpdated(event: PoiPositionUpdatedEvent): Record<string, unknown> {
    return {
      lagekarteId: event.lagekarteId.value,
      poiId: event.poiId.value,
      oldCoordinate: event.oldCoordinate.value,
      newCoordinate: event.newCoordinate.value,
      updatedBy: event.updatedBy.value,
    };
  }

  // ===== USER SERIALIZERS =====

  private serializeUserCreated(event: UserCreatedEvent): Record<string, unknown> {
    return {
      userId: event.userId.value,
      username: event.username.value,
      role: event.role.value,
    };
  }

  private serializeUserDeleted(event: UserDeletedEvent): Record<string, unknown> {
    return {
      userId: event.userId.value,
      deletedBy: event.deletedBy.value,
    };
  }

  private serializeUserRoleChanged(event: UserRoleChangedEvent): Record<string, unknown> {
    return {
      userId: event.userId.value,
      oldRole: event.oldRole.value,
      newRole: event.newRole.value,
      changedBy: event.changedBy.value,
    };
  }

  private serializePermissionGranted(event: PermissionGrantedEvent): Record<string, unknown> {
    return {
      userId: event.userId.value,
      permission: event.permission.value,
      grantedBy: event.grantedBy.value,
    };
  }

  private serializePermissionRevoked(event: PermissionRevokedEvent): Record<string, unknown> {
    return {
      userId: event.userId.value,
      permission: event.permission.value,
      revokedBy: event.revokedBy.value,
    };
  }
}
