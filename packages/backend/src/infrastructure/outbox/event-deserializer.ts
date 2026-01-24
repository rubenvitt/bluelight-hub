import { Inject, Injectable } from '@nestjs/common';
import type { ILogger } from '@domain/ports/i-logger.port';
import { LOGGER } from '@infrastructure/di-tokens';
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

// EinsatzPerson Events
import { EinsatzPersonHinzugefuegtEvent } from '@domain/kraefte/events/einsatz-person-hinzugefuegt.event';
import { PersonZuFahrzeugZugewiesenEvent } from '@domain/kraefte/events/person-zu-fahrzeug-zugewiesen.event';
import { PersonVonFahrzeugEntferntEvent } from '@domain/kraefte/events/person-von-fahrzeug-entfernt.event';

// EinsatzFahrzeug Events
import { FahrzeugErfasstEvent } from '@domain/kraefte/events/fahrzeug-erfasst.event';
import { FmsStatusGeaendertEvent } from '@domain/kraefte/events/fms-status-geaendert.event';

// StammPerson Events
import { StammPersonCreatedEvent } from '@domain/kraefte/events/stamm-person-created.event';
import { StammPersonUpdatedEvent } from '@domain/kraefte/events/stamm-person-updated.event';

// StammFahrzeug Events
import { StammFahrzeugCreatedEvent } from '@domain/kraefte/events/stamm-fahrzeug-created.event';
import { StammFahrzeugUpdatedEvent } from '@domain/kraefte/events/stamm-fahrzeug-updated.event';

// Qualifikation Events
import { QualifikationCreatedEvent } from '@domain/kraefte/events/qualifikation-created.event';
import { QualifikationUpdatedEvent } from '@domain/kraefte/events/qualifikation-updated.event';

// Erinnerung Events
import { ErinnerungErstelltEvent } from '@domain/events/erinnerung-erstellt.event';
import { ErinnerungAktualisiertEvent } from '@domain/events/erinnerung-aktualisiert.event';
import type { ErinnerungAenderungen } from '@domain/events/erinnerung-aktualisiert.event';
import { ErinnerungGeloeschtEvent } from '@domain/events/erinnerung-geloescht.event';
import { ErinnerungAusgeloestEvent } from '@domain/events/erinnerung-ausgeloest.event';
import { ErinnerungAcknowledgedEvent } from '@domain/events/erinnerung-acknowledged.event';
import { ErinnerungSnoozedEvent } from '@domain/events/erinnerung-snoozed.event';
import { ErinnerungRetriggeredEvent } from '@domain/events/erinnerung-retriggered.event';
import { ErinnerungErledigtEvent } from '@domain/events/erinnerung-erledigt.event';
import { ErinnerungAssignedEvent } from '@domain/events/erinnerung-assigned.event';

// Fahrzeugtyp Events
import { FahrzeugtypCreatedEvent } from '@domain/kraefte/events/fahrzeugtyp-created.event';
import { FahrzeugtypUpdatedEvent } from '@domain/kraefte/events/fahrzeugtyp-updated.event';

// RollenDefinition Events
import { RollenDefinitionCreatedEvent } from '@domain/kraefte/events/rollen-definition-created.event';
import { RollenDefinitionUpdatedEvent } from '@domain/kraefte/events/rollen-definition-updated.event';

// FunkStatusConfig Events
import { FunkStatusConfigUpdatedEvent } from '@domain/kraefte/events/funk-status-config-updated.event';

// RollenBesetzung Events
import { RolleBesetzt } from '@domain/kraefte/events/rolle-besetzt.event';
import { RolleFreigegeben } from '@domain/kraefte/events/rolle-freigegeben.event';

// Types
import type { SollbesatzungSchema } from '@domain/kraefte/types/sollbesatzung.types';

// Value Objects
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EtbId } from '@domain/value-objects/etb-id';
import { EintragId } from '@domain/value-objects/eintrag-id';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
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
  /**
   * Event Registry Map für eventName → Deserializer Function Lookup.
   *
   * Jeder Event-Typ hat eine eigene Deserialize-Funktion die:
   * - Value Objects aus Primitives rekonstruiert
   * - Result<DomainEvent> zurückgibt für Error Handling
   */
  private readonly eventRegistry: Map<string, (payload: Record<string, unknown>, aggregateId?: string) => Result<DomainEvent>>;

  constructor(@Inject(LOGGER) private readonly logger: ILogger) {
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

      // ===== EINSATZ PERSON EVENTS =====
      ['einsatz_person.hinzugefuegt', this.deserializeEinsatzPersonHinzugefuegt.bind(this)],
      ['einsatz_person.zu_fahrzeug_zugewiesen', this.deserializePersonZuFahrzeugZugewiesen.bind(this)],
      ['einsatz_person.von_fahrzeug_entfernt', this.deserializePersonVonFahrzeugEntfernt.bind(this)],

      // ===== EINSATZ FAHRZEUG EVENTS =====
      ['einsatz_fahrzeug.erfasst', this.deserializeFahrzeugErfasst.bind(this)],
      ['einsatz_fahrzeug.fms_status_geaendert', this.deserializeFmsStatusGeaendert.bind(this)],

      // ===== STAMM PERSON EVENTS =====
      ['StammPersonCreated', this.deserializeStammPersonCreated.bind(this)],
      ['StammPersonUpdated', this.deserializeStammPersonUpdated.bind(this)],

      // ===== STAMM FAHRZEUG EVENTS =====
      ['StammFahrzeugCreated', this.deserializeStammFahrzeugCreated.bind(this)],
      ['StammFahrzeugUpdated', this.deserializeStammFahrzeugUpdated.bind(this)],

      // ===== QUALIFIKATION EVENTS =====
      ['QualifikationCreated', this.deserializeQualifikationCreated.bind(this)],
      ['QualifikationUpdated', this.deserializeQualifikationUpdated.bind(this)],

      // ===== FAHRZEUGTYP EVENTS =====
      ['FahrzeugtypCreated', this.deserializeFahrzeugtypCreated.bind(this)],
      ['FahrzeugtypUpdated', this.deserializeFahrzeugtypUpdated.bind(this)],

      // ===== ROLLEN DEFINITION EVENTS =====
      ['RollenDefinitionCreated', this.deserializeRollenDefinitionCreated.bind(this)],
      ['RollenDefinitionUpdated', this.deserializeRollenDefinitionUpdated.bind(this)],

      // ===== FUNK STATUS CONFIG EVENTS =====
      ['FunkStatusConfigUpdated', this.deserializeFunkStatusConfigUpdated.bind(this)],

      // ===== ROLLEN BESETZUNG EVENTS =====
      ['rollen_besetzung.besetzt', this.deserializeRolleBesetzt.bind(this)],
      ['rollen_besetzung.freigegeben', this.deserializeRolleFreigegeben.bind(this)],

      // ===== ERINNERUNG EVENTS =====
      ['erinnerung.erstellt', this.deserializeErinnerungErstellt.bind(this)],
      ['erinnerung.aktualisiert', this.deserializeErinnerungAktualisiert.bind(this)],
      ['erinnerung.geloescht', this.deserializeErinnerungGeloescht.bind(this)],
      ['erinnerung.ausgeloest', this.deserializeErinnerungAusgeloest.bind(this)],
      ['erinnerung.acknowledged', this.deserializeErinnerungAcknowledged.bind(this)],
      ['erinnerung.snoozed', this.deserializeErinnerungSnoozed.bind(this)],
      ['erinnerung.retriggered', this.deserializeErinnerungRetriggered.bind(this)],
      ['erinnerung.erledigt', this.deserializeErinnerungErledigt.bind(this)],
      ['erinnerung.assigned', this.deserializeErinnerungAssigned.bind(this)],
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

  // ===== EINSATZ PERSON DESERIALIZERS =====

  private deserializeEinsatzPersonHinzugefuegt(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
    // All fields are primitives (Event uses strings, not Value Objects)
    const event = new EinsatzPersonHinzugefuegtEvent(
      payload.einsatzId as string,
      payload.einsatzPersonId as string,
      payload.stammId as string | undefined,
      payload.vorname as string,
      payload.nachname as string,
      payload.funktion as string,
      payload.registriertVon as string,
    );

    return Result.ok<DomainEvent>(event);
  }

  private deserializePersonZuFahrzeugZugewiesen(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
    // All fields are primitives (Event uses strings, not Value Objects)
    const event = new PersonZuFahrzeugZugewiesenEvent(
      payload.einsatzId as string,
      payload.personId as string,
      payload.fahrzeugId as string,
      payload.personVorname as string,
      payload.personNachname as string,
      payload.fahrzeugFunkrufname as string,
      payload.zugewiesenVon as string,
    );

    return Result.ok<DomainEvent>(event);
  }

  private deserializePersonVonFahrzeugEntfernt(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
    // All fields are primitives (Event uses strings, not Value Objects)
    const event = new PersonVonFahrzeugEntferntEvent(
      payload.einsatzId as string,
      payload.personId as string,
      payload.fahrzeugId as string,
      payload.personVorname as string,
      payload.personNachname as string,
      payload.fahrzeugFunkrufname as string,
      payload.entferntVon as string,
    );

    return Result.ok<DomainEvent>(event);
  }

  // ===== EINSATZ FAHRZEUG DESERIALIZERS =====

  private deserializeFahrzeugErfasst(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
    // All fields are primitives (Event uses strings/numbers, not Value Objects)
    const event = new FahrzeugErfasstEvent(
      payload.einsatzId as string,
      payload.einsatzFahrzeugId as string,
      payload.funkrufname as string,
      payload.stammId as string | undefined,
      payload.fmsStatus as number,
      payload.erfasstVon as string,
    );

    return Result.ok<DomainEvent>(event);
  }

  private deserializeFmsStatusGeaendert(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
    // All fields are primitives (Event uses strings/numbers, not Value Objects)
    // Note: previousStatusLabel and neuerStatusLabel are auto-resolved in constructor
    const event = new FmsStatusGeaendertEvent(
      payload.einsatzFahrzeugId as string,
      payload.einsatzId as string,
      payload.funkrufname as string,
      payload.previousStatus as number,
      payload.neuerStatus as number,
      payload.geaendertVon as string,
    );

    return Result.ok<DomainEvent>(event);
  }

  // ===== STAMM PERSON DESERIALIZERS =====

  private deserializeStammPersonCreated(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
    // All fields are primitives (Event uses strings, not Value Objects)
    const event = new StammPersonCreatedEvent(payload.stammPersonId as string, payload.vorname as string, payload.nachname as string, payload.personalnummer as string, payload.createdBy as string);

    return Result.ok<DomainEvent>(event);
  }

  private deserializeStammPersonUpdated(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
    // All fields are primitives (Event uses strings, not Value Objects)
    const event = new StammPersonUpdatedEvent(
      payload.stammPersonId as string,
      payload.changes as {
        vorname?: string;
        nachname?: string;
        funkkenungBOS?: string;
        qualifikationIds?: string[];
        archived?: boolean;
      },
      payload.updatedBy as string,
    );

    return Result.ok<DomainEvent>(event);
  }

  // ===== STAMM FAHRZEUG DESERIALIZERS =====

  private deserializeStammFahrzeugCreated(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
    // All fields are primitives (Event uses strings, not Value Objects)
    const event = new StammFahrzeugCreatedEvent(
      payload.stammFahrzeugId as string,
      payload.rufname as string,
      payload.funkrufname as string,
      payload.fahrzeugtypId as string,
      payload.createdBy as string,
    );

    return Result.ok<DomainEvent>(event);
  }

  private deserializeStammFahrzeugUpdated(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
    // All fields are primitives (Event uses strings/numbers, not Value Objects)
    const event = new StammFahrzeugUpdatedEvent(
      payload.stammFahrzeugId as string,
      payload.changes as {
        rufname?: string;
        funkrufname?: string;
        kennzeichen?: string;
        baujahr?: number;
        funkkenungBOS?: string;
        archived?: boolean;
      },
      payload.updatedBy as string,
    );

    return Result.ok<DomainEvent>(event);
  }

  // ===== QUALIFIKATION DESERIALIZERS =====

  private deserializeQualifikationCreated(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
    // All fields are primitives (Event uses strings, not Value Objects)
    const event = new QualifikationCreatedEvent(payload.qualifikationId as string, payload.name as string, payload.abkuerzung as string, payload.kategorie as string, payload.createdBy as string);

    return Result.ok<DomainEvent>(event);
  }

  private deserializeQualifikationUpdated(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
    // All fields are primitives (Event uses strings, not Value Objects)
    const event = new QualifikationUpdatedEvent(
      payload.qualifikationId as string,
      payload.changes as {
        name?: string;
        abkuerzung?: string;
        kategorie?: string;
        beschreibung?: string;
        istAktiv?: boolean;
        sortOrder?: number;
      },
      payload.updatedBy as string,
    );

    return Result.ok<DomainEvent>(event);
  }

  // ===== FAHRZEUGTYP DESERIALIZERS =====

  private deserializeFahrzeugtypCreated(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
    // All fields are primitives (Event uses strings, not Value Objects)
    const event = new FahrzeugtypCreatedEvent(payload.fahrzeugtypId as string, payload.code as string, payload.bezeichnung as string, payload.kategorie as string, payload.createdBy as string);

    return Result.ok<DomainEvent>(event);
  }

  private deserializeFahrzeugtypUpdated(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
    // All fields are primitives (Event uses strings/numbers, not Value Objects)
    const event = new FahrzeugtypUpdatedEvent(
      payload.fahrzeugtypId as string,
      payload.changes as {
        code?: string;
        bezeichnung?: string;
        kategorie?: string;
        beschreibung?: string;
        sollbesatzung?: SollbesatzungSchema;
        istAktiv?: boolean;
        sortOrder?: number;
      },
      payload.updatedBy as string,
    );

    return Result.ok<DomainEvent>(event);
  }

  // ===== ROLLEN DEFINITION DESERIALIZERS =====

  private deserializeRollenDefinitionCreated(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
    // All fields are primitives (Event uses strings/arrays, not Value Objects)
    const event = new RollenDefinitionCreatedEvent(
      payload.rollenDefinitionId as string,
      payload.name as string,
      payload.funkrufname as string | undefined,
      payload.erforderlicheQualifikationen as ReadonlyArray<{
        qualifikationId: string;
        istPflicht: boolean;
      }>,
      payload.createdBy as string,
    );

    return Result.ok<DomainEvent>(event);
  }

  private deserializeRollenDefinitionUpdated(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
    // All fields are primitives (Event uses strings/arrays, not Value Objects)
    const event = new RollenDefinitionUpdatedEvent(
      payload.rollenDefinitionId as string,
      payload.changes as {
        name?: string;
        funkrufname?: string;
        beschreibung?: string;
        istAktiv?: boolean;
        sortOrder?: number;
        erforderlicheQualifikationen?: ReadonlyArray<{
          qualifikationId: string;
          istPflicht: boolean;
        }>;
      },
      payload.updatedBy as string,
    );

    return Result.ok<DomainEvent>(event);
  }

  // ===== FUNK STATUS CONFIG DESERIALIZERS =====

  private deserializeFunkStatusConfigUpdated(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
    // All fields are primitives (Event uses strings/numbers, not Value Objects)
    const event = new FunkStatusConfigUpdatedEvent(
      payload.funkStatusConfigId as string,
      payload.code as number,
      payload.changes as {
        customLabel?: string;
        farbe?: string;
        istAlarmierbar?: boolean;
        beschreibung?: string;
      },
      payload.updatedBy as string,
    );

    return Result.ok<DomainEvent>(event);
  }

  // ===== ROLLEN BESETZUNG DESERIALIZERS =====

  private deserializeRolleBesetzt(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
    // All fields are primitives (Event uses strings, not Value Objects)
    const event = new RolleBesetzt(
      payload.einsatzId as string,
      payload.einsatzPersonId as string,
      payload.rollenDefinitionId as string,
      payload.rollenName as string,
      payload.personVorname as string,
      payload.personNachname as string,
      payload.besetztVon as string,
    );

    return Result.ok<DomainEvent>(event);
  }

  private deserializeRolleFreigegeben(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
    // All fields are primitives (Event uses strings, not Value Objects)
    const event = new RolleFreigegeben(
      payload.einsatzId as string,
      payload.einsatzPersonId as string,
      payload.rollenDefinitionId as string,
      payload.rollenName as string,
      payload.personVorname as string,
      payload.personNachname as string,
      payload.freigegebenVon as string,
    );

    return Result.ok<DomainEvent>(event);
  }

  // ===== ERINNERUNG DESERIALIZERS =====

  private deserializeErinnerungErstellt(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const erinnerungIdResult = ErinnerungId.create(payload.erinnerungId as string);
    if (erinnerungIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid erinnerungId: ${erinnerungIdResult.error}`);
    }

    const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
    if (einsatzIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
    }

    const erstelltVonResult = UserId.create(payload.erstelltVon as string);
    if (erstelltVonResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid erstelltVon: ${erstelltVonResult.error}`);
    }

    const faelligAm = new Date(payload.faelligAm as string);

    // Story 3.3: Optional assignedToId aus Payload deserialisieren
    let assignedToId: UserId | null = null;
    if (payload.assignedToId) {
      const assignedToIdResult = UserId.create(payload.assignedToId as string);
      if (assignedToIdResult.isSuccess && assignedToIdResult.value) {
        assignedToId = assignedToIdResult.value;
      }
    }

    const event = new ErinnerungErstelltEvent(erinnerungIdResult.value!, einsatzIdResult.value!, payload.titel as string, faelligAm, erstelltVonResult.value!, assignedToId, aggregateId);

    return Result.ok<DomainEvent>(event);
  }

  private deserializeErinnerungAktualisiert(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const erinnerungIdResult = ErinnerungId.create(payload.erinnerungId as string);
    if (erinnerungIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid erinnerungId: ${erinnerungIdResult.error}`);
    }

    const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
    if (einsatzIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
    }

    const aktualisierVonResult = UserId.create(payload.aktualisierVon as string);
    if (aktualisierVonResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid aktualisierVon: ${aktualisierVonResult.error}`);
    }

    // Reconstruct aenderungen object with proper Date conversion
    const rawAenderungen = payload.aenderungen as Record<string, unknown>;
    const aenderungen: ErinnerungAenderungen = {};

    if (rawAenderungen.titel !== undefined) {
      aenderungen.titel = rawAenderungen.titel as string;
    }
    if (rawAenderungen.beschreibung !== undefined) {
      aenderungen.beschreibung = rawAenderungen.beschreibung as string | null;
    }
    if (rawAenderungen.faelligAm !== undefined) {
      aenderungen.faelligAm = new Date(rawAenderungen.faelligAm as string);
    }

    const event = new ErinnerungAktualisiertEvent(erinnerungIdResult.value!, einsatzIdResult.value!, aenderungen, aktualisierVonResult.value!, payload.titel as string, aggregateId);

    return Result.ok<DomainEvent>(event);
  }

  private deserializeErinnerungGeloescht(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const erinnerungIdResult = ErinnerungId.create(payload.erinnerungId as string);
    if (erinnerungIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid erinnerungId: ${erinnerungIdResult.error}`);
    }

    const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
    if (einsatzIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
    }

    const geloeschtVonResult = UserId.create(payload.geloeschtVon as string);
    if (geloeschtVonResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid geloeschtVon: ${geloeschtVonResult.error}`);
    }

    const event = new ErinnerungGeloeschtEvent(erinnerungIdResult.value!, einsatzIdResult.value!, payload.titel as string, geloeschtVonResult.value!, aggregateId);

    return Result.ok<DomainEvent>(event);
  }

  private deserializeErinnerungAusgeloest(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const erinnerungIdResult = ErinnerungId.create(payload.erinnerungId as string);
    if (erinnerungIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid erinnerungId: ${erinnerungIdResult.error}`);
    }

    const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
    if (einsatzIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
    }

    const erstelltVonResult = UserId.create(payload.erstelltVon as string);
    if (erstelltVonResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid erstelltVon: ${erstelltVonResult.error}`);
    }

    const ausgeloestAm = new Date(payload.ausgeloestAm as string);

    const event = new ErinnerungAusgeloestEvent(erinnerungIdResult.value!, einsatzIdResult.value!, ausgeloestAm, payload.titel as string, erstelltVonResult.value!, aggregateId);

    return Result.ok<DomainEvent>(event);
  }

  /**
   * Deserialisiert ErinnerungAcknowledgedEvent (Story 1.6).
   */
  private deserializeErinnerungAcknowledged(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const erinnerungIdResult = ErinnerungId.create(payload.erinnerungId as string);
    if (erinnerungIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid erinnerungId: ${erinnerungIdResult.error}`);
    }

    const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
    if (einsatzIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
    }

    const acknowledgedByResult = UserId.create(payload.acknowledgedBy as string);
    if (acknowledgedByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid acknowledgedBy: ${acknowledgedByResult.error}`);
    }

    const acknowledgedAm = new Date(payload.acknowledgedAm as string);

    const event = new ErinnerungAcknowledgedEvent(erinnerungIdResult.value!, einsatzIdResult.value!, acknowledgedAm, acknowledgedByResult.value!, payload.titel as string, aggregateId);

    return Result.ok<DomainEvent>(event);
  }

  /**
   * Deserialisiert ErinnerungSnoozedEvent (Story 2.1).
   */
  private deserializeErinnerungSnoozed(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const erinnerungIdResult = ErinnerungId.create(payload.erinnerungId as string);
    if (erinnerungIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid erinnerungId: ${erinnerungIdResult.error}`);
    }

    const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
    if (einsatzIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
    }

    const snoozedByResult = UserId.create(payload.snoozedBy as string);
    if (snoozedByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid snoozedBy: ${snoozedByResult.error}`);
    }

    const snoozedAt = new Date(payload.snoozedAt as string);
    const snoozedUntil = new Date(payload.snoozedUntil as string);

    const event = new ErinnerungSnoozedEvent(
      erinnerungIdResult.value!,
      einsatzIdResult.value!,
      snoozedAt,
      snoozedUntil,
      snoozedByResult.value!,
      payload.snoozeMinutes as number,
      payload.snoozeCount as number,
      payload.titel as string,
      aggregateId,
    );

    return Result.ok<DomainEvent>(event);
  }

  /**
   * Deserialisiert ErinnerungRetriggeredEvent (Story 2.2).
   */
  private deserializeErinnerungRetriggered(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const erinnerungIdResult = ErinnerungId.create(payload.erinnerungId as string);
    if (erinnerungIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid erinnerungId: ${erinnerungIdResult.error}`);
    }

    const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
    if (einsatzIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
    }

    const erstelltVonResult = UserId.create(payload.erstelltVon as string);
    if (erstelltVonResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid erstelltVon: ${erstelltVonResult.error}`);
    }

    const retriggeredAm = new Date(payload.retriggeredAm as string);
    const previousSnoozedAt = payload.previousSnoozedAt ? new Date(payload.previousSnoozedAt as string) : null;

    const event = new ErinnerungRetriggeredEvent(
      erinnerungIdResult.value!,
      einsatzIdResult.value!,
      retriggeredAm,
      payload.titel as string,
      erstelltVonResult.value!,
      payload.snoozeCount as number,
      previousSnoozedAt,
      aggregateId,
    );

    return Result.ok<DomainEvent>(event);
  }

  /**
   * Deserialisiert ErinnerungErledigtEvent (Story 2.5).
   */
  private deserializeErinnerungErledigt(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const erinnerungIdResult = ErinnerungId.create(payload.erinnerungId as string);
    if (erinnerungIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid erinnerungId: ${erinnerungIdResult.error}`);
    }

    const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
    if (einsatzIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
    }

    const erledigtByResult = UserId.create(payload.erledigtBy as string);
    if (erledigtByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid erledigtBy: ${erledigtByResult.error}`);
    }

    const erledigtAm = new Date(payload.erledigtAm as string);

    const event = new ErinnerungErledigtEvent(
      erinnerungIdResult.value!,
      einsatzIdResult.value!,
      erledigtAm,
      erledigtByResult.value!,
      payload.titel as string,
      payload.erledigungsNotiz as string | null,
      aggregateId,
    );

    return Result.ok<DomainEvent>(event);
  }

  /**
   * Deserialisiert ErinnerungAssignedEvent (Story 3.4).
   */
  private deserializeErinnerungAssigned(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const erinnerungIdResult = ErinnerungId.create(payload.erinnerungId as string);
    if (erinnerungIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid erinnerungId: ${erinnerungIdResult.error}`);
    }

    const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
    if (einsatzIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
    }

    const assignedToIdResult = UserId.create(payload.assignedToId as string);
    if (assignedToIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid assignedToId: ${assignedToIdResult.error}`);
    }

    const assignedByIdResult = UserId.create(payload.assignedById as string);
    if (assignedByIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid assignedById: ${assignedByIdResult.error}`);
    }

    const assignedAt = new Date(payload.assignedAt as string);

    const event = new ErinnerungAssignedEvent(
      erinnerungIdResult.value!,
      einsatzIdResult.value!,
      assignedToIdResult.value!,
      assignedByIdResult.value!,
      payload.titel as string,
      assignedAt,
      aggregateId,
    );

    return Result.ok<DomainEvent>(event);
  }
}
