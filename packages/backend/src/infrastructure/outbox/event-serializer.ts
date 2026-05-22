import { Injectable } from '@nestjs/common';
import type { DomainEvent } from '@domain/common/domain-event';
import type { EinsatzCreatedEvent } from '@domain/events/einsatz-created.event';
import type { EinsatzUpdatedEvent } from '@domain/events/einsatz-updated.event';
import type { EinsatzStatusChangedEvent } from '@domain/events/einsatz-status-changed.event';
import type { EinsatzCompletedEvent } from '@domain/events/einsatz-completed.event';
import type { EinsatzArchivedEvent } from '@domain/events/einsatz-archived.event';
import type { EtbCreatedEvent } from '@domain/events/etb-created.event';
import type { EintragAddedEvent } from '@domain/events/eintrag-added.event';
import type { EintragKorrigiertEvent } from '@domain/events/eintrag-korrigiert.event';
import type { EintragUpdatedEvent } from '@domain/events/eintrag-updated.event';
import type { EintragDeletedEvent } from '@domain/events/eintrag-deleted.event';
import type { EtbLockedEvent } from '@domain/events/etb-locked.event';
import type { LagekarteCreatedEvent } from '@domain/events/lagekarte-created.event';
import type { PoiAddedEvent } from '@domain/events/poi-added.event';
import type { PoiRemovedEvent } from '@domain/events/poi-removed.event';
import type { PoiPositionUpdatedEvent } from '@domain/events/poi-position-updated.event';
import type { LagekarteStateGeaendertEvent } from '@domain/events/lagekarte-state-geaendert.event';
import type { UserCreatedEvent } from '@domain/events/user-created.event';
import type { UserDeletedEvent } from '@domain/events/user-deleted.event';
import type { UserRoleChangedEvent } from '@domain/events/user-role-changed.event';
import type { PermissionGrantedEvent } from '@domain/events/permission-granted.event';
import type { PermissionRevokedEvent } from '@domain/events/permission-revoked.event';
import type { QualifikationCreatedEvent } from '@domain/kraefte/events/qualifikation-created.event';
import type { QualifikationUpdatedEvent } from '@domain/kraefte/events/qualifikation-updated.event';
import type { FahrzeugtypCreatedEvent } from '@domain/kraefte/events/fahrzeugtyp-created.event';
import type { FahrzeugtypUpdatedEvent } from '@domain/kraefte/events/fahrzeugtyp-updated.event';
import type { EinsatzPersonHinzugefuegtEvent } from '@domain/kraefte/events/einsatz-person-hinzugefuegt.event';
import type { FahrzeugErfasstEvent } from '@domain/kraefte/events/fahrzeug-erfasst.event';
import type { FahrzeugEinheitZugewiesenEvent } from '@domain/kraefte/events/fahrzeug-einheit-zugewiesen.event';
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
import type { InviteCodeUsedEvent } from '@domain/events/invite-code-used.event';
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
import type { ErinnerungAssignedEvent } from '@domain/events/erinnerung-assigned.event';
import type { ErinnerungEskaliertEvent } from '@domain/events/erinnerung-eskaliert.event';
import type { ErinnerungIntensiviertEvent } from '@domain/events/erinnerung-intensiviert.event';
import type { WiederkehrendeInstanzErstelltEvent } from '@domain/events/wiederkehrende-instanz-erstellt.event';
import type { ErinnerungSerieGestopptEvent } from '@domain/events/erinnerung-serie-gestoppt.event';
import type { FuehrungsrhythmusTemplateErstelltEvent } from '@domain/fuehrungsrhythmus/events/fuehrungsrhythmus-template-erstellt.event';
import type { FuehrungsrhythmusTemplateGeloeschtEvent } from '@domain/fuehrungsrhythmus/events/fuehrungsrhythmus-template-geloescht.event';
import type { FuehrungsrhythmusAktiviertEvent } from '@domain/fuehrungsrhythmus/events/fuehrungsrhythmus-aktiviert.event';
import type { FuehrungsrhythmusTemplateAktualisiertEvent } from '@domain/fuehrungsrhythmus/events/fuehrungsrhythmus-template-aktualisiert.event';
import type { NotizErstelltEvent } from '@domain/notiz/events/notiz-erstellt.event';
import type { NotizAktualisiertEvent } from '@domain/notiz/events/notiz-aktualisiert.event';
import type { NotizGeloeschtEvent } from '@domain/notiz/events/notiz-geloescht.event';
import type { KategorieErstelltEvent } from '@domain/kategorie/events/kategorie-erstellt.event';
import type { KategorieGeloeschtEvent } from '@domain/kategorie/events/kategorie-geloescht.event';
import type { BefehlErstelltEvent } from '@domain/events/befehl-erstellt.event';
import type { BefehlZugestelltEvent } from '@domain/events/befehl-zugestellt.event';
import type { BefehlStatusGeaendertEvent } from '@domain/events/befehl-status-geaendert.event';
import type { BefehlKommentarHinzugefuegtEvent } from '@domain/events/befehl-kommentar-hinzugefuegt.event';
import type { BefehlQuittiertEvent } from '@domain/events/befehl-quittiert.event';
import type { RolleGeaendertEvent } from '@domain/events/rolle-geaendert.event';
import type { BefehlAnonymisiertEvent } from '@domain/events/befehl-anonymisiert.event';
import type { BefehlGeloeschtEvent } from '@domain/events/befehl-geloescht.event';
import type { AufbewahrungsKonfigurationGeaendertEvent } from '@domain/events/aufbewahrungs-konfiguration-geaendert.event';
import type { SystemWarnungEvent } from '@domain/events/system-warnung.event';
import type { OperativeRoleChangedEvent } from '@domain/events/operative-role-changed.event';
import type { StammpersonAssignedEvent } from '@domain/events/stammperson-assigned.event';
import type { EinsatzBeitrittsanfrageErstelltEvent } from '@domain/events/einsatz-beitrittsanfrage-erstellt.event';
import type { EinsatzBeitrittsanfrageEntschiedenEvent } from '@domain/events/einsatz-beitrittsanfrage-entschieden.event';
import type { EinheitErstelltEvent } from '@domain/kraefte/events/einheit-erstellt.event';
import type { EinheitStatusGeaendertEvent } from '@domain/kraefte/events/einheit-status-geaendert.event';
import type { EinheitAufgeloestEvent } from '@domain/kraefte/events/einheit-aufgeloest.event';
import type { PersonZuEinheitZugewiesenEvent } from '@domain/kraefte/events/person-zu-einheit-zugewiesen.event';
import type { PersonVonEinheitEntferntEvent } from '@domain/kraefte/events/person-von-einheit-entfernt.event';
import type { GefahrenmatrixAktualisiertEvent } from '@domain/gefahr/events/gefahrenmatrix-aktualisiert.event';
import type { GefahrenzoneErstelltEvent } from '@domain/gefahr/events/gefahrenzone-erstellt.event';
import type { GefahrenzoneGeometryGeaendertEvent } from '@domain/gefahr/events/gefahrenzone-geometry-geaendert.event';
import type { GefahrenzoneGeloeschtEvent } from '@domain/gefahr/events/gefahrenzone-geloescht.event';
import type { ZeichenErstelltEvent } from '@domain/taktische-zeichen/events/zeichen-erstellt.event';
import type { ZeichenPlatziertEvent } from '@domain/taktische-zeichen/events/zeichen-platziert.event';
import type { ZeichenVerschobenEvent } from '@domain/taktische-zeichen/events/zeichen-verschoben.event';
import type { ZeichenEntferntEvent } from '@domain/taktische-zeichen/events/zeichen-entfernt.event';

// Funkkanal Events (Issue #407)
import type { FunkkanalErstelltEvent } from '@domain/events/funkkanal-erstellt.event';
import type { FunkkanalGeaendertEvent } from '@domain/events/funkkanal-geaendert.event';
import type { FunkkanalArchiviertEvent } from '@domain/events/funkkanal-archiviert.event';
import type { FunkkanalReihenfolgeGeaendertEvent } from '@domain/events/funkkanal-reihenfolge-geaendert.event';
import type { FunkkanalZuordnungErstelltEvent } from '@domain/events/funkkanal-zuordnung-erstellt.event';
import type { FunkkanalZuordnungEntferntEvent } from '@domain/events/funkkanal-zuordnung-entfernt.event';
import type { NotfallAlertRequestedEvent } from '@domain/events/notfall-alert-requested.event';
// Patient Events (Story 1.2/1.3, Architecture §D-6)
import type { PatientErfasst } from '@domain/patienten/events/patient-erfasst.event';
import type { PatientGesichtet } from '@domain/patienten/events/patient-gesichtet.event';
import type { PatientSichtungAktualisiert } from '@domain/patienten/events/patient-sichtung-aktualisiert.event';
// Eigenschutz Events (Story 2.1+)
import type { GefaehrdungsbeurteilungErstelltEvent } from '@domain/eigenschutz/events/gefaehrdungsbeurteilung-erstellt.event';
import type { GefaehrdungsbeurteilungAktualisiertEvent } from '@domain/eigenschutz/events/gefaehrdungsbeurteilung-aktualisiert.event';
import type { SicherheitsregelAusgerufenEvent } from '@domain/eigenschutz/events/sicherheitsregel-ausgerufen.event';
import type { SicherheitsregelQuittiertEvent } from '@domain/eigenschutz/events/sicherheitsregel-quittiert.event';
import type { PsaProfilGeaendertEvent } from '@domain/eigenschutz/events/psa-profil-geaendert.event';
import type { QuittungAbgegebenEvent } from '@domain/eigenschutz/events/quittung-abgegeben.event';
import type { LueckeGemeldetEvent } from '@domain/eigenschutz/events/luecke-gemeldet.event';
import type { QuittungUeberfaelligEvent } from '@domain/eigenschutz/events/quittung-ueberfaellig.event';
import type { KonfliktErkanntEvent, SyncConflictEntityType } from '@domain/eigenschutz/events/konflikt-erkannt.event';
import type { KonfliktAufgeloestEvent, SyncConflictResolution } from '@domain/eigenschutz/events/konflikt-aufgeloest.event';
import type { SicherungspostenEingerichtetEvent } from '@domain/eigenschutz/events/sicherungsposten-eingerichtet.event';
import type { SicherungspostenAktualisiertEvent, SicherungspostenFieldKey } from '@domain/eigenschutz/events/sicherungsposten-aktualisiert.event';
import type { VorfallGemeldetEvent } from '@domain/eigenschutz/events/vorfall-gemeldet.event';
import type { VorfallGeschlossenEvent } from '@domain/eigenschutz/events/vorfall-geschlossen.event';
import type { VorfallExportiertEvent, VorfallExportFormat } from '@domain/eigenschutz/events/vorfall-exportiert.event';

// Story 3.9 — Modul-Konstante (statt Funktionsrumpf-Allokation pro
// Serialisierungs-Aufruf, Code-Review P12).
const KONFLIKT_ERKANNT_ALLOWED_ENTITY_TYPES: ReadonlyArray<SyncConflictEntityType> = ['PSA_PROFIL_ZUWEISUNG', 'GEFAEHRDUNGSBEURTEILUNG_ITEM'];

// Story 3.10 — Modul-Konstanten für KonfliktAufgeloest (Pattern Story 3.9 P12).
const KONFLIKT_AUFGELOEST_ALLOWED_ENTITY_TYPES: ReadonlyArray<SyncConflictEntityType> = ['PSA_PROFIL_ZUWEISUNG', 'GEFAEHRDUNGSBEURTEILUNG_ITEM'];
const KONFLIKT_AUFGELOEST_ALLOWED_RESOLUTIONS: ReadonlyArray<SyncConflictResolution> = ['SERVER_WINS', 'LOCAL_WINS', 'MERGED'];
const VORFALL_EXPORT_ALLOWED_FORMATS: ReadonlyArray<VorfallExportFormat> = ['pdf', 'json'];

// Alarmierung Events (Issue #408)
import type { AlarmierungAbgeschlossenEvent } from '@domain/events/alarmierung-abgeschlossen.event';
import type { AlarmierungEmpfaengerEntferntEvent } from '@domain/events/alarmierung-empfaenger-entfernt.event';
import type { AlarmierungEmpfaengerHinzugefuegtEvent } from '@domain/events/alarmierung-empfaenger-hinzugefuegt.event';
import type { AlarmierungErstelltEvent } from '@domain/events/alarmierung-erstellt.event';
import type { AlarmierungZeitpunktFmsGesetztEvent } from '@domain/events/alarmierung-zeitpunkt-fms-gesetzt.event';
import type { AlarmierungZeitpunktKorrigiertEvent } from '@domain/events/alarmierung-zeitpunkt-korrigiert.event';
import type { NachalarmierungErstelltEvent } from '@domain/events/nachalarmierung-erstellt.event';

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
 * const event = new EinsatzCreatedEvent(einsatzId, createdBy, 'Wohnungsbrand', 'E2026-001');
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
      case 'etb.eintrag_korrigiert':
        return this.serializeEintragKorrigiert(event as unknown as EintragKorrigiertEvent);
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
      case 'lagekarte.state_geaendert':
        return this.serializeLagekarteStateGeaendert(event as unknown as LagekarteStateGeaendertEvent);

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

      // ===== FAHRZEUGTYP EVENTS =====
      case 'FahrzeugtypCreated':
        return this.serializeFahrzeugtypCreated(event as unknown as FahrzeugtypCreatedEvent);
      case 'FahrzeugtypUpdated':
        return this.serializeFahrzeugtypUpdated(event as unknown as FahrzeugtypUpdatedEvent);

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
      case 'einsatz_fahrzeug.einheit_zugewiesen':
        return this.serializeFahrzeugEinheitZugewiesen(event as unknown as FahrzeugEinheitZugewiesenEvent);

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
      case 'invite_code.used':
        return this.serializeInviteCodeUsed(event as unknown as InviteCodeUsedEvent);
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
      case 'erinnerung.assigned':
        return this.serializeErinnerungAssigned(event as unknown as ErinnerungAssignedEvent);

      // ===== ESKALATION/INTENSIVIERUNG EVENTS (Story 4.4/4.5) =====
      case 'erinnerung.eskaliert':
        return this.serializeErinnerungEskaliert(event as unknown as ErinnerungEskaliertEvent);
      case 'erinnerung.intensiviert':
        return this.serializeErinnerungIntensiviert(event as unknown as ErinnerungIntensiviertEvent);

      // ===== WIEDERKEHRENDE ERINNERUNG EVENTS (Story 6.4) =====
      case 'erinnerung.wiederkehrende-instanz-erstellt':
        return this.serializeWiederkehrendeInstanzErstellt(event as unknown as WiederkehrendeInstanzErstelltEvent);
      case 'erinnerung.serie-gestoppt':
        return this.serializeErinnerungSerieGestoppt(event as unknown as ErinnerungSerieGestopptEvent);

      // ===== FUEHRUNGSRHYTHMUS TEMPLATE EVENTS (Story 6.6) =====
      case 'fuehrungsrhythmus-template.erstellt':
        return this.serializeFuehrungsrhythmusTemplateErstellt(event as unknown as FuehrungsrhythmusTemplateErstelltEvent);
      case 'fuehrungsrhythmus-template.geloescht':
        return this.serializeFuehrungsrhythmusTemplateGeloescht(event as unknown as FuehrungsrhythmusTemplateGeloeschtEvent);
      case 'fuehrungsrhythmus-template.aktiviert':
        return this.serializeFuehrungsrhythmusAktiviert(event as unknown as FuehrungsrhythmusAktiviertEvent);
      case 'fuehrungsrhythmus-template.aktualisiert':
        return this.serializeFuehrungsrhythmusTemplateAktualisiert(event as unknown as FuehrungsrhythmusTemplateAktualisiertEvent);

      // ===== NOTIZ EVENTS (Story 7.1) =====
      case 'notiz.erstellt':
        return this.serializeNotizErstellt(event as unknown as NotizErstelltEvent);
      case 'notiz.aktualisiert':
        return this.serializeNotizAktualisiert(event as unknown as NotizAktualisiertEvent);
      case 'notiz.geloescht':
        return this.serializeNotizGeloescht(event as unknown as NotizGeloeschtEvent);

      // ===== KATEGORIE EVENTS (Story 8.1) =====
      case 'kategorie.erstellt':
        return this.serializeKategorieErstellt(event as unknown as KategorieErstelltEvent);
      case 'kategorie.geloescht':
        return this.serializeKategorieGeloescht(event as unknown as KategorieGeloeschtEvent);

      // ===== BEFEHL EVENTS (Story 1.1) =====
      case 'befehl.erstellt':
        return this.serializeBefehlErstellt(event as unknown as BefehlErstelltEvent);
      case 'befehl.zugestellt':
        return this.serializeBefehlZugestellt(event as unknown as BefehlZugestelltEvent);
      case 'befehl.status_geaendert':
        return this.serializeBefehlStatusGeaendert(event as unknown as BefehlStatusGeaendertEvent);
      case 'befehl.kommentar_hinzugefuegt':
        return this.serializeBefehlKommentarHinzugefuegt(event as unknown as BefehlKommentarHinzugefuegtEvent);
      case 'befehl.quittiert':
        return this.serializeBefehlQuittiert(event as unknown as BefehlQuittiertEvent);

      // ===== EINSATZ ROLLE EVENTS (Story 5.4) =====
      case 'rolle.geaendert':
        return this.serializeRolleGeaendert(event as unknown as RolleGeaendertEvent);

      // ===== DSGVO EVENTS (Story 5.5) =====
      case 'befehl.anonymisiert':
        return this.serializeBefehlAnonymisiert(event as unknown as BefehlAnonymisiertEvent);
      case 'befehl.geloescht':
        return this.serializeBefehlGeloescht(event as unknown as BefehlGeloeschtEvent);
      case 'aufbewahrung.konfiguration_geaendert':
        return this.serializeAufbewahrungsKonfigurationGeaendert(event as unknown as AufbewahrungsKonfigurationGeaendertEvent);

      // ===== SYSTEM MONITORING EVENTS (Story 5.6) =====
      case 'system.warnung':
        return this.serializeSystemWarnung(event as unknown as SystemWarnungEvent);

      // ===== OPERATIVE ROLLEN EVENTS (Issue #98) =====
      case 'operative_rolle.changed':
        return this.serializeOperativeRoleChanged(event as unknown as OperativeRoleChangedEvent);
      case 'operative_rolle.stammperson_assigned':
        return this.serializeStammpersonAssigned(event as unknown as StammpersonAssignedEvent);

      // ===== BEITRITTSANFRAGE EVENTS (Issue #98) =====
      case 'beitrittsanfrage.erstellt':
        return this.serializeBeitrittsanfrageErstellt(event as unknown as EinsatzBeitrittsanfrageErstelltEvent);
      case 'beitrittsanfrage.entschieden':
        return this.serializeBeitrittsanfrageEntschieden(event as unknown as EinsatzBeitrittsanfrageEntschiedenEvent);

      // ===== EINSATZ EINHEIT EVENTS (Issue #411) =====
      case 'einsatz_einheit.erstellt':
        return this.serializeEinheitErstellt(event as unknown as EinheitErstelltEvent);
      case 'einsatz_einheit.status_geaendert':
        return this.serializeEinheitStatusGeaendert(event as unknown as EinheitStatusGeaendertEvent);
      case 'einsatz_einheit.aufgeloest':
        return this.serializeEinheitAufgeloest(event as unknown as EinheitAufgeloestEvent);
      case 'einsatz_einheit.person_zugewiesen':
        return this.serializePersonZuEinheitZugewiesen(event as unknown as PersonZuEinheitZugewiesenEvent);
      case 'einsatz_einheit.person_entfernt':
        return this.serializePersonVonEinheitEntfernt(event as unknown as PersonVonEinheitEntferntEvent);

      // ===== GEFAHRENMATRIX EVENTS (Issue #414) =====
      case 'gefahrenmatrix.aktualisiert':
        return this.serializeGefahrenmatrixAktualisiert(event as unknown as GefahrenmatrixAktualisiertEvent);

      // ===== GEFAHRENZONE EVENTS (Issue #627) =====
      case 'gefahrenzone.erstellt':
        return this.serializeGefahrenzoneErstellt(event as unknown as GefahrenzoneErstelltEvent);
      case 'gefahrenzone.geometry-geaendert':
        return this.serializeGefahrenzoneGeometryGeaendert(event as unknown as GefahrenzoneGeometryGeaendertEvent);
      case 'gefahrenzone.geloescht':
        return this.serializeGefahrenzoneGeloescht(event as unknown as GefahrenzoneGeloeschtEvent);

      // ===== TAKTISCHE ZEICHEN EVENTS (Issue #636) =====
      case 'taktisches_zeichen.erstellt':
        return this.serializeZeichenErstellt(event as unknown as ZeichenErstelltEvent);
      case 'taktisches_zeichen.platziert':
        return this.serializeZeichenPlatziert(event as unknown as ZeichenPlatziertEvent);
      case 'taktisches_zeichen.verschoben':
        return this.serializeZeichenVerschoben(event as unknown as ZeichenVerschobenEvent);
      case 'taktisches_zeichen.aktualisiert':
        return this.serializeZeichenErstellt(event as unknown as ZeichenErstelltEvent);
      case 'taktisches_zeichen.entfernt':
        return this.serializeZeichenEntfernt(event as unknown as ZeichenEntferntEvent);

      // ===== FUNKKANAL EVENTS (Issue #407) =====
      case 'funkkanal.erstellt':
        return this.serializeFunkkanalErstellt(event as unknown as FunkkanalErstelltEvent);
      case 'funkkanal.geaendert':
        return this.serializeFunkkanalGeaendert(event as unknown as FunkkanalGeaendertEvent);
      case 'funkkanal.archiviert':
        return this.serializeFunkkanalArchiviert(event as unknown as FunkkanalArchiviertEvent);
      case 'funkkanal.reihenfolge_geaendert':
        return this.serializeFunkkanalReihenfolgeGeaendert(event as unknown as FunkkanalReihenfolgeGeaendertEvent);
      case 'funkkanal.zuordnung_erstellt':
        return this.serializeFunkkanalZuordnungErstellt(event as unknown as FunkkanalZuordnungErstelltEvent);
      case 'funkkanal.zuordnung_entfernt':
        return this.serializeFunkkanalZuordnungEntfernt(event as unknown as FunkkanalZuordnungEntferntEvent);
      case 'funk.notfall_alert_requested':
        return this.serializeNotfallAlertRequested(event as unknown as NotfallAlertRequestedEvent);

      // ===== ALARMIERUNG EVENTS (Issue #408) =====
      case 'alarmierung.erstellt':
        return this.serializeAlarmierungErstellt(event as unknown as AlarmierungErstelltEvent);
      case 'alarmierung.empfaenger_hinzugefuegt':
        return this.serializeAlarmierungEmpfaengerHinzugefuegt(event as unknown as AlarmierungEmpfaengerHinzugefuegtEvent);
      case 'alarmierung.empfaenger_entfernt':
        return this.serializeAlarmierungEmpfaengerEntfernt(event as unknown as AlarmierungEmpfaengerEntferntEvent);
      case 'alarmierung.zeitpunkt_korrigiert':
        return this.serializeAlarmierungZeitpunktKorrigiert(event as unknown as AlarmierungZeitpunktKorrigiertEvent);
      case 'alarmierung.zeitpunkt_fms_gesetzt':
        return this.serializeAlarmierungZeitpunktFmsGesetzt(event as unknown as AlarmierungZeitpunktFmsGesetztEvent);
      case 'alarmierung.abgeschlossen':
        return this.serializeAlarmierungAbgeschlossen(event as unknown as AlarmierungAbgeschlossenEvent);
      case 'alarmierung.nachalarmierung_erstellt':
        return this.serializeNachalarmierungErstellt(event as unknown as NachalarmierungErstelltEvent);

      // ===== PATIENT EVENTS (Story 1.2/1.3, Architecture §D-6) =====
      case 'patient.erfasst':
        return this.serializePatientErfasst(event as unknown as PatientErfasst);
      case 'patient.gesichtet':
        return this.serializePatientGesichtet(event as unknown as PatientGesichtet);
      case 'patient.sichtung-aktualisiert':
        return this.serializePatientSichtungAktualisiert(event as unknown as PatientSichtungAktualisiert);

      // ===== EIGENSCHUTZ EVENTS (Story 2.1+) =====
      case 'eigenschutz.gefaehrdungsbeurteilung_erstellt':
        return this.serializeGefaehrdungsbeurteilungErstellt(event as unknown as GefaehrdungsbeurteilungErstelltEvent);
      case 'eigenschutz.gefaehrdungsbeurteilung_aktualisiert':
        return this.serializeGefaehrdungsbeurteilungAktualisiert(event as unknown as GefaehrdungsbeurteilungAktualisiertEvent);
      case 'eigenschutz.sicherheitsregel_ausgerufen':
        return this.serializeSicherheitsregelAusgerufen(event as unknown as SicherheitsregelAusgerufenEvent);
      case 'eigenschutz.sicherheitsregel_quittiert':
        return this.serializeSicherheitsregelQuittiert(event as unknown as SicherheitsregelQuittiertEvent);
      case 'eigenschutz.psa_profil_geaendert':
        return this.serializePsaProfilGeaendert(event as unknown as PsaProfilGeaendertEvent);
      case 'eigenschutz.quittung_abgegeben':
        return this.serializeQuittungAbgegeben(event as unknown as QuittungAbgegebenEvent);
      case 'eigenschutz.luecke_gemeldet':
        return this.serializeLueckeGemeldet(event as unknown as LueckeGemeldetEvent);
      case 'eigenschutz.quittung_ueberfaellig':
        return this.serializeQuittungUeberfaellig(event as unknown as QuittungUeberfaelligEvent);
      case 'eigenschutz.konflikt_erkannt':
        return this.serializeKonfliktErkannt(event as unknown as KonfliktErkanntEvent);
      case 'eigenschutz.konflikt_aufgeloest':
        return this.serializeKonfliktAufgeloest(event as unknown as KonfliktAufgeloestEvent);
      case 'eigenschutz.sicherungsposten_eingerichtet':
        return this.serializeSicherungspostenEingerichtet(event as unknown as SicherungspostenEingerichtetEvent);
      case 'eigenschutz.sicherungsposten_aktualisiert':
        return this.serializeSicherungspostenAktualisiert(event as unknown as SicherungspostenAktualisiertEvent);
      case 'eigenschutz.vorfall_gemeldet':
        return this.serializeVorfallGemeldet(event as unknown as VorfallGemeldetEvent);
      case 'eigenschutz.vorfall_geschlossen':
        return this.serializeVorfallGeschlossen(event as unknown as VorfallGeschlossenEvent);
      case 'eigenschutz.vorfall_exportiert':
        return this.serializeVorfallExportiert(event as unknown as VorfallExportiertEvent);

      default:
        throw new Error(`Unknown event type: ${eventName}. EventSerializer needs to be updated.`);
    }
  }

  // ... (previous serializers) ...

  /**
   * Serialisiert ErinnerungEskaliertEvent (Story 4.4).
   */
  private serializeErinnerungEskaliert(event: ErinnerungEskaliertEvent): Record<string, unknown> {
    return {
      erinnerungId: event.erinnerungId.toString(),
      einsatzId: event.einsatzId.toString(),
      eskaliertAm: event.eskaliertAm.toISOString(),
      titel: event.titel,
      erstelltVon: event.erstelltVon.toString(),
      eskalationsPersonId: event.eskalationsPersonId?.toString() ?? null,
    };
  }

  /**
   * Serialisiert ErinnerungIntensiviertEvent (Story 4.4).
   */
  private serializeErinnerungIntensiviert(event: ErinnerungIntensiviertEvent): Record<string, unknown> {
    return {
      erinnerungId: event.erinnerungId.toString(),
      einsatzId: event.einsatzId.toString(),
      intensiviertAm: event.intensiviertAm.toISOString(),
      titel: event.titel,
      erstelltVon: event.erstelltVon.toString(),
    };
  }

  /**
   * Serialisiert WiederkehrendeInstanzErstelltEvent (Story 6.4).
   */
  private serializeWiederkehrendeInstanzErstellt(event: WiederkehrendeInstanzErstelltEvent): Record<string, unknown> {
    return {
      erinnerungId: event.erinnerungId.toString(),
      parentId: event.parentId.toString(),
      einsatzId: event.einsatzId.toString(),
      titel: event.titel,
      faelligAm: event.faelligAm.toISOString(),
      sequenceNumber: event.sequenceNumber,
    };
  }

  /**
   * Serialisiert ErinnerungSerieGestopptEvent (Story 6.5).
   */
  private serializeErinnerungSerieGestoppt(event: ErinnerungSerieGestopptEvent): Record<string, unknown> {
    return {
      erinnerungId: event.erinnerungId.toString(),
      einsatzId: event.einsatzId.toString(),
      titel: event.titel,
      totalErstellteInstanzen: event.totalErstellteInstanzen,
    };
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

  private serializeEintragKorrigiert(event: EintragKorrigiertEvent): Record<string, unknown> {
    return {
      etbId: event.etbId.value,
      korrekturEintragId: event.korrekturEintragId.value,
      originalEintragId: event.originalEintragId.value,
      sequenceNumber: event.sequenceNumber,
      text: event.text,
      createdBy: event.createdBy.value,
    };
  }

  private serializeEintragAdded(event: EintragAddedEvent): Record<string, unknown> {
    return {
      etbId: event.etbId.value,
      eintragId: event.eintragId.value,
      sequenceNumber: event.sequenceNumber, // Already primitive
      text: event.text,
      createdBy: event.createdBy.value,
      // Issue #407: Kontext + fachlicher Zeitpunkt für Notfall-Detection
      kontext: event.kontext,
      ereignisZeitpunkt: event.ereignisZeitpunkt?.toISOString(),
      absender: event.absender,
      empfaenger: event.empfaenger,
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

  private serializeLagekarteStateGeaendert(event: LagekarteStateGeaendertEvent): Record<string, unknown> {
    return {
      lagekarteId: event.lagekarteId.value,
      einsatzId: event.einsatzId.value,
      changedBy: event.changedBy.value,
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

  // ===== FAHRZEUGTYP SERIALIZERS =====

  private serializeFahrzeugtypCreated(event: FahrzeugtypCreatedEvent): Record<string, unknown> {
    return {
      fahrzeugtypId: event.fahrzeugtypId, // Already primitive string
      code: event.code,
      bezeichnung: event.bezeichnung,
      kategorie: event.kategorie,
      createdBy: event.createdBy,
    };
  }

  private serializeFahrzeugtypUpdated(event: FahrzeugtypUpdatedEvent): Record<string, unknown> {
    return {
      fahrzeugtypId: event.fahrzeugtypId, // Already primitive string
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

  private serializeInviteCodeUsed(event: InviteCodeUsedEvent): Record<string, unknown> {
    return {
      inviteCodeId: event.inviteCodeId, // Already primitive string
      code: event.code,
      usedAt: event.usedAt.toISOString(),
      newUseCount: event.newUseCount,
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
      assignedToId: event.assignedToId?.toString() ?? null, // Story 3.3: UserId | null → string | null
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

  /**
   * Serialisiert ErinnerungAssignedEvent (Story 3.4).
   */
  private serializeErinnerungAssigned(event: ErinnerungAssignedEvent): Record<string, unknown> {
    return {
      erinnerungId: event.erinnerungId.toString(), // ErinnerungId → string
      einsatzId: event.einsatzId.toString(), // EinsatzId → string
      assignedToId: event.assignedToId.toString(), // UserId → string
      assignedById: event.assignedById.toString(), // UserId → string
      titel: event.titel, // Already primitive string
      assignedAt: event.assignedAt.toISOString(), // Date → ISO string
    };
  }

  // ===== FUEHRUNGSRHYTHMUS TEMPLATE SERIALIZERS (Story 6.6) =====

  /**
   * Serialisiert FuehrungsrhythmusTemplateErstelltEvent (Story 6.6).
   */
  private serializeFuehrungsrhythmusTemplateErstellt(event: FuehrungsrhythmusTemplateErstelltEvent): Record<string, unknown> {
    return {
      templateId: event.templateId.toString(), // FuehrungsrhythmusTemplateId → string
      name: event.name, // Already primitive string
      eintraegeCount: event.eintraegeCount, // Already primitive number
      createdBy: event.createdBy.toString(), // UserId → string
    };
  }

  /**
   * Serialisiert FuehrungsrhythmusTemplateGeloeschtEvent (Story 6.6).
   */
  private serializeFuehrungsrhythmusTemplateGeloescht(event: FuehrungsrhythmusTemplateGeloeschtEvent): Record<string, unknown> {
    return {
      templateId: event.templateId.toString(), // FuehrungsrhythmusTemplateId → string
      name: event.name, // Already primitive string
      deletedBy: event.deletedBy.toString(), // UserId → string
    };
  }

  /**
   * Serialisiert FuehrungsrhythmusTemplateAktualisiertEvent (Story 6.8).
   */
  private serializeFuehrungsrhythmusTemplateAktualisiert(event: FuehrungsrhythmusTemplateAktualisiertEvent): Record<string, unknown> {
    return {
      templateId: event.templateId.toString(),
      name: event.name,
      aktualisiertVon: event.aktualisiertVon.toString(),
    };
  }

  /**
   * Serialisiert FuehrungsrhythmusAktiviertEvent (Story 6.7).
   */
  private serializeFuehrungsrhythmusAktiviert(event: FuehrungsrhythmusAktiviertEvent): Record<string, unknown> {
    return {
      templateId: event.templateId.toString(), // FuehrungsrhythmusTemplateId → string
      templateName: event.templateName, // Already primitive string
      einsatzId: event.einsatzId.toString(), // EinsatzId → string
      erstellteErinnerungIds: event.erstellteErinnerungIds.map((id) => id.toString()), // ErinnerungId[] → string[]
      aktiviertVon: event.aktiviertVon.toString(), // UserId → string
    };
  }

  // ===== NOTIZ SERIALIZERS (Story 7.1) =====

  /**
   * Serialisiert NotizErstelltEvent (Story 7.1).
   */
  private serializeNotizErstellt(event: NotizErstelltEvent): Record<string, unknown> {
    return {
      notizId: event.notizId.toString(), // NotizId → string
      einsatzId: event.einsatzId, // Already primitive string
      titel: event.titel, // Already primitive string
      erstelltVon: event.erstelltVon.toString(), // UserId → string
      istTeamsichtbar: event.istTeamsichtbar, // Already primitive boolean
    };
  }

  /**
   * Serialisiert NotizAktualisiertEvent (Story 7.3).
   */
  private serializeNotizAktualisiert(event: NotizAktualisiertEvent): Record<string, unknown> {
    return {
      notizId: event.notizId.toString(), // NotizId → string
      einsatzId: event.einsatzId, // Already primitive string
      titel: event.titel, // Already primitive string
      inhalt: event.inhalt, // string | null
      kategorie: event.kategorie, // string | null
      istTeamsichtbar: event.istTeamsichtbar, // Already primitive boolean
      aktualisiertVon: event.aktualisiertVon, // Already primitive string
    };
  }

  /**
   * Serialisiert NotizGeloeschtEvent (Story 7.4).
   */
  private serializeNotizGeloescht(event: NotizGeloeschtEvent): Record<string, unknown> {
    return {
      notizId: event.notizId.toString(), // NotizId → string
      einsatzId: event.einsatzId, // Already primitive string
      titel: event.titel, // Already primitive string
      geloeschtVon: event.geloeschtVon.toString(), // UserId → string
    };
  }

  // ===== KATEGORIE SERIALIZERS (Story 8.1) =====

  private serializeKategorieErstellt(event: KategorieErstelltEvent): Record<string, unknown> {
    return {
      kategorieId: event.kategorieId.toString(),
      einsatzId: event.einsatzId,
      name: event.name,
      farbe: event.farbe,
      erstelltVon: event.erstelltVon.toString(),
    };
  }

  private serializeKategorieGeloescht(event: KategorieGeloeschtEvent): Record<string, unknown> {
    return {
      kategorieId: event.kategorieId.toString(),
      einsatzId: event.einsatzId,
      name: event.name,
      geloeschtVon: event.geloeschtVon.toString(),
    };
  }

  // ===== BEFEHL SERIALIZERS (Story 1.1) =====

  private serializeBefehlErstellt(event: BefehlErstelltEvent): Record<string, unknown> {
    return {
      befehlId: event.befehlId.value,
      einsatzId: event.einsatzId.value,
      auftrag: event.auftrag,
      nummer: event.nummer,
      empfaenger: event.empfaenger,
      empfaengerIds: event.empfaengerIds,
    };
  }

  private serializeBefehlZugestellt(event: BefehlZugestelltEvent): Record<string, unknown> {
    return {
      befehlId: event.befehlId.value,
      empfaengerId: event.empfaengerId,
      zugestelltAm: event.zugestelltAm.toISOString(),
      einsatzId: event.einsatzId.value,
      empfaengerName: event.empfaengerName,
      nummer: event.nummer,
    };
  }

  private serializeBefehlStatusGeaendert(event: BefehlStatusGeaendertEvent): Record<string, unknown> {
    return {
      befehlId: event.befehlId.value,
      oldStatus: event.oldStatus.value,
      newStatus: event.newStatus.value,
      einsatzId: event.einsatzId.value,
      nummer: event.nummer,
      erstellerId: event.erstellerId?.value ?? null,
      befehlsgeberId: event.befehlsgeberId?.value ?? null,
      empfaengerIds: event.empfaengerIds ?? [],
    };
  }

  private serializeBefehlKommentarHinzugefuegt(event: BefehlKommentarHinzugefuegtEvent): Record<string, unknown> {
    return {
      befehlId: event.befehlId.value,
      kommentarId: event.kommentarId,
      authorId: event.authorId.value,
      text: event.text,
      isRueckfrage: event.isRueckfrage,
      parentId: event.parentId ?? null,
    };
  }

  private serializeBefehlQuittiert(event: BefehlQuittiertEvent): Record<string, unknown> {
    return {
      befehlId: event.befehlId.value,
      einsatzId: event.einsatzId.value,
      empfaengerId: event.empfaengerId.value,
      quittierungArt: event.quittierungArt,
      nummer: event.nummer,
      quittiertAm: event.quittiertAm.toISOString(),
      quittierungKommentar: event.quittierungKommentar ?? null,
      erstellerId: event.erstellerId?.value ?? null,
      befehlsgeberId: event.befehlsgeberId?.value ?? null,
    };
  }

  // ===== EINSATZ ROLLE SERIALIZERS (Story 5.4) =====

  private serializeRolleGeaendert(event: RolleGeaendertEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId,
      userId: event.userId,
      userName: event.userName,
      alteRolle: event.alteRolle,
      neueRolle: event.neueRolle,
      aenderungDurch: event.aenderungDurch,
      aenderungDurchName: event.aenderungDurchName,
    };
  }

  // ===== DSGVO SERIALIZERS (Story 5.5) =====

  private serializeBefehlAnonymisiert(event: BefehlAnonymisiertEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId.value,
      befehlCount: event.befehlCount,
      empfaengerCount: event.empfaengerCount,
      kommentarCount: event.kommentarCount,
      anonymisiertAm: event.anonymisiertAm.toISOString(),
    };
  }

  private serializeBefehlGeloescht(event: BefehlGeloeschtEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId.value,
      befehlCount: event.befehlCount,
      geloeschtAm: event.geloeschtAm.toISOString(),
    };
  }

  private serializeAufbewahrungsKonfigurationGeaendert(event: AufbewahrungsKonfigurationGeaendertEvent): Record<string, unknown> {
    return {
      alteFristJahre: event.alteFristJahre,
      neueFristJahre: event.neueFristJahre,
      alteFreigabeperiodeTage: event.alteFreigabeperiodeTage,
      neueFreigabeperiodeTage: event.neueFreigabeperiodeTage,
      automatischLoeschenAktiv: event.automatischLoeschenAktiv,
      geaendertVon: event.geaendertVon,
    };
  }

  // ===== SYSTEM MONITORING SERIALIZERS (Story 5.6) =====

  private serializeSystemWarnung(event: SystemWarnungEvent): Record<string, unknown> {
    return {
      warnungTyp: event.warnungTyp,
      schwellwert: event.schwellwert,
      aktuellerWert: event.aktuellerWert,
      timestamp: event.timestamp.toISOString(),
    };
  }

  // ===== OPERATIVE ROLLEN SERIALIZERS (Issue #98) =====

  private serializeOperativeRoleChanged(event: OperativeRoleChangedEvent): Record<string, unknown> {
    return {
      userId: event.userId,
      oldRole: event.oldRole,
      newRole: event.newRole,
      changedBy: event.changedBy,
    };
  }

  private serializeStammpersonAssigned(event: StammpersonAssignedEvent): Record<string, unknown> {
    return {
      userId: event.userId,
      stammpersonId: event.stammpersonId,
      assignedBy: event.assignedBy,
    };
  }

  // ===== BEITRITTSANFRAGE SERIALIZERS (Issue #98) =====

  private serializeBeitrittsanfrageErstellt(event: EinsatzBeitrittsanfrageErstelltEvent): Record<string, unknown> {
    return {
      anfrageId: event.anfrageId,
      einsatzId: event.einsatzId,
      userId: event.userId,
    };
  }

  private serializeBeitrittsanfrageEntschieden(event: EinsatzBeitrittsanfrageEntschiedenEvent): Record<string, unknown> {
    return {
      anfrageId: event.anfrageId,
      einsatzId: event.einsatzId,
      userId: event.userId,
      decision: event.decision,
      resolvedBy: event.resolvedBy,
    };
  }

  // ===== EINSATZ EINHEIT SERIALIZERS (Issue #411) =====

  /**
   * Serialisiert EinheitErstelltEvent.
   */
  private serializeEinheitErstellt(event: EinheitErstelltEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId,
      einheitId: event.einheitId,
      name: event.name,
      typ: event.typ,
      funktion: event.funktion,
      createdBy: event.createdBy,
    };
  }

  /**
   * Serialisiert EinheitStatusGeaendertEvent.
   */
  private serializeEinheitStatusGeaendert(event: EinheitStatusGeaendertEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId,
      einheitId: event.einheitId,
      name: event.name,
      alterStatus: event.alterStatus,
      neuerStatus: event.neuerStatus,
      updatedBy: event.updatedBy,
    };
  }

  /**
   * Serialisiert EinheitAufgeloestEvent.
   */
  private serializeEinheitAufgeloest(event: EinheitAufgeloestEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId,
      einheitId: event.einheitId,
      name: event.name,
      updatedBy: event.updatedBy,
    };
  }

  /**
   * Serialisiert PersonZuEinheitZugewiesenEvent.
   */
  private serializePersonZuEinheitZugewiesen(event: PersonZuEinheitZugewiesenEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId,
      einheitId: event.einheitId,
      einheitName: event.einheitName,
      personId: event.personId,
      personVorname: event.personVorname,
      personNachname: event.personNachname,
      createdBy: event.createdBy,
    };
  }

  /**
   * Serialisiert PersonVonEinheitEntferntEvent.
   */
  private serializePersonVonEinheitEntfernt(event: PersonVonEinheitEntferntEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId,
      einheitId: event.einheitId,
      einheitName: event.einheitName,
      personId: event.personId,
      personVorname: event.personVorname,
      personNachname: event.personNachname,
      updatedBy: event.updatedBy,
    };
  }

  /**
   * Serialisiert FahrzeugEinheitZugewiesenEvent (Issue #411).
   */
  private serializeFahrzeugEinheitZugewiesen(event: FahrzeugEinheitZugewiesenEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId,
      fahrzeugId: event.fahrzeugId,
      funkrufname: event.funkrufname,
      einheitId: event.einheitId,
      einheitName: event.einheitName,
      previousEinheitId: event.previousEinheitId,
      updatedBy: event.updatedBy,
    };
  }

  // ===== GEFAHRENMATRIX SERIALIZERS (Issue #414) =====

  private serializeGefahrenmatrixAktualisiert(event: GefahrenmatrixAktualisiertEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId,
      gefahrentyp: event.gefahrentyp,
      schutzobjekt: event.schutzobjekt,
      warnstufe: event.warnstufe,
      aktualisiertVon: event.aktualisiertVon,
    };
  }

  // ===== GEFAHRENZONE SERIALIZERS (Issue #627) =====

  private serializeGefahrenzoneErstellt(event: GefahrenzoneErstelltEvent): Record<string, unknown> {
    return {
      zoneId: event.zoneId,
      einsatzId: event.einsatzId,
      gefahrentyp: event.gefahrentyp,
      schutzobjekt: event.schutzobjekt,
      geometryType: event.geometryType,
      geometry: event.geometry as unknown as Record<string, unknown>,
      bezeichnung: event.bezeichnung,
      erstelltVon: event.erstelltVon,
    };
  }

  private serializeGefahrenzoneGeometryGeaendert(event: GefahrenzoneGeometryGeaendertEvent): Record<string, unknown> {
    return {
      zoneId: event.zoneId,
      einsatzId: event.einsatzId,
      geometryType: event.geometryType,
      geometry: event.geometry as unknown as Record<string, unknown>,
      aktualisiertVon: event.aktualisiertVon,
    };
  }

  private serializeGefahrenzoneGeloescht(event: GefahrenzoneGeloeschtEvent): Record<string, unknown> {
    return {
      zoneId: event.zoneId,
      einsatzId: event.einsatzId,
      geloeschtVon: event.geloeschtVon,
    };
  }

  // ===== TAKTISCHE ZEICHEN SERIALIZERS (Issue #636) =====

  /**
   * Serialisiert ZeichenErstelltEvent (Issue #636).
   */
  private serializeZeichenErstellt(event: ZeichenErstelltEvent): Record<string, unknown> {
    return {
      zeichenId: event.zeichenId,
      einsatzId: event.einsatzId,
      zeichenDefinition: event.zeichenDefinition,
      label: event.label,
      referenzTyp: event.referenzTyp,
      referenzId: event.referenzId,
      createdBy: event.createdBy,
    };
  }

  /**
   * Serialisiert ZeichenPlatziertEvent (Issue #636).
   */
  private serializeZeichenPlatziert(event: ZeichenPlatziertEvent): Record<string, unknown> {
    return {
      zeichenId: event.zeichenId,
      einsatzId: event.einsatzId,
      lagekarteId: event.lagekarteId,
      lat: event.lat,
      lng: event.lng,
      mgrs: event.mgrs,
    };
  }

  /**
   * Serialisiert ZeichenVerschobenEvent (Issue #636).
   */
  private serializeZeichenVerschoben(event: ZeichenVerschobenEvent): Record<string, unknown> {
    return {
      zeichenId: event.zeichenId,
      einsatzId: event.einsatzId,
      lat: event.lat,
      lng: event.lng,
      mgrs: event.mgrs,
    };
  }

  /**
   * Serialisiert ZeichenEntferntEvent (Issue #636).
   */
  private serializeZeichenEntfernt(event: ZeichenEntferntEvent): Record<string, unknown> {
    return {
      zeichenId: event.zeichenId,
      einsatzId: event.einsatzId,
    };
  }

  // ===== FUNKKANAL SERIALIZERS (Issue #407) =====

  private serializeFunkkanalErstellt(event: FunkkanalErstelltEvent): Record<string, unknown> {
    return {
      funkkanalId: event.funkkanalId.value,
      einsatzId: event.einsatzId.value,
      data: {
        name: event.data.name,
        details: event.data.details,
        status: event.data.status,
        sortIndex: event.data.sortIndex,
        zweck: event.data.zweck ?? null,
      },
    };
  }

  private serializeFunkkanalGeaendert(event: FunkkanalGeaendertEvent): Record<string, unknown> {
    return {
      funkkanalId: event.funkkanalId.value,
      einsatzId: event.einsatzId.value,
      changedFields: event.changedFields,
    };
  }

  private serializeFunkkanalArchiviert(event: FunkkanalArchiviertEvent): Record<string, unknown> {
    return {
      funkkanalId: event.funkkanalId.value,
      einsatzId: event.einsatzId.value,
    };
  }

  private serializeFunkkanalReihenfolgeGeaendert(event: FunkkanalReihenfolgeGeaendertEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId.value,
      ordering: event.ordering.map((e) => ({ kanalId: e.kanalId, sortIndex: e.sortIndex })),
    };
  }

  private serializeFunkkanalZuordnungErstellt(event: FunkkanalZuordnungErstelltEvent): Record<string, unknown> {
    return {
      funkkanalId: event.funkkanalId.value,
      einsatzId: event.einsatzId.value,
      zuordnungId: event.zuordnungId.value,
      kraftRef: event.kraftRef,
      rufnameSnapshot: event.rufnameSnapshot,
      rolle: event.rolle,
    };
  }

  private serializeFunkkanalZuordnungEntfernt(event: FunkkanalZuordnungEntferntEvent): Record<string, unknown> {
    return {
      funkkanalId: event.funkkanalId.value,
      einsatzId: event.einsatzId.value,
      zuordnungId: event.zuordnungId.value,
    };
  }

  private serializeNotfallAlertRequested(event: NotfallAlertRequestedEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId.value,
      funkkanalId: event.funkkanalId.value,
      funkspruchEintragId: event.funkspruchEintragId.value,
      text: event.text,
      absender: event.absender ?? null,
    };
  }

  // ===== ALARMIERUNG SERIALIZERS (Issue #408) =====

  private serializeAlarmierungErstellt(event: AlarmierungErstelltEvent): Record<string, unknown> {
    return {
      alarmierungId: event.alarmierungId.value,
      einsatzId: event.einsatzId.value,
      data: {
        bezeichnung: event.data.bezeichnung,
        beschreibung: event.data.beschreibung ?? null,
        alarmierungszeit: event.data.alarmierungszeit.toISOString(),
        ursprungAlarmierungId: event.data.ursprungAlarmierungId ?? null,
        empfaengerCount: event.data.empfaengerCount,
      },
    };
  }

  private serializeAlarmierungEmpfaengerHinzugefuegt(event: AlarmierungEmpfaengerHinzugefuegtEvent): Record<string, unknown> {
    return {
      alarmierungId: event.alarmierungId.value,
      einsatzId: event.einsatzId.value,
      data: {
        empfaengerId: event.data.empfaengerId.value,
        ref: event.data.ref,
        nameSnapshot: event.data.nameSnapshot,
        alarmiertAm: event.data.alarmiertAm.toISOString(),
      },
    };
  }

  private serializeAlarmierungEmpfaengerEntfernt(event: AlarmierungEmpfaengerEntferntEvent): Record<string, unknown> {
    return {
      alarmierungId: event.alarmierungId.value,
      einsatzId: event.einsatzId.value,
      data: {
        empfaengerId: event.data.empfaengerId.value,
        nameSnapshot: event.data.nameSnapshot,
      },
    };
  }

  private serializeAlarmierungZeitpunktKorrigiert(event: AlarmierungZeitpunktKorrigiertEvent): Record<string, unknown> {
    return {
      alarmierungId: event.alarmierungId.value,
      einsatzId: event.einsatzId.value,
      data: {
        empfaengerId: event.data.empfaengerId.value,
        nameSnapshot: event.data.nameSnapshot,
        feld: event.data.feld,
        alterWert: event.data.alterWert?.toISOString() ?? null,
        neuerWert: event.data.neuerWert?.toISOString() ?? null,
        korrigiertVon: event.data.korrigiertVon,
      },
    };
  }

  private serializeAlarmierungZeitpunktFmsGesetzt(event: AlarmierungZeitpunktFmsGesetztEvent): Record<string, unknown> {
    return {
      alarmierungId: event.alarmierungId.value,
      einsatzId: event.einsatzId.value,
      data: {
        empfaengerId: event.data.empfaengerId.value,
        nameSnapshot: event.data.nameSnapshot,
        feld: event.data.feld,
        wert: event.data.wert.toISOString(),
        fmsStatus: event.data.fmsStatus,
      },
    };
  }

  /**
   * **M1:** `abgeschlossenVon` ist eine Top-Level-Property (kein `data`-Wrapper).
   */
  private serializeAlarmierungAbgeschlossen(event: AlarmierungAbgeschlossenEvent): Record<string, unknown> {
    return {
      alarmierungId: event.alarmierungId.value,
      einsatzId: event.einsatzId.value,
      abgeschlossenVon: event.abgeschlossenVon,
    };
  }

  private serializeNachalarmierungErstellt(event: NachalarmierungErstelltEvent): Record<string, unknown> {
    return {
      alarmierungId: event.alarmierungId.value,
      einsatzId: event.einsatzId.value,
      data: {
        bezeichnung: event.data.bezeichnung,
        ursprungAlarmierungId: event.data.ursprungAlarmierungId.value,
      },
    };
  }

  // ===== PATIENT SERIALIZERS (Story 1.2, Architecture §D-6) =====

  /**
   * Serialisiert `PatientErfasst` für die Outbox-Persistenz (Architecture §D-6).
   *
   * Felder folgen exakt dem Konstruktor von `PatientErfasst` plus den geerbten
   * Audit-Feldern aus `PatientDomainEvent`. `eventVersion` ist beim Erfassen
   * immer `1` (initialer Snapshot, Append-only-Vertrag aus §D-1).
   */
  private serializePatientErfasst(event: PatientErfasst): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId,
      patientId: event.patientId,
      patientennummer: event.patientennummer,
      initialeSk: event.initialeSk,
      erfasserRef: event.erfasserRef,
      eventVersion: event.eventVersion,
      actorUserId: event.actorUserId ?? null,
      actorDeviceId: event.actorDeviceId ?? null,
      originSessionId: event.originSessionId ?? null,
      clockDriftSeconds: event.clockDriftSeconds ?? null,
      erfasstAm: event.occurredAt.toISOString(),
    };
  }

  /**
   * Serialisiert `PatientGesichtet` für die Outbox-Persistenz (Story 1.3,
   * Architecture §D-6). Story 1.2 hatte den Adapter-Platzhalter angelegt;
   * Story 1.3 schließt die 4-Punkt-Registry für das Event.
   */
  private serializePatientGesichtet(event: PatientGesichtet): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId,
      patientId: event.patientId,
      eventVersion: event.eventVersion,
      sk: event.sk,
      sichtungArt: event.sichtungArt,
      sichter: event.sichter,
      actorUserId: event.actorUserId ?? null,
      actorDeviceId: event.actorDeviceId ?? null,
      originSessionId: event.originSessionId ?? null,
      clockDriftSeconds: event.clockDriftSeconds ?? null,
      gesichtetAm: event.occurredAt.toISOString(),
    };
  }

  /**
   * Serialisiert `PatientSichtungAktualisiert` für die Outbox-Persistenz
   * (Story 1.3, Architecture §D-6, FR17). `vorher`/`neu` und der optionale
   * `grund` ermöglichen Audit-Spur und KPI-Delta ohne DB-Roundtrip.
   */
  private serializePatientSichtungAktualisiert(event: PatientSichtungAktualisiert): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId,
      patientId: event.patientId,
      eventVersion: event.eventVersion,
      vorher: event.vorher,
      neu: event.neu,
      sichtungArt: event.sichtungArt,
      sichter: event.sichter,
      grund: event.grund ?? null,
      actorUserId: event.actorUserId ?? null,
      actorDeviceId: event.actorDeviceId ?? null,
      originSessionId: event.originSessionId ?? null,
      clockDriftSeconds: event.clockDriftSeconds ?? null,
      gesichtetAm: event.occurredAt.toISOString(),
    };
  }

  // ===== EIGENSCHUTZ SERIALIZERS (Story 2.1) =====

  private serializeGefaehrdungsbeurteilungErstellt(event: GefaehrdungsbeurteilungErstelltEvent): Record<string, unknown> {
    return {
      einsatzId: event.einsatzId,
      userId: event.userId,
      einheitId: event.einheitId,
      gefaehrdungsbeurteilungId: event.gefaehrdungsbeurteilungId,
      vorlageId: event.vorlageId,
      itemCount: event.itemCount,
    };
  }

  private serializeGefaehrdungsbeurteilungAktualisiert(event: GefaehrdungsbeurteilungAktualisiertEvent): Record<string, unknown> {
    // Symmetrische Shape-Validation (Story 2.3, AC7): der Serializer rejected
    // invalid payloads vor dem DB-Insert — damit niemals eine Zeile entsteht,
    // die der Deserializer beim Round-Trip verwirft. Liefert das Aggregate
    // einen korrupten `changedFields`-Payload, ist das ein Programmierfehler
    // (keine Client-Input-Kategorie) — wir werfen hart, damit der Outbox-
    // Insert fehlschlägt und der Handler das Event nicht persistiert.
    //
    // Die Field-Keys in `updated[i].fields` werden hier bewusst strikt gegen
    // das bekannte Set validiert (wie der Deserializer) — sonst könnte ein
    // Poison-Payload (z. B. `['risikoklasse']`) in die Outbox gelangen, beim
    // Replay rejected werden und das Event permanent blockieren.
    const ALLOWED_FIELD_KEYS: ReadonlySet<string> = new Set(['title', 'description', 'eintritt', 'schaden', 'schutzmassnahmen']);
    const cf = event.changedFields;
    const fromVersion = event.fromVersion;
    const toVersion = event.toVersion;
    if (
      !Number.isInteger(fromVersion) ||
      !Number.isInteger(toVersion) ||
      fromVersion < 1 ||
      toVersion !== fromVersion + 1 ||
      !Array.isArray(cf.added) ||
      !cf.added.every((entry) => typeof entry === 'string') ||
      !Array.isArray(cf.removed) ||
      !cf.removed.every((entry) => typeof entry === 'string') ||
      !Array.isArray(cf.updated) ||
      !cf.updated.every(
        (entry) => typeof entry.id === 'string' && entry.id.length > 0 && Array.isArray(entry.fields) && entry.fields.every((field) => typeof field === 'string' && ALLOWED_FIELD_KEYS.has(field)),
      ) ||
      !Number.isInteger(cf.unchanged) ||
      cf.unchanged < 0
    ) {
      throw new Error('Invalid GefaehrdungsbeurteilungAktualisiert event payload');
    }
    return {
      einsatzId: event.einsatzId,
      userId: event.userId,
      einheitId: event.einheitId,
      gefaehrdungsbeurteilungId: event.gefaehrdungsbeurteilungId,
      fromVersion,
      toVersion,
      changedFields: cf,
    };
  }

  private serializeSicherheitsregelAusgerufen(event: SicherheitsregelAusgerufenEvent): Record<string, unknown> {
    // Symmetrische Shape-Validation (Story 2.6, analog zu AC7 aus Story 2.3):
    // der Serializer rejected invalide Payloads vor dem DB-Insert — damit
    // niemals eine Zeile entsteht, die der Deserializer beim Round-Trip
    // verwirft. Liefert das Aggregate einen korrupten `changedFields`-Payload,
    // ist das ein Programmierfehler (keine Client-Input-Kategorie) — wir
    // werfen hart, damit der Outbox-Insert fehlschlägt und der Handler das
    // Event nicht persistiert.
    //
    // Die Feld-Keys in `changedFields.updated` werden hier bewusst strikt
    // gegen das bekannte Set validiert (wie der Deserializer) — sonst könnte
    // ein Poison-Payload (z. B. `['version']`) in die Outbox gelangen, beim
    // Replay rejected werden und das Event permanent blockieren.
    const ALLOWED_FIELD_KEYS: ReadonlySet<string> = new Set(['titel', 'inhalt', 'einheitId']);
    const cf = event.changedFields;
    const fromVersion = event.fromVersion;
    const toVersion = event.toVersion;

    // Versionen: `fromVersion: null` gilt ausschließlich für den Create-Pfad
    // (`toVersion === 1`, `changedFields.created === true`). Ansonsten
    // `fromVersion >= 1` plus Update- (`toVersion = fromVersion + 1`) oder
    // Deprecate-Regel (`toVersion === fromVersion`, kein neuer aktiver Stand).
    const isCreate = fromVersion === null;
    if (isCreate) {
      if (toVersion !== 1 || cf.created !== true || cf.updated !== undefined || cf.deprecated !== undefined) {
        throw new Error('Invalid SicherheitsregelAusgerufen event payload');
      }
    } else {
      if (!Number.isInteger(fromVersion) || (fromVersion as number) < 1 || !Number.isInteger(toVersion)) {
        throw new Error('Invalid SicherheitsregelAusgerufen event payload');
      }
      const isDeprecate = cf.deprecated === true;
      const isUpdate = Array.isArray(cf.updated);
      if (isDeprecate) {
        if (toVersion !== fromVersion || cf.created !== undefined || cf.updated !== undefined) {
          throw new Error('Invalid SicherheitsregelAusgerufen event payload');
        }
      } else if (isUpdate) {
        if (toVersion !== (fromVersion as number) + 1 || cf.created !== undefined || cf.deprecated !== undefined) {
          throw new Error('Invalid SicherheitsregelAusgerufen event payload');
        }
        // Story 2.7 Code-Review-Patch: Symmetrie zum Deserializer (rejected
        // `cf.updated.length === 0`) — leere Update-Liste hier nicht zulassen,
        // sonst entstehen Poison-Records, die der Replay nicht wieder
        // einlesen kann.
        if ((cf.updated as unknown[]).length === 0) {
          throw new Error('Invalid SicherheitsregelAusgerufen event payload');
        }
        if (!(cf.updated as unknown[]).every((field) => typeof field === 'string' && ALLOWED_FIELD_KEYS.has(field))) {
          throw new Error('Invalid SicherheitsregelAusgerufen event payload');
        }
      } else {
        throw new Error('Invalid SicherheitsregelAusgerufen event payload');
      }
    }

    if (
      typeof event.einsatzId !== 'string' ||
      typeof event.userId !== 'string' ||
      typeof event.regelId !== 'string' ||
      typeof event.propagationGroupId !== 'string' ||
      typeof event.titel !== 'string' ||
      typeof event.inhalt !== 'string'
    ) {
      throw new Error('Invalid SicherheitsregelAusgerufen event payload');
    }
    if (event.einheitId !== undefined && typeof event.einheitId !== 'string') {
      throw new Error('Invalid SicherheitsregelAusgerufen event payload');
    }

    return {
      einsatzId: event.einsatzId,
      userId: event.userId,
      einheitId: event.einheitId,
      regelId: event.regelId,
      propagationGroupId: event.propagationGroupId,
      fromVersion,
      toVersion,
      changedFields: cf,
      titel: event.titel,
      inhalt: event.inhalt,
    };
  }

  /**
   * Serialisiert `SicherheitsregelQuittiertEvent` (Story 2.7).
   *
   * Pflichtfelder: einsatzId, userId, einheitId (immer Pflicht), regelId,
   * quittiertAm. `propagationGroupId` darf `null` sein (Outbox-Retention-
   * Fallback). Symmetrische Shape-Validation analog zu Ausgerufen — ein
   * korrupter Payload bricht den Outbox-Insert hart, damit der Replay
   * konsistent bleibt.
   */
  private serializeSicherheitsregelQuittiert(event: SicherheitsregelQuittiertEvent): Record<string, unknown> {
    if (typeof event.einsatzId !== 'string' || typeof event.userId !== 'string' || typeof event.einheitId !== 'string' || typeof event.regelId !== 'string' || !(event.quittiertAm instanceof Date)) {
      throw new Error('Invalid SicherheitsregelQuittiert event payload');
    }
    if (event.propagationGroupId !== null && typeof event.propagationGroupId !== 'string') {
      throw new Error('Invalid SicherheitsregelQuittiert event payload');
    }

    return {
      einsatzId: event.einsatzId,
      userId: event.userId,
      einheitId: event.einheitId,
      regelId: event.regelId,
      propagationGroupId: event.propagationGroupId,
      quittiertAm: event.quittiertAm.toISOString(),
    };
  }

  /**
   * Serialisiert `PsaProfilGeaendertEvent` (Story 3.1).
   *
   * Pflichtfelder: einsatzId, userId, einheitId, zuweisungId, propagationGroupId,
   * profil, aktion, begruendung. Strikte Shape-Validation — ein korrupter
   * Payload bricht den Outbox-Insert hart, damit der Replay konsistent bleibt
   * (Pattern aus Story 2.7).
   */
  private serializePsaProfilGeaendert(event: PsaProfilGeaendertEvent): Record<string, unknown> {
    if (
      typeof event.einsatzId !== 'string' ||
      typeof event.userId !== 'string' ||
      typeof event.einheitId !== 'string' ||
      typeof event.zuweisungId !== 'string' ||
      typeof event.propagationGroupId !== 'string' ||
      typeof event.profil !== 'string' ||
      typeof event.aktion !== 'string' ||
      typeof event.begruendung !== 'string'
    ) {
      throw new Error('Invalid PsaProfilGeaendert event payload');
    }
    if (event.aktion !== 'AKTIVIERT' && event.aktion !== 'DEAKTIVIERT') {
      throw new Error('Invalid PsaProfilGeaendert event payload');
    }
    return {
      einsatzId: event.einsatzId,
      userId: event.userId,
      einheitId: event.einheitId,
      zuweisungId: event.zuweisungId,
      propagationGroupId: event.propagationGroupId,
      profil: event.profil,
      aktion: event.aktion,
      begruendung: event.begruendung,
    };
  }

  /**
   * Serialisiert `QuittungAbgegebenEvent` (Story 3.4).
   *
   * Pflichtfelder: einsatzId, userId, einheitId, propagationGroupId,
   * quittiertAm. Strikte Shape-Validation analog zu Story 2.7 — ein
   * korrupter Payload bricht den Outbox-Insert hart, damit Replay
   * konsistent bleibt.
   */
  private serializeQuittungAbgegeben(event: QuittungAbgegebenEvent): Record<string, unknown> {
    if (
      typeof event.einsatzId !== 'string' ||
      typeof event.userId !== 'string' ||
      typeof event.einheitId !== 'string' ||
      typeof event.propagationGroupId !== 'string' ||
      !(event.quittiertAm instanceof Date)
    ) {
      throw new Error('Invalid QuittungAbgegeben event payload');
    }

    return {
      einsatzId: event.einsatzId,
      userId: event.userId,
      einheitId: event.einheitId,
      propagationGroupId: event.propagationGroupId,
      quittiertAm: event.quittiertAm.toISOString(),
    };
  }

  /**
   * Serialisiert `LueckeGemeldetEvent` (Story 3.6, FR20).
   *
   * Pflichtfelder: einsatzId, userId, einheitId, propagationGroupId,
   * meldung, gemeldetAm. Strikte Shape-Validation analog `QuittungAbgegeben`.
   * `meldung`-Klartext bleibt im Outbox-Payload (Audit-Trail), wird aber
   * NICHT im WS-Frame transportiert (siehe Adapter / AC7).
   */
  private serializeLueckeGemeldet(event: LueckeGemeldetEvent): Record<string, unknown> {
    if (
      typeof event.einsatzId !== 'string' ||
      typeof event.userId !== 'string' ||
      typeof event.einheitId !== 'string' ||
      typeof event.propagationGroupId !== 'string' ||
      typeof event.meldung !== 'string' ||
      !(event.gemeldetAm instanceof Date)
    ) {
      throw new Error('Invalid LueckeGemeldet event payload');
    }

    return {
      einsatzId: event.einsatzId,
      userId: event.userId,
      einheitId: event.einheitId,
      propagationGroupId: event.propagationGroupId,
      meldung: event.meldung,
      gemeldetAm: event.gemeldetAm.toISOString(),
    };
  }

  /**
   * Serialisiert `QuittungUeberfaelligEvent` (Story 3.7, AR12).
   *
   * Pflichtfelder: einsatzId, einheitId, propagationGroupId, originalEventId,
   * ueberfaelligSeitMin (≥ 0, integer), zuweisungId (string | null).
   * `userId === 'SYSTEM'`-Sentinel — der Scheduler ist nicht user-getrieben.
   */
  private serializeQuittungUeberfaellig(event: QuittungUeberfaelligEvent): Record<string, unknown> {
    if (
      typeof event.einsatzId !== 'string' ||
      typeof event.userId !== 'string' ||
      typeof event.einheitId !== 'string' ||
      typeof event.propagationGroupId !== 'string' ||
      typeof event.originalEventId !== 'string' ||
      !Number.isInteger(event.ueberfaelligSeitMin) ||
      event.ueberfaelligSeitMin < 0 ||
      (event.zuweisungId !== null && typeof event.zuweisungId !== 'string')
    ) {
      throw new Error('Invalid QuittungUeberfaellig event payload');
    }

    return {
      einsatzId: event.einsatzId,
      userId: event.userId,
      einheitId: event.einheitId,
      propagationGroupId: event.propagationGroupId,
      originalEventId: event.originalEventId,
      ueberfaelligSeitMin: event.ueberfaelligSeitMin,
      zuweisungId: event.zuweisungId,
    };
  }

  /**
   * Serialisiert `KonfliktErkanntEvent` (Story 3.9, FR50, Architektur §B6 + §E).
   *
   * Pflichtfelder:
   * - `einsatzId`, `userId` (= reportedByUserId), `einheitId` (string | null),
   *   `entityType` (∈ SyncConflictEntityType-Enum), `entityId`,
   *   `fieldPath` (length 1..200), `serverVersion` und `localExpectedVersion`
   *   (integer ≥ 1), `localPayload` (Object, JSON.stringify ≤ 4096 Byte).
   *
   * Defense-Cap auf `localPayload` ist die letzte Verteidigungslinie zusätzlich
   * zum Repository-Cap (AC3) — schützt einen zukünftigen Caller, der den
   * Outbox-Pfad direkt nutzt.
   */
  private serializeKonfliktErkannt(event: KonfliktErkanntEvent): Record<string, unknown> {
    if (
      typeof event.einsatzId !== 'string' ||
      typeof event.userId !== 'string' ||
      (event.einheitId !== undefined && typeof event.einheitId !== 'string') ||
      !KONFLIKT_ERKANNT_ALLOWED_ENTITY_TYPES.includes(event.entityType) ||
      typeof event.entityId !== 'string' ||
      typeof event.fieldPath !== 'string' ||
      event.fieldPath.length < 1 ||
      event.fieldPath.length > 200 ||
      !Number.isInteger(event.serverVersion) ||
      event.serverVersion < 1 ||
      !Number.isInteger(event.localExpectedVersion) ||
      event.localExpectedVersion < 1 ||
      typeof event.localPayload !== 'object' ||
      event.localPayload === null ||
      Array.isArray(event.localPayload)
    ) {
      throw new Error('Invalid KonfliktErkannt event payload');
    }
    if (Buffer.byteLength(JSON.stringify(event.localPayload), 'utf8') > 4096) {
      throw new Error('Invalid KonfliktErkannt event payload');
    }

    return {
      einsatzId: event.einsatzId,
      userId: event.userId,
      einheitId: event.einheitId ?? null,
      entityType: event.entityType,
      entityId: event.entityId,
      fieldPath: event.fieldPath,
      localPayload: event.localPayload,
      serverVersion: event.serverVersion,
      localExpectedVersion: event.localExpectedVersion,
    };
  }

  /**
   * Serialisiert `KonfliktAufgeloestEvent` (Story 3.10, FR50, Architektur §B6 + §G1).
   *
   * Pflichtfelder:
   * - `einsatzId`, `userId` (= resolvedByUserId), `einheitId` (string | null),
   *   `syncConflictId`, `entityType` (∈ SyncConflictEntityType-Enum), `entityId`,
   *   `fieldPath` (length 1..200), `resolution` (∈ SyncConflictResolution-Enum),
   *   `resolvedAt` (Date).
   *
   * Defense-Validation analog Story 3.9 KonfliktErkannt — corrupteter Outbox-
   * Eintrag würde sonst beim Replay ein WS-Frame mit Garbage-Daten produzieren.
   */
  private serializeKonfliktAufgeloest(event: KonfliktAufgeloestEvent): Record<string, unknown> {
    if (
      typeof event.einsatzId !== 'string' ||
      typeof event.userId !== 'string' ||
      (event.einheitId !== undefined && typeof event.einheitId !== 'string') ||
      typeof event.syncConflictId !== 'string' ||
      !KONFLIKT_AUFGELOEST_ALLOWED_ENTITY_TYPES.includes(event.entityType) ||
      typeof event.entityId !== 'string' ||
      typeof event.fieldPath !== 'string' ||
      event.fieldPath.length < 1 ||
      event.fieldPath.length > 200 ||
      !KONFLIKT_AUFGELOEST_ALLOWED_RESOLUTIONS.includes(event.resolution) ||
      !(event.resolvedAt instanceof Date) ||
      Number.isNaN(event.resolvedAt.getTime())
    ) {
      throw new Error('Invalid KonfliktAufgeloest event payload');
    }

    return {
      einsatzId: event.einsatzId,
      userId: event.userId,
      einheitId: event.einheitId ?? null,
      syncConflictId: event.syncConflictId,
      entityType: event.entityType,
      entityId: event.entityId,
      fieldPath: event.fieldPath,
      resolution: event.resolution,
      resolvedAt: event.resolvedAt.toISOString(),
    };
  }

  // ===== EIGENSCHUTZ SERIALIZERS (Story 4.1 Sicherungsposten) =====

  private serializeSicherungspostenEingerichtet(event: SicherungspostenEingerichtetEvent): Record<string, unknown> {
    if (
      typeof event.einsatzId !== 'string' ||
      typeof event.userId !== 'string' ||
      typeof event.sicherungspostenId !== 'string' ||
      typeof event.bezeichnung !== 'string' ||
      event.bezeichnung.length < 1 ||
      event.bezeichnung.length > 200 ||
      (event.standortKind !== 'coordinate' && event.standortKind !== 'address') ||
      !Number.isInteger(event.personalCount) ||
      event.personalCount < 0
    ) {
      throw new Error('Invalid SicherungspostenEingerichtet event payload');
    }
    return {
      einsatzId: event.einsatzId,
      userId: event.userId,
      einheitId: event.einheitId ?? null,
      sicherungspostenId: event.sicherungspostenId,
      bezeichnung: event.bezeichnung,
      standortKind: event.standortKind,
      personalCount: event.personalCount,
    };
  }

  private serializeSicherungspostenAktualisiert(event: SicherungspostenAktualisiertEvent): Record<string, unknown> {
    const ALLOWED_FIELD_KEYS: ReadonlySet<SicherungspostenFieldKey> = new Set(['bezeichnung', 'standort', 'personal', 'einheitId', 'zustaendigkeitsbereich', 'abloesezeiten', 'aufgeloest']);
    const cf = event.changedFields;
    if (
      typeof event.einsatzId !== 'string' ||
      typeof event.userId !== 'string' ||
      typeof event.sicherungspostenId !== 'string' ||
      !Number.isInteger(event.fromVersion) ||
      !Number.isInteger(event.toVersion) ||
      event.fromVersion < 1 ||
      event.toVersion !== event.fromVersion + 1 ||
      !cf ||
      !Array.isArray(cf.changed) ||
      cf.changed.length === 0 ||
      !cf.changed.every((key) => ALLOWED_FIELD_KEYS.has(key))
    ) {
      throw new Error('Invalid SicherungspostenAktualisiert event payload');
    }
    return {
      einsatzId: event.einsatzId,
      userId: event.userId,
      einheitId: event.einheitId ?? null,
      sicherungspostenId: event.sicherungspostenId,
      fromVersion: event.fromVersion,
      toVersion: event.toVersion,
      changedFields: { changed: [...cf.changed], ...(cf.aufgeloest === true ? { aufgeloest: true } : {}) },
    };
  }

  // ===== EIGENSCHUTZ SERIALIZER (Story 5.1 Vorfall) =====

  /**
   * Serialisiert `VorfallGemeldetEvent` (Story 5.1, FR31/FR32).
   *
   * **Payload-Diät (PII-Schutz):** Nur Identifier + Audit-Felder. Klartext
   * von `was`, `wo`, `beteiligte`, `massnahmen`, `kontextSnapshot` bleibt im
   * Aggregate; Konsumenten lesen über das Repository.
   */
  private serializeVorfallGemeldet(event: VorfallGemeldetEvent): Record<string, unknown> {
    if (
      typeof event.einsatzId !== 'string' ||
      typeof event.userId !== 'string' ||
      typeof event.einheitId !== 'string' ||
      typeof event.vorfallId !== 'string' ||
      !(event.vorfallZeit instanceof Date) ||
      Number.isNaN(event.vorfallZeit.getTime()) ||
      typeof event.unfallkasseRelevant !== 'boolean'
    ) {
      throw new Error('Invalid VorfallGemeldet event payload');
    }
    return {
      einsatzId: event.einsatzId,
      userId: event.userId,
      einheitId: event.einheitId,
      vorfallId: event.vorfallId,
      vorfallZeit: event.vorfallZeit.toISOString(),
      unfallkasseRelevant: event.unfallkasseRelevant,
    };
  }

  /**
   * Serialisiert `VorfallGeschlossenEvent` (Issue #415).
   *
   * **Payload-Diät:** Begründung wird NICHT mitgespiegelt (PII-Schutz analog
   * `VorfallGemeldetEvent`); Konsumenten lesen sie aus dem Aggregate.
   */
  private serializeVorfallGeschlossen(event: VorfallGeschlossenEvent): Record<string, unknown> {
    if (
      typeof event.einsatzId !== 'string' ||
      typeof event.userId !== 'string' ||
      typeof event.einheitId !== 'string' ||
      typeof event.vorfallId !== 'string' ||
      !(event.geschlossenAm instanceof Date) ||
      Number.isNaN(event.geschlossenAm.getTime())
    ) {
      throw new Error('Invalid VorfallGeschlossen event payload');
    }
    return {
      einsatzId: event.einsatzId,
      userId: event.userId,
      einheitId: event.einheitId,
      vorfallId: event.vorfallId,
      geschlossenAm: event.geschlossenAm.toISOString(),
    };
  }

  /**
   * Serialisiert `VorfallExportiertEvent` (Story 5.6).
   *
   * Payload bleibt audit-tauglich und PII-arm: IDs, Format und Zeitpunkt.
   */
  private serializeVorfallExportiert(event: VorfallExportiertEvent): Record<string, unknown> {
    if (
      typeof event.einsatzId !== 'string' ||
      typeof event.userId !== 'string' ||
      typeof event.vorfallId !== 'string' ||
      !VORFALL_EXPORT_ALLOWED_FORMATS.includes(event.format) ||
      !(event.downloadedAt instanceof Date) ||
      Number.isNaN(event.downloadedAt.getTime())
    ) {
      throw new Error('Invalid VorfallExportiert event payload');
    }
    return {
      einsatzId: event.einsatzId,
      userId: event.userId,
      vorfallId: event.vorfallId,
      format: event.format,
      downloadedAt: event.downloadedAt.toISOString(),
    };
  }
}
