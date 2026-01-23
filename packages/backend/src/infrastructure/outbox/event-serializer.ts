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
import type { QualifikationCreatedEvent } from '@domain/kraefte/events/qualifikation-created.event';
import type { QualifikationUpdatedEvent } from '@domain/kraefte/events/qualifikation-updated.event';
import type { EinsatzPersonHinzugefuegtEvent } from '@domain/kraefte/events/einsatz-person-hinzugefuegt.event';
import type { FahrzeugErfasstEvent } from '@domain/kraefte/events/fahrzeug-erfasst.event';
import type { FmsStatusGeaendertEvent } from '@domain/kraefte/events/fms-status-geaendert.event';
import type { StammPersonCreatedEvent } from '@domain/kraefte/events/stamm-person-created.event';
import type { StammPersonUpdatedEvent } from '@domain/kraefte/events/stamm-person-updated.event';
import type { StammFahrzeugCreatedEvent } from '@domain/kraefte/events/stamm-fahrzeug-created.event';
import type { StammFahrzeugUpdatedEvent } from '@domain/kraefte/events/stamm-fahrzeug-updated.event';
import type { PersonZuFahrzeugZugewiesenEvent } from '@domain/kraefte/events/person-zu-fahrzeug-zugewiesen.event';
import type { PersonVonFahrzeugEntferntEvent } from '@domain/kraefte/events/person-von-fahrzeug-entfernt.event';
import type { RolleBesetzt } from '@domain/kraefte/events/rolle-besetzt.event';
import type { RolleFreigegeben } from '@domain/kraefte/events/rolle-freigegeben.event';
import type { RollenDefinitionCreatedEvent } from '@domain/kraefte/events/rollen-definition-created.event';
import type { RollenDefinitionUpdatedEvent } from '@domain/kraefte/events/rollen-definition-updated.event';
import type { InviteCodeCreatedEvent } from '@domain/events/invite-code-created.event';
import type { InviteCodeRevokedEvent } from '@domain/events/invite-code-revoked.event';
import type { ServerAccessTokenCreatedEvent } from '@domain/events/server-access-token-created.event';
import type { ServerAccessTokenRevokedEvent } from '@domain/events/server-access-token-revoked.event';
import type { ServerAccessTokenRotatedEvent } from '@domain/events/server-access-token-rotated.event';
import type { ServerAccessTokenReactivatedEvent } from '@domain/events/server-access-token-reactivated.event';
import type { ErinnerungErstelltEvent } from '@domain/events/erinnerung-erstellt.event';
import type { ErinnerungAktualisiertEvent } from '@domain/events/erinnerung-aktualisiert.event';
import type { ErinnerungGeloeschtEvent } from '@domain/events/erinnerung-geloescht.event';
import type { ErinnerungAusgeloestEvent } from '@domain/events/erinnerung-ausgeloest.event';
import type { ErinnerungAcknowledgedEvent } from '@domain/events/erinnerung-acknowledged.event';
import type { ErinnerungSnoozedEvent } from '@domain/events/erinnerung-snoozed.event';
import type { ErinnerungRetriggeredEvent } from '@domain/events/erinnerung-retriggered.event';
import type { ErinnerungErledigtEvent } from '@domain/events/erinnerung-erledigt.event';

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
 * **Event Naming Convention:**
 * - Legacy Events (Einsatz, ETB, Lagekarte, User): Dot-Notation (z.B. 'einsatz.created')
 * - Neue Events (Qualifikation, Rolle): PascalCase (z.B. 'QualifikationCreated')
 * - WICHTIG: Beide Konventionen werden unterstützt für Backwards Compatibility
 * - TODO: Migration zu einheitlicher Konvention (vorgeschlagen: dot-notation)
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

      // ===== QUALIFIKATION EVENTS =====
      case 'QualifikationCreated':
        return this.serializeQualifikationCreated(event as unknown as QualifikationCreatedEvent);
      case 'QualifikationUpdated':
        return this.serializeQualifikationUpdated(event as unknown as QualifikationUpdatedEvent);

      // ===== EINSATZ PERSON EVENTS =====
      case 'einsatz_person.hinzugefuegt':
        return this.serializeEinsatzPersonHinzugefuegt(event as unknown as EinsatzPersonHinzugefuegtEvent);
      case 'einsatz_person.zu_fahrzeug_zugewiesen':
        return this.serializePersonZuFahrzeugZugewiesen(event as unknown as PersonZuFahrzeugZugewiesenEvent);
      case 'einsatz_person.von_fahrzeug_entfernt':
        return this.serializePersonVonFahrzeugEntfernt(event as unknown as PersonVonFahrzeugEntferntEvent);

      // ===== EINSATZ FAHRZEUG EVENTS =====
      case 'einsatz_fahrzeug.erfasst':
        return this.serializeFahrzeugErfasst(event as unknown as FahrzeugErfasstEvent);
      case 'einsatz_fahrzeug.fms_status_geaendert':
        return this.serializeFmsStatusGeaendert(event as unknown as FmsStatusGeaendertEvent);

      // ===== STAMM PERSON EVENTS =====
      case 'StammPersonCreated':
        return this.serializeStammPersonCreated(event as unknown as StammPersonCreatedEvent);
      case 'StammPersonUpdated':
        return this.serializeStammPersonUpdated(event as unknown as StammPersonUpdatedEvent);

      // ===== STAMM FAHRZEUG EVENTS =====
      case 'StammFahrzeugCreated':
        return this.serializeStammFahrzeugCreated(event as unknown as StammFahrzeugCreatedEvent);
      case 'StammFahrzeugUpdated':
        return this.serializeStammFahrzeugUpdated(event as unknown as StammFahrzeugUpdatedEvent);

      // ===== ROLLEN BESETZUNG EVENTS =====
      case 'rollen_besetzung.besetzt':
        return this.serializeRolleBesetzt(event as unknown as RolleBesetzt);
      case 'rollen_besetzung.freigegeben':
        return this.serializeRolleFreigegeben(event as unknown as RolleFreigegeben);

      // ===== ROLLEN DEFINITION EVENTS =====
      case 'RollenDefinitionCreated':
        return this.serializeRollenDefinitionCreated(event as unknown as RollenDefinitionCreatedEvent);
      case 'RollenDefinitionUpdated':
        return this.serializeRollenDefinitionUpdated(event as unknown as RollenDefinitionUpdatedEvent);

      // ===== INVITE CODE EVENTS =====
      case 'invite_code.created':
        return this.serializeInviteCodeCreated(event as unknown as InviteCodeCreatedEvent);
      case 'invite_code.revoked':
        return this.serializeInviteCodeRevoked(event as unknown as InviteCodeRevokedEvent);

      // ===== SERVER ACCESS TOKEN EVENTS =====
      case 'server_access_token.created':
        return this.serializeServerAccessTokenCreated(event as unknown as ServerAccessTokenCreatedEvent);
      case 'server_access_token.revoked':
        return this.serializeServerAccessTokenRevoked(event as unknown as ServerAccessTokenRevokedEvent);
      case 'server_access_token.rotated':
        return this.serializeServerAccessTokenRotated(event as unknown as ServerAccessTokenRotatedEvent);
      case 'server_access_token.reactivated':
        return this.serializeServerAccessTokenReactivated(event as unknown as ServerAccessTokenReactivatedEvent);

      // ===== ERINNERUNG EVENTS =====
      case 'erinnerung.erstellt':
        return this.serializeErinnerungErstellt(event as unknown as ErinnerungErstelltEvent);
      case 'erinnerung.aktualisiert':
        return this.serializeErinnerungAktualisiert(event as unknown as ErinnerungAktualisiertEvent);
      case 'erinnerung.geloescht':
        return this.serializeErinnerungGeloescht(event as unknown as ErinnerungGeloeschtEvent);
      case 'erinnerung.ausgeloest':
        return this.serializeErinnerungAusgeloest(event as unknown as ErinnerungAusgeloestEvent);
      case 'erinnerung.acknowledged':
        return this.serializeErinnerungAcknowledged(event as unknown as ErinnerungAcknowledgedEvent);
      case 'erinnerung.snoozed':
        return this.serializeErinnerungSnoozed(event as unknown as ErinnerungSnoozedEvent);
      case 'erinnerung.retriggered':
        return this.serializeErinnerungRetriggered(event as unknown as ErinnerungRetriggeredEvent);
      case 'erinnerung.erledigt':
        return this.serializeErinnerungErledigt(event as unknown as ErinnerungErledigtEvent);

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

  // ===== QUALIFIKATION SERIALIZERS =====

  private serializeQualifikationCreated(event: QualifikationCreatedEvent): Record<string, unknown> {
    return {
      qualifikationId: event.qualifikationId, // Already primitive string
      name: event.name,
      abkuerzung: event.abkuerzung,
      kategorie: event.kategorie,
      createdBy: event.createdBy,
    };
  }

  private serializeQualifikationUpdated(event: QualifikationUpdatedEvent): Record<string, unknown> {
    return {
      qualifikationId: event.qualifikationId, // Already primitive string
      changes: event.changes, // Already primitives
      updatedBy: event.updatedBy,
    };
  }

  // ===== EINSATZ PERSON SERIALIZERS =====

  private serializeEinsatzPersonHinzugefuegt(event: EinsatzPersonHinzugefuegtEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId, // Already primitive string
      einsatzPersonId: event.einsatzPersonId,
      stammId: event.stammId, // string | undefined
      vorname: event.vorname,
      nachname: event.nachname,
      funktion: event.funktion,
      registriertVon: event.registriertVon,
    };
  }

  private serializePersonZuFahrzeugZugewiesen(event: PersonZuFahrzeugZugewiesenEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId, // Already primitive string
      personId: event.personId,
      fahrzeugId: event.fahrzeugId,
      personVorname: event.personVorname,
      personNachname: event.personNachname,
      fahrzeugFunkrufname: event.fahrzeugFunkrufname,
      zugewiesenVon: event.zugewiesenVon,
    };
  }

  private serializePersonVonFahrzeugEntfernt(event: PersonVonFahrzeugEntferntEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId, // Already primitive string
      personId: event.personId,
      fahrzeugId: event.fahrzeugId,
      personVorname: event.personVorname,
      personNachname: event.personNachname,
      fahrzeugFunkrufname: event.fahrzeugFunkrufname,
      entferntVon: event.entferntVon,
    };
  }

  // ===== EINSATZ FAHRZEUG SERIALIZERS =====

  private serializeFahrzeugErfasst(event: FahrzeugErfasstEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId, // Already primitive string
      einsatzFahrzeugId: event.einsatzFahrzeugId,
      funkrufname: event.funkrufname,
      stammId: event.stammId, // string | undefined
      fmsStatus: event.fmsStatus,
      erfasstVon: event.erfasstVon,
    };
  }

  private serializeFmsStatusGeaendert(event: FmsStatusGeaendertEvent): Record<string, unknown> {
    return {
      einsatzFahrzeugId: event.einsatzFahrzeugId, // Already primitive string
      einsatzId: event.einsatzId,
      funkrufname: event.funkrufname,
      previousStatus: event.previousStatus,
      neuerStatus: event.neuerStatus,
      previousStatusLabel: event.previousStatusLabel,
      neuerStatusLabel: event.neuerStatusLabel,
      geaendertVon: event.geaendertVon,
    };
  }

  // ===== STAMM PERSON SERIALIZERS =====

  private serializeStammPersonCreated(event: StammPersonCreatedEvent): Record<string, unknown> {
    return {
      stammPersonId: event.stammPersonId, // Already primitive string
      vorname: event.vorname,
      nachname: event.nachname,
      personalnummer: event.personalnummer,
      createdBy: event.createdBy,
    };
  }

  private serializeStammPersonUpdated(event: StammPersonUpdatedEvent): Record<string, unknown> {
    return {
      stammPersonId: event.stammPersonId, // Already primitive string
      changes: event.changes, // Already primitives
      updatedBy: event.updatedBy,
    };
  }

  // ===== STAMM FAHRZEUG SERIALIZERS =====

  private serializeStammFahrzeugCreated(event: StammFahrzeugCreatedEvent): Record<string, unknown> {
    return {
      stammFahrzeugId: event.stammFahrzeugId, // Already primitive string
      rufname: event.rufname,
      funkrufname: event.funkrufname,
      fahrzeugtypId: event.fahrzeugtypId,
      createdBy: event.createdBy,
    };
  }

  private serializeStammFahrzeugUpdated(event: StammFahrzeugUpdatedEvent): Record<string, unknown> {
    return {
      stammFahrzeugId: event.stammFahrzeugId, // Already primitive string
      changes: event.changes, // Already primitives
      updatedBy: event.updatedBy,
    };
  }

  // ===== ROLLEN BESETZUNG SERIALIZERS =====

  private serializeRolleBesetzt(event: RolleBesetzt): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId, // Already primitive string
      einsatzPersonId: event.einsatzPersonId,
      rollenDefinitionId: event.rollenDefinitionId,
      rollenName: event.rollenName,
      personVorname: event.personVorname,
      personNachname: event.personNachname,
      besetztVon: event.besetztVon,
    };
  }

  private serializeRolleFreigegeben(event: RolleFreigegeben): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId, // Already primitive string
      einsatzPersonId: event.einsatzPersonId,
      rollenDefinitionId: event.rollenDefinitionId,
      rollenName: event.rollenName,
      personVorname: event.personVorname,
      personNachname: event.personNachname,
      freigegebenVon: event.freigegebenVon,
    };
  }

  // ===== ROLLEN DEFINITION SERIALIZERS =====

  private serializeRollenDefinitionCreated(event: RollenDefinitionCreatedEvent): Record<string, unknown> {
    return {
      rollenDefinitionId: event.rollenDefinitionId, // Already primitive string
      name: event.name,
      funkrufname: event.funkrufname,
      erforderlicheQualifikationen: event.erforderlicheQualifikationen, // Already primitives array
      createdBy: event.createdBy,
    };
  }

  private serializeRollenDefinitionUpdated(event: RollenDefinitionUpdatedEvent): Record<string, unknown> {
    return {
      rollenDefinitionId: event.rollenDefinitionId, // Already primitive string
      changes: event.changes, // Already primitives
      updatedBy: event.updatedBy,
    };
  }

  // ===== INVITE CODE SERIALIZERS =====

  private serializeInviteCodeCreated(event: InviteCodeCreatedEvent): Record<string, unknown> {
    return {
      inviteCodeId: event.inviteCodeId.toString(), // InviteCodeId → string
      codeMasked: event.codeMasked, // Already primitive string
      expiresAt: event.expiresAt.toISOString(), // Date → ISO string
      maxUses: event.maxUses, // Already primitive number
      createdById: event.createdById, // Already primitive string
      label: event.label, // string | null
    };
  }

  private serializeInviteCodeRevoked(event: InviteCodeRevokedEvent): Record<string, unknown> {
    return {
      inviteCodeId: event.inviteCodeId, // Already primitive string
      codeMasked: event.codeMasked,
      revokedAt: event.revokedAt.toISOString(),
      revokedById: event.revokedById,
    };
  }

  // ===== SERVER ACCESS TOKEN SERIALIZERS =====

  private serializeServerAccessTokenCreated(event: ServerAccessTokenCreatedEvent): Record<string, unknown> {
    return {
      tokenId: event.tokenId.toString(), // AccessTokenId → string
      name: event.name, // string | null
      expiresAt: event.expiresAt?.toISOString() ?? null, // Date | null → ISO string | null
    };
  }

  private serializeServerAccessTokenRevoked(event: ServerAccessTokenRevokedEvent): Record<string, unknown> {
    return {
      tokenId: event.tokenId.toString(), // AccessTokenId → string
      revokedAt: event.revokedAt.toISOString(), // Date → ISO string
    };
  }

  private serializeServerAccessTokenRotated(event: ServerAccessTokenRotatedEvent): Record<string, unknown> {
    return {
      oldTokenId: event.oldTokenId.toString(), // AccessTokenId → string
      newTokenId: event.newTokenId.toString(), // AccessTokenId → string
      rotatedAt: event.rotatedAt.toISOString(), // Date → ISO string
      rotatedBy: event.rotatedBy ?? null, // string | undefined → string | null
    };
  }

  private serializeServerAccessTokenReactivated(event: ServerAccessTokenReactivatedEvent): Record<string, unknown> {
    return {
      tokenId: event.tokenId.toString(), // AccessTokenId → string
      reactivatedAt: event.reactivatedAt.toISOString(), // Date → ISO string
    };
  }

  // ===== ERINNERUNG SERIALIZERS =====

  private serializeErinnerungErstellt(event: ErinnerungErstelltEvent): Record<string, unknown> {
    return {
      erinnerungId: event.erinnerungId.toString(), // ErinnerungId → string
      einsatzId: event.einsatzId.toString(), // EinsatzId → string
      titel: event.titel, // Already primitive string
      faelligAm: event.faelligAm.toISOString(), // Date → ISO string
      erstelltVon: event.erstelltVon.toString(), // UserId → string
    };
  }

  private serializeErinnerungAktualisiert(event: ErinnerungAktualisiertEvent): Record<string, unknown> {
    return {
      erinnerungId: event.erinnerungId.toString(), // ErinnerungId → string
      einsatzId: event.einsatzId.toString(), // EinsatzId → string
      aenderungen: {
        titel: event.aenderungen.titel, // string | undefined
        beschreibung: event.aenderungen.beschreibung, // string | null | undefined
        faelligAm: event.aenderungen.faelligAm?.toISOString(), // Date → ISO string | undefined
      },
      aktualisierVon: event.aktualisierVon.toString(), // UserId → string
      titel: event.titel, // Already primitive string (aktueller Titel)
    };
  }

  private serializeErinnerungGeloescht(event: ErinnerungGeloeschtEvent): Record<string, unknown> {
    return {
      erinnerungId: event.erinnerungId.toString(), // ErinnerungId → string
      einsatzId: event.einsatzId.toString(), // EinsatzId → string
      titel: event.titel, // Already primitive string
      geloeschtVon: event.geloeschtVon.toString(), // UserId → string
    };
  }

  private serializeErinnerungAusgeloest(event: ErinnerungAusgeloestEvent): Record<string, unknown> {
    return {
      erinnerungId: event.erinnerungId.toString(), // ErinnerungId → string
      einsatzId: event.einsatzId.toString(), // EinsatzId → string
      ausgeloestAm: event.ausgeloestAm.toISOString(), // Date → ISO string
      titel: event.titel, // Already primitive string
      erstelltVon: event.erstelltVon.toString(), // UserId → string
    };
  }

  private serializeErinnerungAcknowledged(event: ErinnerungAcknowledgedEvent): Record<string, unknown> {
    return {
      erinnerungId: event.erinnerungId.toString(), // ErinnerungId → string
      einsatzId: event.einsatzId.toString(), // EinsatzId → string
      acknowledgedAm: event.acknowledgedAm.toISOString(), // Date → ISO string
      acknowledgedBy: event.acknowledgedBy.toString(), // UserId → string
      titel: event.titel, // Already primitive string
    };
  }

  /**
   * Serialisiert ErinnerungSnoozedEvent (Story 2.1).
   */
  private serializeErinnerungSnoozed(event: ErinnerungSnoozedEvent): Record<string, unknown> {
    return {
      erinnerungId: event.erinnerungId.toString(), // ErinnerungId → string
      einsatzId: event.einsatzId.toString(), // EinsatzId → string
      snoozedAt: event.snoozedAt.toISOString(), // Date → ISO string
      snoozedUntil: event.snoozedUntil.toISOString(), // Date → ISO string
      snoozedBy: event.snoozedBy.toString(), // UserId → string
      snoozeMinutes: event.snoozeMinutes, // Already primitive number
      snoozeCount: event.snoozeCount, // Already primitive number
      titel: event.titel, // Already primitive string
    };
  }

  /**
   * Serialisiert ErinnerungRetriggeredEvent (Story 2.2).
   */
  private serializeErinnerungRetriggered(event: ErinnerungRetriggeredEvent): Record<string, unknown> {
    return {
      erinnerungId: event.erinnerungId.toString(), // ErinnerungId → string
      einsatzId: event.einsatzId.toString(), // EinsatzId → string
      retriggeredAm: event.retriggeredAm.toISOString(), // Date → ISO string
      titel: event.titel, // Already primitive string
      erstelltVon: event.erstelltVon.toString(), // UserId → string
      snoozeCount: event.snoozeCount, // Already primitive number
      previousSnoozedAt: event.previousSnoozedAt?.toISOString() ?? null, // Date | null → ISO string | null
    };
  }

  /**
   * Serialisiert ErinnerungErledigtEvent (Story 2.5).
   */
  private serializeErinnerungErledigt(event: ErinnerungErledigtEvent): Record<string, unknown> {
    return {
      erinnerungId: event.erinnerungId.toString(), // ErinnerungId → string
      einsatzId: event.einsatzId.toString(), // EinsatzId → string
      erledigtAm: event.erledigtAm.toISOString(), // Date → ISO string
      erledigtBy: event.erledigtBy.toString(), // UserId → string
      titel: event.titel, // Already primitive string
      erledigungsNotiz: event.erledigungsNotiz, // string | null
    };
  }
}
