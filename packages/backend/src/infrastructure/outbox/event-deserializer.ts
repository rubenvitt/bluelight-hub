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
import { EintragKorrigiertEvent } from '@domain/events/eintrag-korrigiert.event';
import { EintragUpdatedEvent } from '@domain/events/eintrag-updated.event';
import { EintragDeletedEvent } from '@domain/events/eintrag-deleted.event';
import type { EintragKontextPersisted } from '@domain/value-objects/eintrag-kontext';
import { EtbLockedEvent } from '@domain/events/etb-locked.event';

// Lagekarte Events
import { LagekarteCreatedEvent } from '@domain/events/lagekarte-created.event';
import { PoiAddedEvent } from '@domain/events/poi-added.event';
import { PoiRemovedEvent } from '@domain/events/poi-removed.event';
import { PoiPositionUpdatedEvent } from '@domain/events/poi-position-updated.event';
import { LagekarteStateGeaendertEvent } from '@domain/events/lagekarte-state-geaendert.event';

// User Events
import { UserCreatedEvent } from '@domain/events/user-created.event';
import { UserDeletedEvent } from '@domain/events/user-deleted.event';
import { UserRoleChangedEvent } from '@domain/events/user-role-changed.event';
import { PermissionGrantedEvent } from '@domain/events/permission-granted.event';
import { PermissionRevokedEvent } from '@domain/events/permission-revoked.event';

// Invite Code Events
import { InviteCodeCreatedEvent } from '@domain/events/invite-code-created.event';
import { InviteCodeUsedEvent } from '@domain/events/invite-code-used.event';
import { InviteCodeRevokedEvent } from '@domain/events/invite-code-revoked.event';

// EinsatzPerson Events
import { EinsatzPersonHinzugefuegtEvent } from '@domain/kraefte/events/einsatz-person-hinzugefuegt.event';
import { PersonZuFahrzeugZugewiesenEvent } from '@domain/kraefte/events/person-zu-fahrzeug-zugewiesen.event';
import { PersonVonFahrzeugEntferntEvent } from '@domain/kraefte/events/person-von-fahrzeug-entfernt.event';

// EinsatzFahrzeug Events
import { FahrzeugErfasstEvent } from '@domain/kraefte/events/fahrzeug-erfasst.event';
import { FahrzeugEinheitZugewiesenEvent } from '@domain/kraefte/events/fahrzeug-einheit-zugewiesen.event';
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
import { ErinnerungEskaliertEvent } from '@domain/events/erinnerung-eskaliert.event';
import { ErinnerungIntensiviertEvent } from '@domain/events/erinnerung-intensiviert.event';
import { WiederkehrendeInstanzErstelltEvent } from '@domain/events/wiederkehrende-instanz-erstellt.event';
import { ErinnerungSerieGestopptEvent } from '@domain/events/erinnerung-serie-gestoppt.event';

// Erinnerungsvorlage Events
import { ErinnerungsvorlageErstelltEvent } from '@domain/erinnerungsvorlage/events/erinnerungsvorlage-erstellt.event';
import { ErinnerungsvorlageAktualisiertEvent } from '@domain/erinnerungsvorlage/events/erinnerungsvorlage-aktualisiert.event';
import { ErinnerungsvorlageGeloeschtEvent } from '@domain/erinnerungsvorlage/events/erinnerungsvorlage-geloescht.event';

// Notiz Events
import { NotizErstelltEvent } from '@domain/notiz/events/notiz-erstellt.event';
import { NotizAktualisiertEvent } from '@domain/notiz/events/notiz-aktualisiert.event';
import { NotizGeloeschtEvent } from '@domain/notiz/events/notiz-geloescht.event';

// Kategorie Events
import { KategorieErstelltEvent } from '@domain/kategorie/events/kategorie-erstellt.event';
import { KategorieGeloeschtEvent } from '@domain/kategorie/events/kategorie-geloescht.event';
import { KategorieId } from '@domain/kategorie/value-objects/kategorie-id';

// Fuehrungsrhythmus Template Events
import { FuehrungsrhythmusTemplateErstelltEvent } from '@domain/fuehrungsrhythmus/events/fuehrungsrhythmus-template-erstellt.event';
import { FuehrungsrhythmusTemplateGeloeschtEvent } from '@domain/fuehrungsrhythmus/events/fuehrungsrhythmus-template-geloescht.event';
import { FuehrungsrhythmusAktiviertEvent } from '@domain/fuehrungsrhythmus/events/fuehrungsrhythmus-aktiviert.event';
import { FuehrungsrhythmusTemplateAktualisiertEvent } from '@domain/fuehrungsrhythmus/events/fuehrungsrhythmus-template-aktualisiert.event';
import { FuehrungsrhythmusTemplateId } from '@domain/fuehrungsrhythmus/value-objects/fuehrungsrhythmus-template-id';

// Befehl Events
import { BefehlErstelltEvent } from '@domain/events/befehl-erstellt.event';
import { BefehlZugestelltEvent } from '@domain/events/befehl-zugestellt.event';
import { BefehlStatusGeaendertEvent } from '@domain/events/befehl-status-geaendert.event';
import { BefehlKommentarHinzugefuegtEvent } from '@domain/events/befehl-kommentar-hinzugefuegt.event';
import { BefehlQuittiertEvent } from '@domain/events/befehl-quittiert.event';
import type { QuittierungArt } from '@domain/entities/befehl-empfaenger.entity';
import { BefehlId } from '@domain/value-objects/befehl-id';

// Einsatz-Rolle Events
import { RolleGeaendertEvent } from '@domain/events/rolle-geaendert.event';
import { BefehlStatus } from '@domain/value-objects/befehl-status';

// DSGVO Events (Story 5.5)
import { BefehlAnonymisiertEvent } from '@domain/events/befehl-anonymisiert.event';
import { BefehlGeloeschtEvent } from '@domain/events/befehl-geloescht.event';
import { AufbewahrungsKonfigurationGeaendertEvent } from '@domain/events/aufbewahrungs-konfiguration-geaendert.event';

// System Monitoring Events (Story 5.6)
import { SystemWarnungEvent } from '@domain/events/system-warnung.event';
import { WarnungTyp } from '@domain/value-objects/warnung-typ';

// Operative Rollen Events (Issue #98)
import { OperativeRoleChangedEvent } from '@domain/events/operative-role-changed.event';
import { StammpersonAssignedEvent } from '@domain/events/stammperson-assigned.event';
import { EinsatzBeitrittsanfrageErstelltEvent } from '@domain/events/einsatz-beitrittsanfrage-erstellt.event';
import { EinsatzBeitrittsanfrageEntschiedenEvent } from '@domain/events/einsatz-beitrittsanfrage-entschieden.event';

// EinsatzEinheit Events (Issue #411)
import { EinheitErstelltEvent } from '@domain/kraefte/events/einheit-erstellt.event';
import { EinheitStatusGeaendertEvent } from '@domain/kraefte/events/einheit-status-geaendert.event';
import { EinheitAufgeloestEvent } from '@domain/kraefte/events/einheit-aufgeloest.event';
import { PersonZuEinheitZugewiesenEvent } from '@domain/kraefte/events/person-zu-einheit-zugewiesen.event';
import { PersonVonEinheitEntferntEvent } from '@domain/kraefte/events/person-von-einheit-entfernt.event';

// Gefahrenmatrix Events (Issue #414)
import { GefahrenmatrixAktualisiertEvent } from '@domain/gefahr/events/gefahrenmatrix-aktualisiert.event';

// Gefahrenzone Events (Issue #627)
import { GefahrenzoneErstelltEvent } from '@domain/gefahr/events/gefahrenzone-erstellt.event';
import { GefahrenzoneGeometryGeaendertEvent } from '@domain/gefahr/events/gefahrenzone-geometry-geaendert.event';
import { GefahrenzoneGeloeschtEvent } from '@domain/gefahr/events/gefahrenzone-geloescht.event';
import type { GeoJsonPolygonFeature } from '@domain/gefahr/value-objects/gefahrenzone-geometry';

// Taktische Zeichen Events (Issue #636)
import { ZeichenErstelltEvent } from '@domain/taktische-zeichen/events/zeichen-erstellt.event';
import { ZeichenPlatziertEvent } from '@domain/taktische-zeichen/events/zeichen-platziert.event';
import { ZeichenVerschobenEvent } from '@domain/taktische-zeichen/events/zeichen-verschoben.event';
import { ZeichenEntferntEvent } from '@domain/taktische-zeichen/events/zeichen-entfernt.event';
import type { ZeichenDefinitionProps } from '@domain/taktische-zeichen/value-objects/zeichen-definition.vo';

// Alarmierung Events (Issue #408)
import { AlarmierungAbgeschlossenEvent } from '@domain/events/alarmierung-abgeschlossen.event';
import { AlarmierungEmpfaengerEntferntEvent } from '@domain/events/alarmierung-empfaenger-entfernt.event';
import { AlarmierungEmpfaengerHinzugefuegtEvent } from '@domain/events/alarmierung-empfaenger-hinzugefuegt.event';
import { AlarmierungErstelltEvent } from '@domain/events/alarmierung-erstellt.event';
import { AlarmierungZeitpunktFmsGesetztEvent } from '@domain/events/alarmierung-zeitpunkt-fms-gesetzt.event';
import { AlarmierungZeitpunktKorrigiertEvent } from '@domain/events/alarmierung-zeitpunkt-korrigiert.event';
import { NachalarmierungErstelltEvent } from '@domain/events/nachalarmierung-erstellt.event';
// Patient Events (Story 1.2/1.3, Architecture §D-6)
import { PatientErfasst } from '@domain/patienten/events/patient-erfasst.event';
import { PatientGesichtet } from '@domain/patienten/events/patient-gesichtet.event';
import { PatientSichtungAktualisiert } from '@domain/patienten/events/patient-sichtung-aktualisiert.event';
import type { ErfasserRefData } from '@domain/patienten/value-objects/erfasser-ref.vo';
import { SK_CODES, type SkCode } from '@domain/patienten/value-objects/sichtungskategorie.vo';
import { SICHTUNG_ARTEN, type SichtungArt } from '@domain/patienten/value-objects/sichtung.vo';
// Eigenschutz Events (Story 2.1+)
import { GefaehrdungsbeurteilungErstelltEvent } from '@domain/eigenschutz/events/gefaehrdungsbeurteilung-erstellt.event';
import { GefaehrdungsbeurteilungAktualisiertEvent } from '@domain/eigenschutz/events/gefaehrdungsbeurteilung-aktualisiert.event';
import { SicherheitsregelAusgerufenEvent } from '@domain/eigenschutz/events/sicherheitsregel-ausgerufen.event';
import { SicherheitsregelQuittiertEvent } from '@domain/eigenschutz/events/sicherheitsregel-quittiert.event';
import { PsaProfilGeaendertEvent, type PsaProfilAktion } from '@domain/eigenschutz/events/psa-profil-geaendert.event';
import { QuittungAbgegebenEvent } from '@domain/eigenschutz/events/quittung-abgegeben.event';
import { LueckeGemeldetEvent } from '@domain/eigenschutz/events/luecke-gemeldet.event';
import { QuittungUeberfaelligEvent } from '@domain/eigenschutz/events/quittung-ueberfaellig.event';
import { SicherungspostenEingerichtetEvent } from '@domain/eigenschutz/events/sicherungsposten-eingerichtet.event';
import { SicherungspostenAktualisiertEvent, type SicherungspostenAktualisiertChangedFields, type SicherungspostenFieldKey } from '@domain/eigenschutz/events/sicherungsposten-aktualisiert.event';
import { VorfallGemeldetEvent } from '@domain/eigenschutz/events/vorfall-gemeldet.event';
import { VorfallGeschlossenEvent } from '@domain/eigenschutz/events/vorfall-geschlossen.event';
import { VorfallExportiertEvent, type VorfallExportFormat } from '@domain/eigenschutz/events/vorfall-exportiert.event';
import { KonfliktErkanntEvent, type SyncConflictEntityType } from '@domain/eigenschutz/events/konflikt-erkannt.event';
import { KonfliktAufgeloestEvent, type SyncConflictResolution } from '@domain/eigenschutz/events/konflikt-aufgeloest.event';
import { PsaProfil } from '@/generated/prisma/enums';
import { AlarmierungId } from '@domain/value-objects/alarmierung-id';
import { AlarmierungEmpfaengerId } from '@domain/value-objects/alarmierung-empfaenger-id';
import type { AlarmierungEmpfaengerRef } from '@domain/aggregates/alarmierung/alarmierung-empfaenger-ref';
import type { ZeitpunktFeld } from '@domain/aggregates/alarmierung/alarmierung-empfaenger.entity';

type EventDeserializeFn = (payload: Record<string, unknown>, aggregateId?: string, occurredOn?: Date) => Result<DomainEvent>;

// Funkkanal Events (Issue #407)
import { FunkkanalErstelltEvent, type FunkkanalErstelltPayload } from '@domain/events/funkkanal-erstellt.event';
import { FunkkanalGeaendertEvent, type FunkkanalChangedFields } from '@domain/events/funkkanal-geaendert.event';
import { FunkkanalArchiviertEvent } from '@domain/events/funkkanal-archiviert.event';
import { FunkkanalReihenfolgeGeaendertEvent, type FunkkanalOrderingEntry } from '@domain/events/funkkanal-reihenfolge-geaendert.event';
import { FunkkanalZuordnungErstelltEvent } from '@domain/events/funkkanal-zuordnung-erstellt.event';
import { FunkkanalZuordnungEntferntEvent } from '@domain/events/funkkanal-zuordnung-entfernt.event';
import { NotfallAlertRequestedEvent } from '@domain/events/notfall-alert-requested.event';
import { FunkkanalId } from '@domain/value-objects/funkkanal-id';
import { FunkkanalZuordnungId } from '@domain/value-objects/funkkanal-zuordnung-id';
import type { FunkkanalZuordnungKraftRef, FunkkanalRolle } from '@domain/aggregates/funkkanal/funkkanal-zuordnung.entity';

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
import { InviteCodeId } from '@domain/value-objects/invite-code-id';
import { ErinnerungsvorlageId } from '@domain/erinnerungsvorlage/value-objects/erinnerungsvorlage-id';
import { NotizId } from '@domain/notiz/value-objects/notiz-id';
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
  private readonly eventRegistry: Map<string, EventDeserializeFn>;

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
      ['etb.eintrag_korrigiert', this.deserializeEintragKorrigiert.bind(this)],
      ['etb.eintrag_updated', this.deserializeEintragUpdated.bind(this)],
      ['etb.eintrag_deleted', this.deserializeEintragDeleted.bind(this)],
      ['etb.locked', this.deserializeEtbLocked.bind(this)],

      // ===== LAGEKARTE EVENTS =====
      ['lagekarte.created', this.deserializeLagekarteCreated.bind(this)],
      ['lagekarte.poi_added', this.deserializePoiAdded.bind(this)],
      ['lagekarte.poi_removed', this.deserializePoiRemoved.bind(this)],
      ['lagekarte.poi_position_updated', this.deserializePoiPositionUpdated.bind(this)],
      ['lagekarte.state_geaendert', this.deserializeLagekarteStateGeaendert.bind(this)],

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
      ['einsatz_fahrzeug.einheit_zugewiesen', deserializeFahrzeugEinheitZugewiesen],

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

      // ===== INVITE CODE EVENTS =====
      ['invite_code.created', deserializeInviteCodeCreated],
      ['invite_code.used', deserializeInviteCodeUsed],
      ['invite_code.revoked', deserializeInviteCodeRevoked],

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
      ['erinnerung.eskaliert', this.deserializeErinnerungEskaliert.bind(this)],
      ['erinnerung.intensiviert', this.deserializeErinnerungIntensiviert.bind(this)],
      ['erinnerung.wiederkehrende-instanz-erstellt', this.deserializeWiederkehrendeInstanzErstellt.bind(this)],
      ['erinnerung.serie-gestoppt', this.deserializeErinnerungSerieGestoppt.bind(this)],
      // Compatibility aliases for events created before correct naming
      ['ErinnerungEskaliert', this.deserializeErinnerungEskaliert.bind(this)],
      ['ErinnerungIntensiviert', this.deserializeErinnerungIntensiviert.bind(this)],

      // ===== ERINNERUNGSVORLAGE EVENTS =====
      ['erinnerungsvorlage.erstellt', deserializeErinnerungsvorlageErstellt],
      ['erinnerungsvorlage.aktualisiert', deserializeErinnerungsvorlageAktualisiert],
      ['erinnerungsvorlage.geloescht', deserializeErinnerungsvorlageGeloescht],

      // ===== NOTIZ EVENTS =====
      ['notiz.erstellt', deserializeNotizErstellt],
      ['notiz.aktualisiert', deserializeNotizAktualisiert],
      ['notiz.geloescht', deserializeNotizGeloescht],

      // ===== KATEGORIE EVENTS (Story 8.1) =====
      ['kategorie.erstellt', deserializeKategorieErstellt],
      ['kategorie.geloescht', deserializeKategorieGeloescht],

      // ===== FUEHRUNGSRHYTHMUS TEMPLATE EVENTS =====
      ['fuehrungsrhythmus-template.erstellt', deserializeFuehrungsrhythmusTemplateErstellt],
      ['fuehrungsrhythmus-template.geloescht', deserializeFuehrungsrhythmusTemplateGeloescht],
      ['fuehrungsrhythmus-template.aktiviert', deserializeFuehrungsrhythmusAktiviert],
      ['fuehrungsrhythmus-template.aktualisiert', deserializeFuehrungsrhythmusTemplateAktualisiert],

      // ===== BEFEHL EVENTS (Story 1.1) =====
      ['befehl.erstellt', deserializeBefehlErstellt],
      ['befehl.zugestellt', deserializeBefehlZugestellt],
      ['befehl.status_geaendert', deserializeBefehlStatusGeaendert],
      ['befehl.kommentar_hinzugefuegt', deserializeBefehlKommentarHinzugefuegt],
      ['befehl.quittiert', deserializeBefehlQuittiert],

      // ===== EINSATZ ROLLE EVENTS (Story 5.4) =====
      ['rolle.geaendert', deserializeRolleGeaendert],

      // ===== DSGVO EVENTS (Story 5.5) =====
      ['befehl.anonymisiert', deserializeBefehlAnonymisiert],
      ['befehl.geloescht', deserializeBefehlGeloescht],
      ['aufbewahrung.konfiguration_geaendert', deserializeAufbewahrungsKonfigurationGeaendert],

      // ===== SYSTEM MONITORING EVENTS (Story 5.6) =====
      ['system.warnung', deserializeSystemWarnung],

      // ===== OPERATIVE ROLLEN EVENTS (Issue #98) =====
      ['operative_rolle.changed', deserializeOperativeRoleChanged],
      ['operative_rolle.stammperson_assigned', deserializeStammpersonAssigned],

      // ===== BEITRITTSANFRAGE EVENTS (Issue #98) =====
      ['beitrittsanfrage.erstellt', deserializeBeitrittsanfrageErstellt],
      ['beitrittsanfrage.entschieden', deserializeBeitrittsanfrageEntschieden],

      // ===== EINSATZ EINHEIT EVENTS (Issue #411) =====
      ['einsatz_einheit.erstellt', deserializeEinheitErstellt],
      ['einsatz_einheit.status_geaendert', deserializeEinheitStatusGeaendert],
      ['einsatz_einheit.aufgeloest', deserializeEinheitAufgeloest],
      ['einsatz_einheit.person_zugewiesen', deserializePersonZuEinheitZugewiesen],
      ['einsatz_einheit.person_entfernt', deserializePersonVonEinheitEntfernt],

      // ===== GEFAHRENMATRIX EVENTS (Issue #414) =====
      ['gefahrenmatrix.aktualisiert', deserializeGefahrenmatrixAktualisiert],

      // ===== GEFAHRENZONE EVENTS (Issue #627) =====
      ['gefahrenzone.erstellt', deserializeGefahrenzoneErstellt],
      ['gefahrenzone.geometry-geaendert', deserializeGefahrenzoneGeometryGeaendert],
      ['gefahrenzone.geloescht', deserializeGefahrenzoneGeloescht],

      // ===== TAKTISCHE ZEICHEN EVENTS (Issue #636) =====
      ['taktisches_zeichen.erstellt', deserializeZeichenErstellt],
      ['taktisches_zeichen.platziert', deserializeZeichenPlatziert],
      ['taktisches_zeichen.verschoben', deserializeZeichenVerschoben],
      ['taktisches_zeichen.aktualisiert', deserializeZeichenErstellt],
      ['taktisches_zeichen.entfernt', deserializeZeichenEntfernt],

      // ===== FUNKKANAL EVENTS (Issue #407) =====
      ['funkkanal.erstellt', deserializeFunkkanalErstellt],
      ['funkkanal.geaendert', deserializeFunkkanalGeaendert],
      ['funkkanal.archiviert', deserializeFunkkanalArchiviert],
      ['funkkanal.reihenfolge_geaendert', deserializeFunkkanalReihenfolgeGeaendert],
      ['funkkanal.zuordnung_erstellt', deserializeFunkkanalZuordnungErstellt],
      ['funkkanal.zuordnung_entfernt', deserializeFunkkanalZuordnungEntfernt],
      ['funk.notfall_alert_requested', deserializeNotfallAlertRequested],

      // ===== ALARMIERUNG EVENTS (Issue #408) =====
      ['alarmierung.erstellt', deserializeAlarmierungErstellt],
      ['alarmierung.empfaenger_hinzugefuegt', deserializeAlarmierungEmpfaengerHinzugefuegt],
      ['alarmierung.empfaenger_entfernt', deserializeAlarmierungEmpfaengerEntfernt],
      ['alarmierung.zeitpunkt_korrigiert', deserializeAlarmierungZeitpunktKorrigiert],
      ['alarmierung.zeitpunkt_fms_gesetzt', deserializeAlarmierungZeitpunktFmsGesetzt],
      ['alarmierung.abgeschlossen', deserializeAlarmierungAbgeschlossen],
      ['alarmierung.nachalarmierung_erstellt', deserializeNachalarmierungErstellt],

      // ===== PATIENT EVENTS (Story 1.2/1.3, Architecture §D-6) =====
      ['patient.erfasst', deserializePatientErfasst],
      ['patient.gesichtet', deserializePatientGesichtet],
      ['patient.sichtung-aktualisiert', deserializePatientSichtungAktualisiert],

      // ===== EIGENSCHUTZ EVENTS (Story 2.1+) =====
      ['eigenschutz.gefaehrdungsbeurteilung_erstellt', deserializeGefaehrdungsbeurteilungErstellt],
      ['eigenschutz.gefaehrdungsbeurteilung_aktualisiert', deserializeGefaehrdungsbeurteilungAktualisiert],
      ['eigenschutz.sicherheitsregel_ausgerufen', deserializeSicherheitsregelAusgerufen],
      ['eigenschutz.sicherheitsregel_quittiert', deserializeSicherheitsregelQuittiert],
      ['eigenschutz.psa_profil_geaendert', deserializePsaProfilGeaendert],
      ['eigenschutz.quittung_abgegeben', deserializeQuittungAbgegeben],
      ['eigenschutz.luecke_gemeldet', deserializeLueckeGemeldet],
      ['eigenschutz.quittung_ueberfaellig', deserializeQuittungUeberfaellig],
      ['eigenschutz.konflikt_erkannt', deserializeKonfliktErkannt],
      ['eigenschutz.konflikt_aufgeloest', deserializeKonfliktAufgeloest],
      ['eigenschutz.sicherungsposten_eingerichtet', deserializeSicherungspostenEingerichtet],
      ['eigenschutz.sicherungsposten_aktualisiert', deserializeSicherungspostenAktualisiert],
      ['eigenschutz.vorfall_gemeldet', deserializeVorfallGemeldet],
      ['eigenschutz.vorfall_geschlossen', deserializeVorfallGeschlossen],
      ['eigenschutz.vorfall_exportiert', deserializeVorfallExportiert],
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
    const occurredOn = new Date(serialized.occurredAt);
    if (Number.isNaN(occurredOn.getTime())) {
      return Result.fail<DomainEvent>(`Invalid occurredAt for ${eventName}`);
    }

    // Lookup Deserializer Function aus Registry
    const deserializer = this.eventRegistry.get(eventName);

    if (!deserializer) {
      this.logger.error(`Unknown event type: ${eventName}. EventDeserializer needs to be updated.`);
      return Result.fail<DomainEvent>(`Unknown event type: ${eventName}`);
    }

    try {
      return deserializer(payload, aggregateId, occurredOn);
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

  private deserializeEintragKorrigiert(payload: Record<string, unknown>): Result<DomainEvent> {
    const etbIdResult = EtbId.create(payload.etbId as string);
    if (etbIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid etbId: ${etbIdResult.error}`);
    }
    const korrekturEintragIdResult = EintragId.create(payload.korrekturEintragId as string);
    if (korrekturEintragIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid korrekturEintragId: ${korrekturEintragIdResult.error}`);
    }
    const originalEintragIdResult = EintragId.create(payload.originalEintragId as string);
    if (originalEintragIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid originalEintragId: ${originalEintragIdResult.error}`);
    }
    const createdByResult = UserId.create(payload.createdBy as string);
    if (createdByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid createdBy: ${createdByResult.error}`);
    }
    const event = new EintragKorrigiertEvent(
      etbIdResult.value!,
      korrekturEintragIdResult.value!,
      originalEintragIdResult.value!,
      payload.sequenceNumber as number,
      payload.text as string,
      createdByResult.value!,
    );
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

    // Issue #407: Backward-compatible Deserialisierung — fehlende Felder
    // bekommen defensive Defaults (alte Events bleiben lesbar).
    const kontextPayload = (payload.kontext as EintragKontextPersisted | undefined) ?? { type: 'standard' };
    const ereignisZeitpunkt = typeof payload.ereignisZeitpunkt === 'string' ? new Date(payload.ereignisZeitpunkt) : undefined;
    const absender = typeof payload.absender === 'string' ? payload.absender : undefined;
    const empfaenger = typeof payload.empfaenger === 'string' ? payload.empfaenger : undefined;

    const event = new EintragAddedEvent(
      etbIdResult.value!,
      eintragIdResult.value!,
      payload.sequenceNumber as number,
      payload.text as string,
      createdByResult.value!,
      kontextPayload,
      ereignisZeitpunkt,
      absender,
      empfaenger,
    );

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

  private deserializeLagekarteStateGeaendert(payload: Record<string, unknown>): Result<DomainEvent> {
    const lagekarteIdResult = LagekarteId.create(payload.lagekarteId as string);
    if (lagekarteIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid lagekarteId: ${lagekarteIdResult.error}`);
    }

    const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
    if (einsatzIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
    }

    const changedByResult = UserId.create(payload.changedBy as string);
    if (changedByResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid changedBy: ${changedByResult.error}`);
    }

    const event = new LagekarteStateGeaendertEvent(lagekarteIdResult.value!, einsatzIdResult.value!, changedByResult.value!);

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

    // Story 4.1: Optional eskalationsPersonId aus Payload deserialisieren
    let eskalationsPersonId: UserId | null = null;
    if (payload.eskalationsPersonId) {
      const eskalationsPersonIdResult = UserId.create(payload.eskalationsPersonId as string);
      if (eskalationsPersonIdResult.isSuccess && eskalationsPersonIdResult.value) {
        eskalationsPersonId = eskalationsPersonIdResult.value;
      }
    }

    const event = new ErinnerungErstelltEvent(
      erinnerungIdResult.value!,
      einsatzIdResult.value!,
      payload.titel as string,
      faelligAm,
      erstelltVonResult.value!,
      assignedToId,
      eskalationsPersonId,
      aggregateId,
    );

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
    if (rawAenderungen.eskalationsPersonId !== undefined) {
      // payload.eskalationsPersonId can be null or string
      if (rawAenderungen.eskalationsPersonId === null) {
        aenderungen.eskalationsPersonId = null;
      } else {
        const result = UserId.create(rawAenderungen.eskalationsPersonId as string);
        if (result.isSuccess) {
          aenderungen.eskalationsPersonId = result.value;
        }
      }
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
  /**
   * Deserialisiert ErinnerungEskaliertEvent (Story 4.1).
   */
  private deserializeErinnerungEskaliert(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
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

    let eskalationsPersonId: UserId | null = null;
    if (payload.eskalationsPersonId) {
      const eskalationsPersonIdResult = UserId.create(payload.eskalationsPersonId as string);
      if (eskalationsPersonIdResult.isFailure) {
        return Result.fail<DomainEvent>(`Invalid eskalationsPersonId: ${eskalationsPersonIdResult.error}`);
      }
      eskalationsPersonId = eskalationsPersonIdResult.value ?? null;
    }

    const eskaliertAm = new Date(payload.eskaliertAm as string);

    const event = new ErinnerungEskaliertEvent(
      erinnerungIdResult.value!,
      einsatzIdResult.value!,
      eskaliertAm,
      payload.titel as string,
      erstelltVonResult.value!,
      eskalationsPersonId,
      aggregateId ?? '',
    );

    return Result.ok<DomainEvent>(event);
  }

  /**
   * Deserialisiert ErinnerungIntensiviertEvent (Story 4.1 AC2).
   */
  private deserializeErinnerungIntensiviert(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
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

    const intensiviertAm = new Date(payload.intensiviertAm as string);

    const event = new ErinnerungIntensiviertEvent(erinnerungIdResult.value!, einsatzIdResult.value!, intensiviertAm, payload.titel as string, erstelltVonResult.value!, aggregateId ?? '');

    return Result.ok<DomainEvent>(event);
  }

  private deserializeWiederkehrendeInstanzErstellt(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const erinnerungIdResult = ErinnerungId.create(payload.erinnerungId as string);
    if (erinnerungIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid erinnerungId: ${erinnerungIdResult.error}`);
    }

    const parentIdResult = ErinnerungId.create(payload.parentId as string);
    if (parentIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid parentId: ${parentIdResult.error}`);
    }

    const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
    if (einsatzIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
    }

    const faelligAm = new Date(payload.faelligAm as string);

    const event = new WiederkehrendeInstanzErstelltEvent(
      erinnerungIdResult.value!,
      parentIdResult.value!,
      einsatzIdResult.value!,
      payload.titel as string,
      faelligAm,
      payload.sequenceNumber as number,
      aggregateId,
    );

    return Result.ok<DomainEvent>(event);
  }

  /**
   * Deserialisiert ErinnerungSerieGestopptEvent (Story 6.5).
   */
  private deserializeErinnerungSerieGestoppt(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
    const erinnerungIdResult = ErinnerungId.create(payload.erinnerungId as string);
    if (erinnerungIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid erinnerungId: ${erinnerungIdResult.error}`);
    }

    const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
    if (einsatzIdResult.isFailure) {
      return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
    }

    const event = new ErinnerungSerieGestopptEvent(erinnerungIdResult.value!, einsatzIdResult.value!, payload.titel as string, payload.totalErstellteInstanzen as number, aggregateId);

    return Result.ok<DomainEvent>(event);
  }
}

// ===== ERINNERUNGSVORLAGE DESERIALIZERS (Standalone Functions) =====

/**
 * Deserialisiert ErinnerungsvorlageErstelltEvent (Story 6.1).
 */
function deserializeErinnerungsvorlageErstellt(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const vorlageIdResult = ErinnerungsvorlageId.create(payload.vorlageId as string);
  if (vorlageIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid vorlageId: ${payload.vorlageId}`);
  }

  const createdByResult = UserId.create(payload.createdBy as string);
  if (createdByResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid createdBy: ${payload.createdBy}`);
  }

  const event = new ErinnerungsvorlageErstelltEvent(vorlageIdResult.value! as ErinnerungsvorlageId, payload.titel as string, payload.minuten as number, createdByResult.value! as UserId, aggregateId);

  return Result.ok<DomainEvent>(event);
}

/**
 * Deserialisiert ErinnerungsvorlageAktualisiertEvent (Story 6.2).
 */
function deserializeErinnerungsvorlageAktualisiert(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const vorlageIdResult = ErinnerungsvorlageId.create(payload.vorlageId as string);
  if (vorlageIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid vorlageId: ${payload.vorlageId}`);
  }

  const event = new ErinnerungsvorlageAktualisiertEvent(
    vorlageIdResult.value! as ErinnerungsvorlageId,
    payload.titel as string,
    payload.minuten as number,
    (payload.beschreibung as string | null) ?? null,
    payload.updatedBy as string,
    aggregateId,
  );

  return Result.ok<DomainEvent>(event);
}

/**
 * Deserialisiert ErinnerungsvorlageGeloeschtEvent (Story 6.2).
 */
function deserializeErinnerungsvorlageGeloescht(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const vorlageIdResult = ErinnerungsvorlageId.create(payload.vorlageId as string);
  if (vorlageIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid vorlageId: ${payload.vorlageId}`);
  }

  const deletedByResult = UserId.create(payload.deletedBy as string);
  if (deletedByResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid deletedBy: ${payload.deletedBy}`);
  }

  const event = new ErinnerungsvorlageGeloeschtEvent(vorlageIdResult.value! as ErinnerungsvorlageId, payload.titel as string, deletedByResult.value! as UserId, aggregateId);

  return Result.ok<DomainEvent>(event);
}

// ===== NOTIZ DESERIALIZERS (Standalone Functions) =====

/**
 * Deserialisiert NotizErstelltEvent (Story 7.1).
 */
function deserializeNotizErstellt(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const notizIdResult = NotizId.create(payload.notizId as string);
  if (notizIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid notizId: ${payload.notizId}`);
  }

  const erstelltVonResult = UserId.create(payload.erstelltVon as string);
  if (erstelltVonResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid erstelltVon: ${payload.erstelltVon}`);
  }

  const event = new NotizErstelltEvent(
    notizIdResult.value! as NotizId,
    payload.einsatzId as string,
    payload.titel as string,
    erstelltVonResult.value! as UserId,
    (payload.istTeamsichtbar as boolean) ?? false,
    aggregateId,
  );

  return Result.ok<DomainEvent>(event);
}

/**
 * Deserialisiert NotizAktualisiertEvent (Story 7.3).
 */
function deserializeNotizAktualisiert(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const notizIdResult = NotizId.create(payload.notizId as string);
  if (notizIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid notizId: ${payload.notizId}`);
  }

  const event = new NotizAktualisiertEvent(
    notizIdResult.value! as NotizId,
    payload.einsatzId as string,
    payload.titel as string,
    (payload.inhalt as string | null) ?? null,
    (payload.kategorie as string | null) ?? null,
    (payload.istTeamsichtbar as boolean) ?? false,
    payload.aktualisiertVon as string,
    aggregateId,
  );

  return Result.ok<DomainEvent>(event);
}

/**
 * Deserialisiert NotizGeloeschtEvent (Story 7.4).
 */
function deserializeNotizGeloescht(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const notizIdResult = NotizId.create(payload.notizId as string);
  if (notizIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid notizId: ${payload.notizId}`);
  }

  const geloeschtVonResult = UserId.create(payload.geloeschtVon as string);
  if (geloeschtVonResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid geloeschtVon: ${payload.geloeschtVon}`);
  }

  const event = new NotizGeloeschtEvent(notizIdResult.value! as NotizId, payload.einsatzId as string, payload.titel as string, geloeschtVonResult.value! as UserId, aggregateId);

  return Result.ok<DomainEvent>(event);
}

// ===== FUEHRUNGSRHYTHMUS TEMPLATE DESERIALIZERS (Standalone Functions) =====

/**
 * Deserialisiert FuehrungsrhythmusTemplateErstelltEvent (Story 6.6).
 */
function deserializeFuehrungsrhythmusTemplateErstellt(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const templateIdResult = FuehrungsrhythmusTemplateId.create(payload.templateId as string);
  if (templateIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid templateId: ${payload.templateId}`);
  }

  const createdByResult = UserId.create(payload.createdBy as string);
  if (createdByResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid createdBy: ${payload.createdBy}`);
  }

  const event = new FuehrungsrhythmusTemplateErstelltEvent(
    templateIdResult.value! as FuehrungsrhythmusTemplateId,
    payload.name as string,
    payload.eintraegeCount as number,
    createdByResult.value! as UserId,
    aggregateId,
  );

  return Result.ok<DomainEvent>(event);
}

/**
 * Deserialisiert FuehrungsrhythmusTemplateGeloeschtEvent (Story 6.6).
 */
function deserializeFuehrungsrhythmusTemplateGeloescht(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const templateIdResult = FuehrungsrhythmusTemplateId.create(payload.templateId as string);
  if (templateIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid templateId: ${payload.templateId}`);
  }

  const deletedByResult = UserId.create(payload.deletedBy as string);
  if (deletedByResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid deletedBy: ${payload.deletedBy}`);
  }

  const event = new FuehrungsrhythmusTemplateGeloeschtEvent(templateIdResult.value! as FuehrungsrhythmusTemplateId, payload.name as string, deletedByResult.value! as UserId, aggregateId);

  return Result.ok<DomainEvent>(event);
}

/**
 * Deserialisiert FuehrungsrhythmusAktiviertEvent (Story 6.7).
 */
function deserializeFuehrungsrhythmusAktiviert(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const templateIdResult = FuehrungsrhythmusTemplateId.create(payload.templateId as string);
  if (templateIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid templateId: ${templateIdResult.error}`);
  }

  const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
  if (einsatzIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid einsatzId: ${einsatzIdResult.error}`);
  }

  const aktiviertVonResult = UserId.create(payload.aktiviertVon as string);
  if (aktiviertVonResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid aktiviertVon: ${aktiviertVonResult.error}`);
  }

  const rawIds = payload.erstellteErinnerungIds as string[];
  const erinnerungIds: ErinnerungId[] = [];
  for (const rawId of rawIds) {
    const idResult = ErinnerungId.create(rawId);
    if (idResult.isFailure) return Result.fail<DomainEvent>(`Invalid erinnerungId: ${idResult.error}`);
    erinnerungIds.push(idResult.value!);
  }

  return Result.ok<DomainEvent>(
    new FuehrungsrhythmusAktiviertEvent(templateIdResult.value!, payload.templateName as string, einsatzIdResult.value!, erinnerungIds, aktiviertVonResult.value!, aggregateId),
  );
}

/**
 * Deserialisiert FuehrungsrhythmusTemplateAktualisiertEvent (Story 6.8).
 */
function deserializeFuehrungsrhythmusTemplateAktualisiert(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const templateIdResult = FuehrungsrhythmusTemplateId.create(payload.templateId as string);
  if (templateIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid templateId: ${payload.templateId}`);
  }

  const aktualisiertVonResult = UserId.create(payload.aktualisiertVon as string);
  if (aktualisiertVonResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid aktualisiertVon: ${payload.aktualisiertVon}`);
  }

  const event = new FuehrungsrhythmusTemplateAktualisiertEvent(templateIdResult.value! as FuehrungsrhythmusTemplateId, payload.name as string, aktualisiertVonResult.value! as UserId, aggregateId);

  return Result.ok<DomainEvent>(event);
}

// ===== KATEGORIE DESERIALIZERS (Story 8.1) =====

function deserializeKategorieErstellt(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const kategorieIdResult = KategorieId.create(payload.kategorieId as string);
  if (kategorieIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid kategorieId: ${payload.kategorieId}`);
  }

  const erstelltVonResult = UserId.create(payload.erstelltVon as string);
  if (erstelltVonResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid erstelltVon: ${payload.erstelltVon}`);
  }

  const event = new KategorieErstelltEvent(
    kategorieIdResult.value! as KategorieId,
    payload.einsatzId as string,
    payload.name as string,
    payload.farbe as string,
    erstelltVonResult.value! as UserId,
    aggregateId,
  );

  return Result.ok<DomainEvent>(event);
}

function deserializeKategorieGeloescht(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const kategorieIdResult = KategorieId.create(payload.kategorieId as string);
  if (kategorieIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid kategorieId: ${payload.kategorieId}`);
  }

  const geloeschtVonResult = UserId.create(payload.geloeschtVon as string);
  if (geloeschtVonResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid geloeschtVon: ${payload.geloeschtVon}`);
  }

  const event = new KategorieGeloeschtEvent(kategorieIdResult.value! as KategorieId, payload.einsatzId as string, payload.name as string, geloeschtVonResult.value! as UserId, aggregateId);

  return Result.ok<DomainEvent>(event);
}

// ===== BEFEHL DESERIALIZERS (Story 1.1) =====

/**
 * Deserialisiert BefehlErstelltEvent.
 */
function deserializeBefehlErstellt(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const befehlIdResult = BefehlId.create(payload.befehlId as string);
  if (befehlIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid befehlId: ${payload.befehlId}`);
  }

  const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
  if (einsatzIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid einsatzId: ${payload.einsatzId}`);
  }

  const event = new BefehlErstelltEvent(
    befehlIdResult.value! as BefehlId,
    einsatzIdResult.value! as EinsatzId,
    payload.auftrag as string,
    payload.nummer as string,
    (payload.empfaenger ?? payload.empfaengerIds) as string[],
    aggregateId,
    (payload.empfaengerIds as string[]) ?? [],
  );

  return Result.ok<DomainEvent>(event);
}

/**
 * Deserialisiert BefehlZugestelltEvent.
 */
function deserializeBefehlZugestellt(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const befehlIdResult = BefehlId.create(payload.befehlId as string);
  if (befehlIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid befehlId: ${payload.befehlId}`);
  }

  const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
  if (einsatzIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid einsatzId: ${payload.einsatzId}`);
  }

  const zugestelltAm = new Date(payload.zugestelltAm as string);

  const event = new BefehlZugestelltEvent(
    befehlIdResult.value! as BefehlId,
    payload.empfaengerId as string,
    zugestelltAm,
    einsatzIdResult.value! as EinsatzId,
    (payload.empfaengerName as string) ?? '',
    (payload.nummer as string) ?? '',
    aggregateId,
  );

  return Result.ok<DomainEvent>(event);
}

/**
 * Deserialisiert BefehlStatusGeaendertEvent.
 */
function deserializeBefehlStatusGeaendert(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const befehlIdResult = BefehlId.create(payload.befehlId as string);
  if (befehlIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid befehlId: ${payload.befehlId}`);
  }

  const oldStatusResult = BefehlStatus.create(payload.oldStatus as string);
  if (oldStatusResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid oldStatus: ${payload.oldStatus}`);
  }

  const newStatusResult = BefehlStatus.create(payload.newStatus as string);
  if (newStatusResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid newStatus: ${payload.newStatus}`);
  }

  const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
  if (einsatzIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid einsatzId: ${payload.einsatzId}`);
  }

  const erstellerIdResult = payload.erstellerId ? UserId.create(payload.erstellerId as string) : null;
  const befehlsgeberIdResult = payload.befehlsgeberId ? UserId.create(payload.befehlsgeberId as string) : null;
  const empfaengerIds = Array.isArray(payload.empfaengerIds) ? (payload.empfaengerIds as string[]) : [];

  const event = new BefehlStatusGeaendertEvent(
    befehlIdResult.value! as BefehlId,
    oldStatusResult.value! as BefehlStatus,
    newStatusResult.value! as BefehlStatus,
    einsatzIdResult.value! as EinsatzId,
    (payload.nummer as string) ?? '',
    aggregateId,
    erstellerIdResult?.isSuccess ? (erstellerIdResult.value as UserId) : undefined,
    befehlsgeberIdResult?.isSuccess ? (befehlsgeberIdResult.value as UserId) : undefined,
    empfaengerIds,
  );

  return Result.ok<DomainEvent>(event);
}

/**
 * Deserialisiert BefehlKommentarHinzugefuegtEvent.
 */
function deserializeBefehlKommentarHinzugefuegt(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const befehlIdResult = BefehlId.create(payload.befehlId as string);
  if (befehlIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid befehlId: ${payload.befehlId}`);
  }

  const authorIdResult = UserId.create(payload.authorId as string);
  if (authorIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid authorId: ${payload.authorId}`);
  }

  const event = new BefehlKommentarHinzugefuegtEvent(
    befehlIdResult.value! as BefehlId,
    payload.kommentarId as string,
    authorIdResult.value! as UserId,
    payload.text as string,
    payload.isRueckfrage as boolean,
    (payload.parentId as string | null) ?? undefined,
    aggregateId,
  );

  return Result.ok<DomainEvent>(event);
}

/**
 * Deserialisiert BefehlQuittiertEvent (Story 2.1).
 */
function deserializeBefehlQuittiert(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const befehlIdResult = BefehlId.create(payload.befehlId as string);
  if (befehlIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid befehlId: ${payload.befehlId}`);
  }

  const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
  if (einsatzIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid einsatzId: ${payload.einsatzId}`);
  }

  const empfaengerIdResult = UserId.create(payload.empfaengerId as string);
  if (empfaengerIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid empfaengerId: ${payload.empfaengerId}`);
  }

  const quittiertAm = new Date(payload.quittiertAm as string);

  const erstellerIdResult = payload.erstellerId ? UserId.create(payload.erstellerId as string) : null;
  const befehlsgeberIdResult = payload.befehlsgeberId ? UserId.create(payload.befehlsgeberId as string) : null;

  const event = new BefehlQuittiertEvent(
    befehlIdResult.value! as BefehlId,
    einsatzIdResult.value! as EinsatzId,
    empfaengerIdResult.value! as UserId,
    payload.quittierungArt as QuittierungArt,
    payload.nummer as string,
    quittiertAm,
    (payload.quittierungKommentar as string | undefined) ?? undefined,
    erstellerIdResult?.isSuccess ? (erstellerIdResult.value as UserId) : undefined,
    befehlsgeberIdResult?.isSuccess ? (befehlsgeberIdResult.value as UserId) : undefined,
    aggregateId,
  );
  return Result.ok<DomainEvent>(event);
}

// ===== EINSATZ ROLLE DESERIALIZERS (Story 5.4) =====

function deserializeRolleGeaendert(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const event = new RolleGeaendertEvent(
    payload.einsatzId as string,
    payload.userId as string,
    payload.userName as string,
    (payload.alteRolle as string) ?? null,
    (payload.neueRolle as string) ?? null,
    payload.aenderungDurch as string,
    payload.aenderungDurchName as string,
    aggregateId,
  );
  return Result.ok<DomainEvent>(event);
}

// ===== DSGVO DESERIALIZERS (Story 5.5) =====

function deserializeBefehlAnonymisiert(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
  if (einsatzIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid einsatzId: ${payload.einsatzId}`);
  }

  const event = new BefehlAnonymisiertEvent(
    einsatzIdResult.value! as EinsatzId,
    payload.befehlCount as number,
    payload.empfaengerCount as number,
    payload.kommentarCount as number,
    new Date(payload.anonymisiertAm as string),
    aggregateId,
  );
  return Result.ok<DomainEvent>(event);
}

function deserializeBefehlGeloescht(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const einsatzIdResult = EinsatzId.create(payload.einsatzId as string);
  if (einsatzIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Invalid einsatzId: ${payload.einsatzId}`);
  }

  const event = new BefehlGeloeschtEvent(einsatzIdResult.value! as EinsatzId, payload.befehlCount as number, new Date(payload.geloeschtAm as string), aggregateId);
  return Result.ok<DomainEvent>(event);
}

function deserializeAufbewahrungsKonfigurationGeaendert(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const event = new AufbewahrungsKonfigurationGeaendertEvent(
    payload.alteFristJahre as number,
    payload.neueFristJahre as number,
    payload.alteFreigabeperiodeTage as number,
    payload.neueFreigabeperiodeTage as number,
    payload.automatischLoeschenAktiv as boolean,
    payload.geaendertVon as string,
    aggregateId,
  );
  return Result.ok<DomainEvent>(event);
}

// ===== SYSTEM MONITORING DESERIALIZERS (Story 5.6) =====

function deserializeSystemWarnung(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const event = new SystemWarnungEvent(payload.warnungTyp as WarnungTyp, payload.schwellwert as number, payload.aktuellerWert as number, new Date(payload.timestamp as string), aggregateId);
  return Result.ok<DomainEvent>(event);
}

// ===== OPERATIVE ROLLEN DESERIALIZERS (Issue #98) =====

function deserializeOperativeRoleChanged(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const event = new OperativeRoleChangedEvent(payload.userId as string, payload.oldRole as string, payload.newRole as string, payload.changedBy as string, aggregateId);
  return Result.ok<DomainEvent>(event);
}

function deserializeStammpersonAssigned(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const event = new StammpersonAssignedEvent(payload.userId as string, payload.stammpersonId as string, payload.assignedBy as string, aggregateId);
  return Result.ok<DomainEvent>(event);
}

// ===== BEITRITTSANFRAGE DESERIALIZERS (Issue #98) =====

// ===== INVITE CODE DESERIALIZERS =====

function deserializeInviteCodeCreated(payload: Record<string, unknown>): Result<DomainEvent> {
  const inviteCodeIdResult = InviteCodeId.create(payload.inviteCodeId as string);
  if (inviteCodeIdResult.isFailure) {
    return Result.fail<DomainEvent>(`Ungültige inviteCodeId: ${inviteCodeIdResult.error}`);
  }

  const event = new InviteCodeCreatedEvent(
    inviteCodeIdResult.value!,
    payload.codeMasked as string,
    new Date(payload.expiresAt as string),
    payload.maxUses as number,
    payload.createdById as string,
    (payload.label as string | null) ?? null,
  );
  return Result.ok<DomainEvent>(event);
}

function deserializeInviteCodeUsed(payload: Record<string, unknown>): Result<DomainEvent> {
  const event = new InviteCodeUsedEvent(payload.inviteCodeId as string, payload.code as string, new Date(payload.usedAt as string), payload.newUseCount as number);
  return Result.ok<DomainEvent>(event);
}

function deserializeInviteCodeRevoked(payload: Record<string, unknown>): Result<DomainEvent> {
  const event = new InviteCodeRevokedEvent(payload.inviteCodeId as string, payload.codeMasked as string, new Date(payload.revokedAt as string), payload.revokedById as string);
  return Result.ok<DomainEvent>(event);
}

function deserializeBeitrittsanfrageErstellt(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const event = new EinsatzBeitrittsanfrageErstelltEvent(payload.anfrageId as string, payload.einsatzId as string, payload.userId as string, aggregateId);
  return Result.ok<DomainEvent>(event);
}

function deserializeBeitrittsanfrageEntschieden(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const event = new EinsatzBeitrittsanfrageEntschiedenEvent(
    payload.anfrageId as string,
    payload.einsatzId as string,
    payload.userId as string,
    payload.decision as 'GENEHMIGT' | 'ABGELEHNT',
    payload.resolvedBy as string,
    aggregateId,
  );
  return Result.ok<DomainEvent>(event);
}

// ===== EINSATZ EINHEIT DESERIALIZERS (Issue #411) =====

function deserializeEinheitErstellt(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
  const event = new EinheitErstelltEvent(
    payload.einsatzId as string,
    payload.einheitId as string,
    payload.name as string,
    payload.typ as string,
    payload.funktion as string | undefined,
    payload.createdBy as string,
  );
  return Result.ok<DomainEvent>(event);
}

function deserializeEinheitStatusGeaendert(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
  const event = new EinheitStatusGeaendertEvent(
    payload.einsatzId as string,
    payload.einheitId as string,
    payload.name as string,
    payload.alterStatus as string,
    payload.neuerStatus as string,
    payload.updatedBy as string,
  );
  return Result.ok<DomainEvent>(event);
}

function deserializeEinheitAufgeloest(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
  const event = new EinheitAufgeloestEvent(payload.einsatzId as string, payload.einheitId as string, payload.name as string, payload.updatedBy as string);
  return Result.ok<DomainEvent>(event);
}

function deserializePersonZuEinheitZugewiesen(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
  const event = new PersonZuEinheitZugewiesenEvent(
    payload.einsatzId as string,
    payload.einheitId as string,
    payload.einheitName as string,
    payload.personId as string,
    payload.personVorname as string,
    payload.personNachname as string,
    payload.createdBy as string,
  );
  return Result.ok<DomainEvent>(event);
}

function deserializePersonVonEinheitEntfernt(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
  const event = new PersonVonEinheitEntferntEvent(
    payload.einsatzId as string,
    payload.einheitId as string,
    payload.einheitName as string,
    payload.personId as string,
    payload.personVorname as string,
    payload.personNachname as string,
    payload.updatedBy as string,
  );
  return Result.ok<DomainEvent>(event);
}

// ===== EINSATZ FAHRZEUG-EINHEIT DESERIALIZERS (Issue #411) =====

function deserializeFahrzeugEinheitZugewiesen(payload: Record<string, unknown>, _aggregateId?: string): Result<DomainEvent> {
  const event = new FahrzeugEinheitZugewiesenEvent(
    payload.einsatzId as string,
    payload.fahrzeugId as string,
    payload.funkrufname as string,
    (payload.einheitId as string | null) ?? null,
    (payload.einheitName as string | null) ?? null,
    (payload.previousEinheitId as string | null) ?? null,
    payload.updatedBy as string,
  );
  return Result.ok<DomainEvent>(event);
}

// ===== GEFAHRENMATRIX DESERIALIZERS (Issue #414) =====

function deserializeGefahrenmatrixAktualisiert(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const event = new GefahrenmatrixAktualisiertEvent(
    payload.einsatzId as string,
    payload.gefahrentyp as string,
    payload.schutzobjekt as string,
    payload.warnstufe as string,
    payload.aktualisiertVon as string,
    aggregateId,
  );
  return Result.ok<DomainEvent>(event);
}

// ===== GEFAHRENZONE DESERIALIZERS (Issue #627) =====

function deserializeGefahrenzoneErstellt(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const event = new GefahrenzoneErstelltEvent(
    payload.zoneId as string,
    payload.einsatzId as string,
    payload.gefahrentyp as string,
    payload.schutzobjekt as string,
    payload.geometryType as string,
    payload.geometry as GeoJsonPolygonFeature,
    (payload.bezeichnung as string | null | undefined) ?? null,
    payload.erstelltVon as string,
    aggregateId,
  );
  return Result.ok<DomainEvent>(event);
}

function deserializeGefahrenzoneGeometryGeaendert(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const event = new GefahrenzoneGeometryGeaendertEvent(
    payload.zoneId as string,
    payload.einsatzId as string,
    payload.geometryType as string,
    payload.geometry as GeoJsonPolygonFeature,
    payload.aktualisiertVon as string,
    aggregateId,
  );
  return Result.ok<DomainEvent>(event);
}

function deserializeGefahrenzoneGeloescht(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const event = new GefahrenzoneGeloeschtEvent(payload.zoneId as string, payload.einsatzId as string, payload.geloeschtVon as string, aggregateId);
  return Result.ok<DomainEvent>(event);
}

// ===== TAKTISCHE ZEICHEN DESERIALIZERS (Issue #636) =====

/**
 * Deserialisiert ZeichenErstelltEvent (Issue #636).
 * Alle Felder sind primitive Typen — kein Value Object Mapping nötig.
 */
function deserializeZeichenErstellt(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const event = new ZeichenErstelltEvent(
    payload.zeichenId as string,
    payload.einsatzId as string,
    payload.zeichenDefinition as ZeichenDefinitionProps,
    payload.label as string | undefined,
    payload.referenzTyp as string | undefined,
    payload.referenzId as string | undefined,
    payload.createdBy as string,
    aggregateId,
  );
  return Result.ok<DomainEvent>(event);
}

/**
 * Deserialisiert ZeichenPlatziertEvent (Issue #636).
 */
function deserializeZeichenPlatziert(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const event = new ZeichenPlatziertEvent(
    payload.zeichenId as string,
    payload.einsatzId as string,
    payload.lagekarteId as string,
    payload.lat as number,
    payload.lng as number,
    payload.mgrs as string | undefined,
    aggregateId,
  );
  return Result.ok<DomainEvent>(event);
}

/**
 * Deserialisiert ZeichenVerschobenEvent (Issue #636).
 */
function deserializeZeichenVerschoben(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const event = new ZeichenVerschobenEvent(payload.zeichenId as string, payload.einsatzId as string, payload.lat as number, payload.lng as number, payload.mgrs as string | undefined, aggregateId);
  return Result.ok<DomainEvent>(event);
}

/**
 * Deserialisiert ZeichenEntferntEvent (Issue #636).
 */
function deserializeZeichenEntfernt(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const event = new ZeichenEntferntEvent(payload.zeichenId as string, payload.einsatzId as string, aggregateId);
  return Result.ok<DomainEvent>(event);
}

// ===== FUNKKANAL DESERIALIZERS (Issue #407) =====

function makeFunkkanalId(raw: unknown): FunkkanalId {
  const r = FunkkanalId.create(raw as string);
  if (r.isFailure) {
    throw new Error(`Invalid funkkanalId: ${r.error}`);
  }
  return r.value as FunkkanalId;
}

function makeEinsatzIdDeser(raw: unknown): EinsatzId {
  const r = EinsatzId.create(raw as string);
  if (r.isFailure) {
    throw new Error(`Invalid einsatzId: ${r.error}`);
  }
  return r.value as EinsatzId;
}

function deserializeFunkkanalErstellt(payload: Record<string, unknown>): Result<DomainEvent> {
  const event = new FunkkanalErstelltEvent(makeFunkkanalId(payload.funkkanalId), makeEinsatzIdDeser(payload.einsatzId), payload.data as FunkkanalErstelltPayload);
  return Result.ok<DomainEvent>(event);
}

function deserializeFunkkanalGeaendert(payload: Record<string, unknown>): Result<DomainEvent> {
  const event = new FunkkanalGeaendertEvent(makeFunkkanalId(payload.funkkanalId), makeEinsatzIdDeser(payload.einsatzId), (payload.changedFields ?? {}) as FunkkanalChangedFields);
  return Result.ok<DomainEvent>(event);
}

function deserializeFunkkanalArchiviert(payload: Record<string, unknown>): Result<DomainEvent> {
  const event = new FunkkanalArchiviertEvent(makeFunkkanalId(payload.funkkanalId), makeEinsatzIdDeser(payload.einsatzId));
  return Result.ok<DomainEvent>(event);
}

function deserializeFunkkanalReihenfolgeGeaendert(payload: Record<string, unknown>): Result<DomainEvent> {
  const ordering = (payload.ordering ?? []) as FunkkanalOrderingEntry[];
  const event = new FunkkanalReihenfolgeGeaendertEvent(makeEinsatzIdDeser(payload.einsatzId), ordering);
  return Result.ok<DomainEvent>(event);
}

function deserializeFunkkanalZuordnungErstellt(payload: Record<string, unknown>): Result<DomainEvent> {
  const zuordnungIdR = FunkkanalZuordnungId.create(payload.zuordnungId as string);
  if (zuordnungIdR.isFailure) {
    return Result.fail<DomainEvent>(`Invalid zuordnungId: ${zuordnungIdR.error}`);
  }
  const event = new FunkkanalZuordnungErstelltEvent(
    makeFunkkanalId(payload.funkkanalId),
    makeEinsatzIdDeser(payload.einsatzId),
    zuordnungIdR.value as FunkkanalZuordnungId,
    payload.kraftRef as FunkkanalZuordnungKraftRef,
    payload.rufnameSnapshot as string,
    payload.rolle as FunkkanalRolle,
  );
  return Result.ok<DomainEvent>(event);
}

function deserializeFunkkanalZuordnungEntfernt(payload: Record<string, unknown>): Result<DomainEvent> {
  const zuordnungIdR = FunkkanalZuordnungId.create(payload.zuordnungId as string);
  if (zuordnungIdR.isFailure) {
    return Result.fail<DomainEvent>(`Invalid zuordnungId: ${zuordnungIdR.error}`);
  }
  const event = new FunkkanalZuordnungEntferntEvent(makeFunkkanalId(payload.funkkanalId), makeEinsatzIdDeser(payload.einsatzId), zuordnungIdR.value as FunkkanalZuordnungId);
  return Result.ok<DomainEvent>(event);
}

function deserializeNotfallAlertRequested(payload: Record<string, unknown>): Result<DomainEvent> {
  const eintragIdR = EintragId.create(payload.funkspruchEintragId as string);
  if (eintragIdR.isFailure) {
    return Result.fail<DomainEvent>(`Invalid funkspruchEintragId: ${eintragIdR.error}`);
  }
  const event = new NotfallAlertRequestedEvent(
    makeEinsatzIdDeser(payload.einsatzId),
    makeFunkkanalId(payload.funkkanalId),
    eintragIdR.value as EintragId,
    payload.text as string,
    (payload.absender as string | null) ?? undefined,
  );
  return Result.ok<DomainEvent>(event);
}

// ===== ALARMIERUNG DESERIALIZERS (Issue #408) =====

function makeAlarmierungId(raw: unknown): AlarmierungId {
  const r = AlarmierungId.create(raw as string);
  if (r.isFailure) {
    throw new Error(`Invalid alarmierungId: ${r.error}`);
  }
  return r.value as AlarmierungId;
}

function makeAlarmierungEmpfaengerId(raw: unknown): AlarmierungEmpfaengerId {
  const r = AlarmierungEmpfaengerId.create(raw as string);
  if (r.isFailure) {
    throw new Error(`Invalid alarmierungEmpfaengerId: ${r.error}`);
  }
  return r.value as AlarmierungEmpfaengerId;
}

function deserializeAlarmierungErstellt(payload: Record<string, unknown>): Result<DomainEvent> {
  const data = (payload.data ?? {}) as {
    bezeichnung: string;
    beschreibung?: string | null;
    alarmierungszeit: string;
    ursprungAlarmierungId?: string | null;
    empfaengerCount: number;
  };
  const event = new AlarmierungErstelltEvent(makeAlarmierungId(payload.alarmierungId), makeEinsatzIdDeser(payload.einsatzId), {
    bezeichnung: data.bezeichnung,
    beschreibung: data.beschreibung ?? undefined,
    alarmierungszeit: new Date(data.alarmierungszeit),
    ursprungAlarmierungId: data.ursprungAlarmierungId ?? undefined,
    empfaengerCount: data.empfaengerCount,
  });
  return Result.ok<DomainEvent>(event);
}

function deserializeAlarmierungEmpfaengerHinzugefuegt(payload: Record<string, unknown>): Result<DomainEvent> {
  const data = (payload.data ?? {}) as {
    empfaengerId: string;
    ref: AlarmierungEmpfaengerRef;
    nameSnapshot: string;
    alarmiertAm: string;
  };
  const event = new AlarmierungEmpfaengerHinzugefuegtEvent(makeAlarmierungId(payload.alarmierungId), makeEinsatzIdDeser(payload.einsatzId), {
    empfaengerId: makeAlarmierungEmpfaengerId(data.empfaengerId),
    ref: data.ref,
    nameSnapshot: data.nameSnapshot,
    alarmiertAm: new Date(data.alarmiertAm),
  });
  return Result.ok<DomainEvent>(event);
}

function deserializeAlarmierungEmpfaengerEntfernt(payload: Record<string, unknown>): Result<DomainEvent> {
  const data = (payload.data ?? {}) as { empfaengerId: string; nameSnapshot: string };
  const event = new AlarmierungEmpfaengerEntferntEvent(makeAlarmierungId(payload.alarmierungId), makeEinsatzIdDeser(payload.einsatzId), {
    empfaengerId: makeAlarmierungEmpfaengerId(data.empfaengerId),
    nameSnapshot: data.nameSnapshot,
  });
  return Result.ok<DomainEvent>(event);
}

function deserializeAlarmierungZeitpunktKorrigiert(payload: Record<string, unknown>): Result<DomainEvent> {
  const data = (payload.data ?? {}) as {
    empfaengerId: string;
    nameSnapshot: string;
    feld: ZeitpunktFeld;
    alterWert: string | null;
    neuerWert: string | null;
    korrigiertVon: string;
  };
  const event = new AlarmierungZeitpunktKorrigiertEvent(makeAlarmierungId(payload.alarmierungId), makeEinsatzIdDeser(payload.einsatzId), {
    empfaengerId: makeAlarmierungEmpfaengerId(data.empfaengerId),
    nameSnapshot: data.nameSnapshot,
    feld: data.feld,
    alterWert: data.alterWert ? new Date(data.alterWert) : null,
    neuerWert: data.neuerWert ? new Date(data.neuerWert) : null,
    korrigiertVon: data.korrigiertVon,
  });
  return Result.ok<DomainEvent>(event);
}

function deserializeAlarmierungZeitpunktFmsGesetzt(payload: Record<string, unknown>): Result<DomainEvent> {
  const data = (payload.data ?? {}) as {
    empfaengerId: string;
    nameSnapshot: string;
    feld: ZeitpunktFeld;
    wert: string;
    fmsStatus: number;
  };
  const event = new AlarmierungZeitpunktFmsGesetztEvent(makeAlarmierungId(payload.alarmierungId), makeEinsatzIdDeser(payload.einsatzId), {
    empfaengerId: makeAlarmierungEmpfaengerId(data.empfaengerId),
    nameSnapshot: data.nameSnapshot,
    feld: data.feld,
    wert: new Date(data.wert),
    fmsStatus: data.fmsStatus,
  });
  return Result.ok<DomainEvent>(event);
}

/**
 * **M1:** `abgeschlossenVon` liegt als Top-Level-Property (nicht in `data`).
 */
function deserializeAlarmierungAbgeschlossen(payload: Record<string, unknown>): Result<DomainEvent> {
  const event = new AlarmierungAbgeschlossenEvent(makeAlarmierungId(payload.alarmierungId), makeEinsatzIdDeser(payload.einsatzId), payload.abgeschlossenVon as string);
  return Result.ok<DomainEvent>(event);
}

function deserializeNachalarmierungErstellt(payload: Record<string, unknown>): Result<DomainEvent> {
  const data = (payload.data ?? {}) as { bezeichnung: string; ursprungAlarmierungId: string };
  const event = new NachalarmierungErstelltEvent(makeAlarmierungId(payload.alarmierungId), makeEinsatzIdDeser(payload.einsatzId), {
    bezeichnung: data.bezeichnung,
    ursprungAlarmierungId: makeAlarmierungId(data.ursprungAlarmierungId),
  });
  return Result.ok<DomainEvent>(event);
}

// ===== PATIENT DESERIALIZERS (Story 1.2, Architecture §D-6) =====

const SK_CODE_SET: ReadonlySet<string> = new Set<string>(SK_CODES);

function isSkCode(value: unknown): value is SkCode {
  return typeof value === 'string' && SK_CODE_SET.has(value);
}

function parseErfasserRefData(value: unknown): ErfasserRefData | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ErfasserRefData> & { type?: unknown };
  if (candidate.type === 'user' && typeof candidate.userId === 'string' && candidate.userId.length > 0) {
    return { type: 'user', userId: candidate.userId };
  }
  if (candidate.type === 'device' && typeof candidate.deviceId === 'string' && candidate.deviceId.length > 0) {
    const captureSessionId = typeof candidate.captureSessionId === 'string' && candidate.captureSessionId.length > 0 ? candidate.captureSessionId : undefined;
    return { type: 'device', deviceId: candidate.deviceId, captureSessionId };
  }
  return null;
}

function isSichtungArt(value: unknown): value is SichtungArt {
  return typeof value === 'string' && (SICHTUNG_ARTEN as readonly string[]).includes(value);
}

function parseEventVersion(value: unknown, eventType: string): Result<number> {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return Result.fail<number>(`Invalid payload for ${eventType}: eventVersion invalid`);
  }
  return Result.ok<number>(value);
}

function parseClockDrift(value: unknown, eventType: string): Result<number | undefined> {
  if (value === null || value === undefined) return Result.ok<number | undefined>(undefined);
  if (typeof value === 'number' && Number.isInteger(value)) return Result.ok<number | undefined>(value);
  return Result.fail<number | undefined>(`Invalid payload for ${eventType}: clockDriftSeconds invalid`);
}

function deserializePatientGesichtet(payload: Record<string, unknown>, aggregateId?: string, occurredOn?: Date): Result<DomainEvent> {
  const einsatzId = payload.einsatzId;
  const patientId = aggregateId ?? payload.patientId;
  if (typeof einsatzId !== 'string' || einsatzId.length === 0) {
    return Result.fail<DomainEvent>('Invalid payload for patient.gesichtet: einsatzId missing');
  }
  if (typeof patientId !== 'string' || patientId.length === 0) {
    return Result.fail<DomainEvent>('Invalid payload for patient.gesichtet: patientId missing');
  }
  const versionResult = parseEventVersion(payload.eventVersion, 'patient.gesichtet');
  if (versionResult.isFailure) return Result.fail<DomainEvent>(versionResult.error!);
  if (!isSkCode(payload.sk)) {
    return Result.fail<DomainEvent>('Invalid payload for patient.gesichtet: sk invalid');
  }
  if (!isSichtungArt(payload.sichtungArt)) {
    return Result.fail<DomainEvent>('Invalid payload for patient.gesichtet: sichtungArt invalid');
  }
  const sichter = parseErfasserRefData(payload.sichter);
  if (!sichter) {
    return Result.fail<DomainEvent>('Invalid payload for patient.gesichtet: sichter invalid');
  }
  const driftResult = parseClockDrift(payload.clockDriftSeconds, 'patient.gesichtet');
  if (driftResult.isFailure) return Result.fail<DomainEvent>(driftResult.error!);
  const event = new PatientGesichtet(einsatzId, patientId, versionResult.value!, payload.sk, payload.sichtungArt, sichter, driftResult.value, occurredOn);
  return Result.ok<DomainEvent>(event);
}

function deserializePatientSichtungAktualisiert(payload: Record<string, unknown>, aggregateId?: string, occurredOn?: Date): Result<DomainEvent> {
  const einsatzId = payload.einsatzId;
  const patientId = aggregateId ?? payload.patientId;
  if (typeof einsatzId !== 'string' || einsatzId.length === 0) {
    return Result.fail<DomainEvent>('Invalid payload for patient.sichtung-aktualisiert: einsatzId missing');
  }
  if (typeof patientId !== 'string' || patientId.length === 0) {
    return Result.fail<DomainEvent>('Invalid payload for patient.sichtung-aktualisiert: patientId missing');
  }
  const versionResult = parseEventVersion(payload.eventVersion, 'patient.sichtung-aktualisiert');
  if (versionResult.isFailure) return Result.fail<DomainEvent>(versionResult.error!);
  if (!isSkCode(payload.vorher)) {
    return Result.fail<DomainEvent>('Invalid payload for patient.sichtung-aktualisiert: vorher invalid');
  }
  if (!isSkCode(payload.neu)) {
    return Result.fail<DomainEvent>('Invalid payload for patient.sichtung-aktualisiert: neu invalid');
  }
  if (!isSichtungArt(payload.sichtungArt)) {
    return Result.fail<DomainEvent>('Invalid payload for patient.sichtung-aktualisiert: sichtungArt invalid');
  }
  const sichter = parseErfasserRefData(payload.sichter);
  if (!sichter) {
    return Result.fail<DomainEvent>('Invalid payload for patient.sichtung-aktualisiert: sichter invalid');
  }
  let grund: string | undefined;
  if (payload.grund !== null && payload.grund !== undefined) {
    if (typeof payload.grund !== 'string' || payload.grund.trim().length === 0 || payload.grund.length > 500) {
      return Result.fail<DomainEvent>('Invalid payload for patient.sichtung-aktualisiert: grund invalid');
    }
    grund = payload.grund;
  }
  const driftResult = parseClockDrift(payload.clockDriftSeconds, 'patient.sichtung-aktualisiert');
  if (driftResult.isFailure) return Result.fail<DomainEvent>(driftResult.error!);
  const event = new PatientSichtungAktualisiert(einsatzId, patientId, versionResult.value!, payload.vorher, payload.neu, payload.sichtungArt, sichter, grund, driftResult.value, occurredOn);
  return Result.ok<DomainEvent>(event);
}

function deserializePatientErfasst(payload: Record<string, unknown>, aggregateId?: string, occurredOn?: Date): Result<DomainEvent> {
  const einsatzId = payload.einsatzId;
  const patientId = aggregateId ?? payload.patientId;
  const patientennummer = payload.patientennummer;
  const initialeSk = payload.initialeSk;
  if (typeof einsatzId !== 'string' || einsatzId.length === 0) {
    return Result.fail<DomainEvent>('Invalid payload for patient.erfasst: einsatzId missing');
  }
  if (typeof patientId !== 'string' || patientId.length === 0) {
    return Result.fail<DomainEvent>('Invalid payload for patient.erfasst: patientId missing');
  }
  if (typeof patientennummer !== 'string' || !/^P-\d{3,}$/.test(patientennummer)) {
    return Result.fail<DomainEvent>('Invalid payload for patient.erfasst: patientennummer invalid');
  }
  if (!isSkCode(initialeSk)) {
    return Result.fail<DomainEvent>('Invalid payload for patient.erfasst: initialeSk invalid');
  }
  const erfasserRef = parseErfasserRefData(payload.erfasserRef);
  if (!erfasserRef) {
    return Result.fail<DomainEvent>('Invalid payload for patient.erfasst: erfasserRef invalid');
  }
  const clockDriftSecondsRaw = payload.clockDriftSeconds;
  const clockDriftSeconds =
    clockDriftSecondsRaw === null || clockDriftSecondsRaw === undefined ? undefined : typeof clockDriftSecondsRaw === 'number' && Number.isInteger(clockDriftSecondsRaw) ? clockDriftSecondsRaw : null;
  if (clockDriftSeconds === null) {
    return Result.fail<DomainEvent>('Invalid payload for patient.erfasst: clockDriftSeconds invalid');
  }
  const event = new PatientErfasst(einsatzId, patientId, patientennummer, initialeSk, erfasserRef, clockDriftSeconds, occurredOn);
  return Result.ok<DomainEvent>(event);
}

// ===== EIGENSCHUTZ DESERIALIZERS (Story 2.1) =====

function deserializeGefaehrdungsbeurteilungErstellt(payload: Record<string, unknown>, aggregateId?: string, occurredOn?: Date): Result<DomainEvent> {
  const einsatzId = payload.einsatzId;
  const userId = payload.userId;
  const einheitId = payload.einheitId;
  const gefaehrdungsbeurteilungId = payload.gefaehrdungsbeurteilungId;
  if (typeof einsatzId !== 'string' || typeof userId !== 'string' || typeof einheitId !== 'string' || typeof gefaehrdungsbeurteilungId !== 'string') {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.gefaehrdungsbeurteilung_erstellt');
  }
  const vorlageId = payload.vorlageId == null ? null : String(payload.vorlageId);
  const itemCount = typeof payload.itemCount === 'number' ? payload.itemCount : 0;
  const event = new GefaehrdungsbeurteilungErstelltEvent(einsatzId, userId, einheitId, gefaehrdungsbeurteilungId, vorlageId, itemCount, aggregateId, occurredOn);
  return Result.ok<DomainEvent>(event);
}

const GEFAEHRDUNG_ITEM_FIELD_KEYS: ReadonlySet<string> = new Set(['title', 'description', 'eintritt', 'schaden', 'schutzmassnahmen']);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isFieldKey(value: unknown): value is 'title' | 'description' | 'eintritt' | 'schaden' | 'schutzmassnahmen' {
  return typeof value === 'string' && GEFAEHRDUNG_ITEM_FIELD_KEYS.has(value);
}

function isUpdatedEntry(entry: unknown): entry is { id: string; fields: Array<'title' | 'description' | 'eintritt' | 'schaden' | 'schutzmassnahmen'> } {
  if (typeof entry !== 'object' || entry === null) return false;
  const candidate = entry as { id?: unknown; fields?: unknown };
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) return false;
  if (!Array.isArray(candidate.fields)) return false;
  return candidate.fields.every(isFieldKey);
}

function deserializeGefaehrdungsbeurteilungAktualisiert(payload: Record<string, unknown>, aggregateId?: string, occurredOn?: Date): Result<DomainEvent> {
  const einsatzId = payload.einsatzId;
  const userId = payload.userId;
  const einheitId = payload.einheitId;
  const gefaehrdungsbeurteilungId = payload.gefaehrdungsbeurteilungId;
  const fromVersion = payload.fromVersion;
  const toVersion = payload.toVersion;
  const changedFieldsRaw = payload.changedFields;

  if (
    typeof einsatzId !== 'string' ||
    typeof userId !== 'string' ||
    typeof einheitId !== 'string' ||
    typeof gefaehrdungsbeurteilungId !== 'string' ||
    !Number.isInteger(fromVersion) ||
    !Number.isInteger(toVersion) ||
    typeof changedFieldsRaw !== 'object' ||
    changedFieldsRaw === null
  ) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.gefaehrdungsbeurteilung_aktualisiert');
  }

  // Versionen müssen monoton steigend und korrekt inkrementiert sein — alles
  // andere wäre ein korruptes Outbox-Event. Silent-Fallback wäre ein Audit-
  // Trail-Bruch, darum hier hart rejecten.
  if ((fromVersion as number) < 1 || (toVersion as number) !== (fromVersion as number) + 1) {
    return Result.fail<DomainEvent>('Invalid version progression for eigenschutz.gefaehrdungsbeurteilung_aktualisiert');
  }

  // changedFields-Shape (Story 2.3, AC3/AC7): Arrays mit stringbasierten IDs
  // bzw. `{ id, fields[] }`-Einträgen plus `unchanged: number`. Silent-Fallback
  // auf Defaults würde Audit-Reports verfälschen — darum harter Reject.
  const cf = changedFieldsRaw as Record<string, unknown>;
  if (!isStringArray(cf.added) || !isStringArray(cf.removed) || !Array.isArray(cf.updated) || !cf.updated.every(isUpdatedEntry) || !Number.isInteger(cf.unchanged) || (cf.unchanged as number) < 0) {
    return Result.fail<DomainEvent>('Invalid changedFields for eigenschutz.gefaehrdungsbeurteilung_aktualisiert');
  }

  // Duplikat-IDs in `updated[]` wären ein korrupter Audit-Payload: pro Version
  // darf ein Item genau einmal als „updated" erscheinen (sonst doppelte Feld-
  // Listen pro ID). Aggregate und Serializer erzeugen dies nie, aber ein
  // manipulierter Outbox-Payload soll hier hart rejectet werden.
  const updatedIds = new Set<string>();
  for (const entry of cf.updated as Array<{ id: string; fields: string[] }>) {
    if (updatedIds.has(entry.id)) {
      return Result.fail<DomainEvent>('Invalid changedFields for eigenschutz.gefaehrdungsbeurteilung_aktualisiert: duplicate updated.id');
    }
    updatedIds.add(entry.id);
  }

  const event = new GefaehrdungsbeurteilungAktualisiertEvent(
    einsatzId,
    userId,
    einheitId,
    gefaehrdungsbeurteilungId,
    fromVersion as number,
    toVersion as number,
    {
      added: cf.added as string[],
      removed: cf.removed as string[],
      updated: cf.updated as Array<{ id: string; fields: Array<'title' | 'description' | 'eintritt' | 'schaden' | 'schutzmassnahmen'> }>,
      unchanged: cf.unchanged as number,
    },
    aggregateId,
    occurredOn,
  );
  return Result.ok<DomainEvent>(event);
}

const SICHERHEITSREGEL_FIELD_KEYS: ReadonlySet<string> = new Set(['titel', 'inhalt', 'einheitId']);

function isSicherheitsregelFieldKey(value: unknown): value is 'titel' | 'inhalt' | 'einheitId' {
  return typeof value === 'string' && SICHERHEITSREGEL_FIELD_KEYS.has(value);
}

function deserializeSicherheitsregelAusgerufen(payload: Record<string, unknown>, aggregateId?: string, occurredOn?: Date): Result<DomainEvent> {
  const einsatzId = payload.einsatzId;
  const userId = payload.userId;
  const einheitId = payload.einheitId;
  const regelId = payload.regelId;
  const propagationGroupId = payload.propagationGroupId;
  const fromVersionRaw = payload.fromVersion;
  const toVersionRaw = payload.toVersion;
  const changedFieldsRaw = payload.changedFields;
  const titel = payload.titel;
  const inhalt = payload.inhalt;

  // Grund-Shape: Pflichtfelder aus der 2.6-Event-Definition. `einheitId` darf
  // null/undefined sein (regel-ohne-Einheit), muss aber vor dem Constructor
  // in `undefined` normalisiert werden — die Domain-Klasse akzeptiert
  // `string | undefined`.
  if (
    typeof einsatzId !== 'string' ||
    typeof userId !== 'string' ||
    typeof regelId !== 'string' ||
    typeof propagationGroupId !== 'string' ||
    typeof titel !== 'string' ||
    typeof inhalt !== 'string' ||
    typeof changedFieldsRaw !== 'object' ||
    changedFieldsRaw === null
  ) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.sicherheitsregel_ausgerufen');
  }

  if (einheitId !== undefined && einheitId !== null && typeof einheitId !== 'string') {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.sicherheitsregel_ausgerufen');
  }

  // `fromVersion: null` markiert den Create-Pfad, alles andere muss positive
  // Integer-Version sein. Silent-Fallback würde Audit-Trail brechen (Story
  // 2.6 AC2/AC4), darum harter Reject.
  const isCreate = fromVersionRaw === null;
  if (!isCreate && (!Number.isInteger(fromVersionRaw) || (fromVersionRaw as number) < 1)) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.sicherheitsregel_ausgerufen');
  }
  if (!Number.isInteger(toVersionRaw) || (toVersionRaw as number) < 1) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.sicherheitsregel_ausgerufen');
  }

  const fromVersion = isCreate ? null : (fromVersionRaw as number);
  const toVersion = toVersionRaw as number;

  // changedFields-Shape (Story 2.6): genau einer der Modi `created`/`updated`/
  // `deprecated` darf gesetzt sein. Der Modus muss zur Versions-Progression
  // passen, sonst liegt ein korrupter Payload vor.
  const cf = changedFieldsRaw as Record<string, unknown>;
  const hasCreated = cf.created !== undefined;
  const hasUpdated = cf.updated !== undefined;
  const hasDeprecated = cf.deprecated !== undefined;
  const modeCount = (hasCreated ? 1 : 0) + (hasUpdated ? 1 : 0) + (hasDeprecated ? 1 : 0);
  if (modeCount !== 1) {
    return Result.fail<DomainEvent>('Invalid changedFields for eigenschutz.sicherheitsregel_ausgerufen');
  }

  const changedFields: { created?: boolean; updated?: Array<'titel' | 'inhalt' | 'einheitId'>; deprecated?: boolean } = {};

  if (hasCreated) {
    if (cf.created !== true || !isCreate || toVersion !== 1) {
      return Result.fail<DomainEvent>('Invalid version progression for eigenschutz.sicherheitsregel_ausgerufen');
    }
    changedFields.created = true;
  } else if (hasDeprecated) {
    if (cf.deprecated !== true || isCreate || toVersion !== (fromVersion as number)) {
      return Result.fail<DomainEvent>('Invalid version progression for eigenschutz.sicherheitsregel_ausgerufen');
    }
    changedFields.deprecated = true;
  } else {
    // Update-Pfad: fromVersion + 1 === toVersion, updated[] enthält mindestens
    // einen bekannten Feld-Schlüssel ohne Duplikate.
    if (isCreate || toVersion !== (fromVersion as number) + 1) {
      return Result.fail<DomainEvent>('Invalid version progression for eigenschutz.sicherheitsregel_ausgerufen');
    }
    if (!Array.isArray(cf.updated) || cf.updated.length === 0 || !cf.updated.every(isSicherheitsregelFieldKey)) {
      return Result.fail<DomainEvent>('Invalid changedFields for eigenschutz.sicherheitsregel_ausgerufen');
    }
    const seen = new Set<string>();
    for (const field of cf.updated) {
      if (seen.has(field)) {
        return Result.fail<DomainEvent>('Invalid changedFields for eigenschutz.sicherheitsregel_ausgerufen: duplicate updated field');
      }
      seen.add(field);
    }
    changedFields.updated = cf.updated as Array<'titel' | 'inhalt' | 'einheitId'>;
  }

  const normalizedEinheitId = typeof einheitId === 'string' ? einheitId : undefined;
  const event = new SicherheitsregelAusgerufenEvent(einsatzId, userId, normalizedEinheitId, regelId, propagationGroupId, fromVersion, toVersion, changedFields, titel, inhalt, aggregateId, occurredOn);
  return Result.ok<DomainEvent>(event);
}

/**
 * Deserializer für `eigenschutz.sicherheitsregel_quittiert` (Story 2.7).
 *
 * Strikte Typ-Guards: `einheitId` ist Pflicht-String (anders als beim
 * Ausgerufen-Event, das `null` für einsatzweit erlaubt — eine Quittung ist
 * immer einheitenscharf). `propagationGroupId` darf `null` sein.
 */
function deserializeSicherheitsregelQuittiert(payload: Record<string, unknown>, aggregateId?: string, occurredOn?: Date): Result<DomainEvent> {
  const einsatzId = payload.einsatzId;
  const userId = payload.userId;
  const einheitId = payload.einheitId;
  const regelId = payload.regelId;
  const propagationGroupIdRaw = payload.propagationGroupId;
  const quittiertAmRaw = payload.quittiertAm;

  if (typeof einsatzId !== 'string' || typeof userId !== 'string' || typeof einheitId !== 'string' || typeof regelId !== 'string') {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.sicherheitsregel_quittiert');
  }
  if (propagationGroupIdRaw !== null && typeof propagationGroupIdRaw !== 'string') {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.sicherheitsregel_quittiert');
  }
  if (typeof quittiertAmRaw !== 'string') {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.sicherheitsregel_quittiert');
  }
  const quittiertAm = new Date(quittiertAmRaw);
  if (Number.isNaN(quittiertAm.getTime())) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.sicherheitsregel_quittiert');
  }

  const event = new SicherheitsregelQuittiertEvent(einsatzId, userId, einheitId, regelId, propagationGroupIdRaw as string | null, quittiertAm, aggregateId, occurredOn);
  return Result.ok<DomainEvent>(event);
}

const PSA_PROFIL_VALUES = new Set(Object.values(PsaProfil));

function isPsaProfil(value: unknown): value is (typeof PsaProfil)[keyof typeof PsaProfil] {
  return typeof value === 'string' && PSA_PROFIL_VALUES.has(value as (typeof PsaProfil)[keyof typeof PsaProfil]);
}

function isPsaProfilAktion(value: unknown): value is PsaProfilAktion {
  return value === 'AKTIVIERT' || value === 'DEAKTIVIERT';
}

/**
 * Deserializer für `eigenschutz.psa_profil_geaendert` (Story 3.1).
 *
 * Pflichtfelder: einsatzId, userId, einheitId, zuweisungId,
 * propagationGroupId, profil (Enum), aktion (`AKTIVIERT`/`DEAKTIVIERT`),
 * begruendung. Strikte Validierung — der Replay verweigert korrupte Payloads.
 */
function deserializePsaProfilGeaendert(payload: Record<string, unknown>, aggregateId?: string, occurredOn?: Date): Result<DomainEvent> {
  const einsatzId = payload.einsatzId;
  const userId = payload.userId;
  const einheitId = payload.einheitId;
  const zuweisungId = payload.zuweisungId;
  const propagationGroupId = payload.propagationGroupId;
  const profil = payload.profil;
  const aktion = payload.aktion;
  const begruendung = payload.begruendung;

  if (
    typeof einsatzId !== 'string' ||
    typeof userId !== 'string' ||
    typeof einheitId !== 'string' ||
    typeof zuweisungId !== 'string' ||
    typeof propagationGroupId !== 'string' ||
    typeof begruendung !== 'string'
  ) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.psa_profil_geaendert');
  }
  if (!isPsaProfil(profil) || !isPsaProfilAktion(aktion)) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.psa_profil_geaendert');
  }
  // Pflichtfelder dürfen keine Whitespace-only Strings sein — Aggregate-
  // `reconstitute` würde sonst später fehlschlagen, mit unklarerem Fehler-Pfad
  // (Code-Review P-22 / P-28).
  if (
    einsatzId.trim().length === 0 ||
    userId.trim().length === 0 ||
    einheitId.trim().length === 0 ||
    zuweisungId.trim().length === 0 ||
    propagationGroupId.trim().length === 0 ||
    begruendung.trim().length === 0
  ) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.psa_profil_geaendert: leere Pflichtfelder');
  }

  const event = new PsaProfilGeaendertEvent(einsatzId, userId, einheitId, zuweisungId, propagationGroupId, profil, aktion, begruendung, aggregateId, occurredOn);
  return Result.ok<DomainEvent>(event);
}

/**
 * Deserializer für `eigenschutz.quittung_abgegeben` (Story 3.4).
 *
 * Pflichtfelder: einsatzId, userId, einheitId, propagationGroupId,
 * quittiertAm. Strikte Typ-Guards — der Replay verweigert korrupte Payloads.
 */
function deserializeQuittungAbgegeben(payload: Record<string, unknown>, aggregateId?: string, occurredOn?: Date): Result<DomainEvent> {
  const einsatzId = payload.einsatzId;
  const userId = payload.userId;
  const einheitId = payload.einheitId;
  const propagationGroupId = payload.propagationGroupId;
  const quittiertAmRaw = payload.quittiertAm;

  if (typeof einsatzId !== 'string' || typeof userId !== 'string' || typeof einheitId !== 'string' || typeof propagationGroupId !== 'string') {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.quittung_abgegeben');
  }
  if (typeof quittiertAmRaw !== 'string') {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.quittung_abgegeben');
  }
  const quittiertAm = new Date(quittiertAmRaw);
  if (Number.isNaN(quittiertAm.getTime())) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.quittung_abgegeben');
  }

  const event = new QuittungAbgegebenEvent(einsatzId, userId, einheitId, propagationGroupId, quittiertAm, aggregateId, occurredOn);
  return Result.ok<DomainEvent>(event);
}

/**
 * Deserializer für `eigenschutz.luecke_gemeldet` (Story 3.6, FR20).
 *
 * Pflichtfelder: einsatzId, userId, einheitId, propagationGroupId, meldung,
 * gemeldetAm. Strikte Typ-Guards — der Replay verweigert korrupte Payloads.
 */
function deserializeLueckeGemeldet(payload: Record<string, unknown>, aggregateId?: string, occurredOn?: Date): Result<DomainEvent> {
  const einsatzId = payload.einsatzId;
  const userId = payload.userId;
  const einheitId = payload.einheitId;
  const propagationGroupId = payload.propagationGroupId;
  const meldung = payload.meldung;
  const gemeldetAmRaw = payload.gemeldetAm;

  if (typeof einsatzId !== 'string' || typeof userId !== 'string' || typeof einheitId !== 'string' || typeof propagationGroupId !== 'string' || typeof meldung !== 'string') {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.luecke_gemeldet');
  }
  if (typeof gemeldetAmRaw !== 'string') {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.luecke_gemeldet');
  }
  const gemeldetAm = new Date(gemeldetAmRaw);
  if (Number.isNaN(gemeldetAm.getTime())) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.luecke_gemeldet');
  }

  const event = new LueckeGemeldetEvent(einsatzId, userId, einheitId, propagationGroupId, meldung, gemeldetAm, aggregateId, occurredOn);
  return Result.ok<DomainEvent>(event);
}

/**
 * Deserializer für `eigenschutz.quittung_ueberfaellig` (Story 3.7, AR12).
 *
 * Pflichtfelder: einsatzId, einheitId, propagationGroupId, originalEventId,
 * ueberfaelligSeitMin (≥ 0, integer), zuweisungId (string | null).
 * `userId` muss `'SYSTEM'`-Sentinel sein — sonst Verstoß gegen Scheduler-Vertrag.
 */
function deserializeQuittungUeberfaellig(payload: Record<string, unknown>, aggregateId?: string, occurredOn?: Date): Result<DomainEvent> {
  const einsatzId = payload.einsatzId;
  const einheitId = payload.einheitId;
  const propagationGroupId = payload.propagationGroupId;
  const originalEventId = payload.originalEventId;
  const ueberfaelligSeitMin = payload.ueberfaelligSeitMin;
  const zuweisungId = payload.zuweisungId;

  if (typeof einsatzId !== 'string' || typeof einheitId !== 'string' || typeof propagationGroupId !== 'string' || typeof originalEventId !== 'string') {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.quittung_ueberfaellig');
  }
  if (typeof ueberfaelligSeitMin !== 'number' || !Number.isInteger(ueberfaelligSeitMin) || ueberfaelligSeitMin < 0) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.quittung_ueberfaellig');
  }
  if (zuweisungId !== null && typeof zuweisungId !== 'string') {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.quittung_ueberfaellig');
  }

  const event = new QuittungUeberfaelligEvent(einsatzId, einheitId, propagationGroupId, originalEventId, ueberfaelligSeitMin, zuweisungId, aggregateId, occurredOn);
  return Result.ok<DomainEvent>(event);
}

/**
 * Deserializer für `eigenschutz.konflikt_erkannt` (Story 3.9, FR50).
 *
 * Pflichtfelder: einsatzId, userId (= reportedByUserId), einheitId (string | null),
 * entityType (∈ SyncConflictEntityType), entityId, fieldPath (length 1..200),
 * serverVersion und localExpectedVersion (integer ≥ 1), localPayload (Object).
 *
 * Round-Trip-Vertrag: `serialize → deserialize → serialize` ergibt identische
 * Payloads. Strikte Defense-Validation, weil ein corrupteter Outbox-Eintrag
 * sonst beim Replay einen UI-Banner mit Garbage-Daten liefern würde.
 */
// Story 3.9 — Modul-Konstante (statt Funktionsrumpf-Allokation pro
// Deserialisierungs-Aufruf, Code-Review P12).
const KONFLIKT_ERKANNT_ALLOWED_ENTITY_TYPES: ReadonlyArray<SyncConflictEntityType> = ['PSA_PROFIL_ZUWEISUNG', 'GEFAEHRDUNGSBEURTEILUNG_ITEM'];

function deserializeKonfliktErkannt(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const einsatzId = payload.einsatzId;
  const userId = payload.userId;
  const einheitId = payload.einheitId;
  const entityType = payload.entityType;
  const entityId = payload.entityId;
  const fieldPath = payload.fieldPath;
  const localPayload = payload.localPayload;
  const serverVersion = payload.serverVersion;
  const localExpectedVersion = payload.localExpectedVersion;

  if (typeof einsatzId !== 'string' || typeof userId !== 'string' || typeof entityId !== 'string') {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.konflikt_erkannt');
  }
  if (einheitId !== null && typeof einheitId !== 'string') {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.konflikt_erkannt');
  }
  if (typeof entityType !== 'string' || !KONFLIKT_ERKANNT_ALLOWED_ENTITY_TYPES.includes(entityType as SyncConflictEntityType)) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.konflikt_erkannt');
  }
  if (typeof fieldPath !== 'string' || fieldPath.length < 1 || fieldPath.length > 200) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.konflikt_erkannt');
  }
  if (typeof serverVersion !== 'number' || !Number.isInteger(serverVersion) || serverVersion < 1) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.konflikt_erkannt');
  }
  if (typeof localExpectedVersion !== 'number' || !Number.isInteger(localExpectedVersion) || localExpectedVersion < 1) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.konflikt_erkannt');
  }
  if (typeof localPayload !== 'object' || localPayload === null || Array.isArray(localPayload)) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.konflikt_erkannt');
  }

  const event = new KonfliktErkanntEvent(
    einsatzId,
    userId,
    einheitId as string | null,
    entityType as SyncConflictEntityType,
    entityId,
    fieldPath,
    localPayload as Record<string, unknown>,
    serverVersion,
    localExpectedVersion,
    aggregateId,
  );
  return Result.ok<DomainEvent>(event);
}

/**
 * Deserializer für `eigenschutz.konflikt_aufgeloest` (Story 3.10, FR50).
 *
 * Pflichtfelder: einsatzId, userId (= resolvedByUserId), einheitId (string | null),
 * syncConflictId, entityType (∈ SyncConflictEntityType), entityId,
 * fieldPath (length 1..200), resolution (∈ SyncConflictResolution),
 * resolvedAt (ISO-String).
 *
 * Round-Trip-Vertrag: `serialize → deserialize → serialize` ergibt identische
 * Payloads. Strikte Defense-Validation, weil ein corrupteter Outbox-Eintrag
 * sonst beim Replay einen Banner mit Garbage-Daten liefern würde.
 */
const KONFLIKT_AUFGELOEST_ALLOWED_ENTITY_TYPES: ReadonlyArray<SyncConflictEntityType> = ['PSA_PROFIL_ZUWEISUNG', 'GEFAEHRDUNGSBEURTEILUNG_ITEM'];
const KONFLIKT_AUFGELOEST_ALLOWED_RESOLUTIONS: ReadonlyArray<SyncConflictResolution> = ['SERVER_WINS', 'LOCAL_WINS', 'MERGED'];

function deserializeKonfliktAufgeloest(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const einsatzId = payload.einsatzId;
  const userId = payload.userId;
  const einheitId = payload.einheitId;
  const syncConflictId = payload.syncConflictId;
  const entityType = payload.entityType;
  const entityId = payload.entityId;
  const fieldPath = payload.fieldPath;
  const resolution = payload.resolution;
  const resolvedAt = payload.resolvedAt;

  if (typeof einsatzId !== 'string' || typeof userId !== 'string' || typeof entityId !== 'string' || typeof syncConflictId !== 'string') {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.konflikt_aufgeloest');
  }
  if (einheitId !== null && typeof einheitId !== 'string') {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.konflikt_aufgeloest');
  }
  if (typeof entityType !== 'string' || !KONFLIKT_AUFGELOEST_ALLOWED_ENTITY_TYPES.includes(entityType as SyncConflictEntityType)) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.konflikt_aufgeloest');
  }
  if (typeof fieldPath !== 'string' || fieldPath.length < 1 || fieldPath.length > 200) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.konflikt_aufgeloest');
  }
  if (typeof resolution !== 'string' || !KONFLIKT_AUFGELOEST_ALLOWED_RESOLUTIONS.includes(resolution as SyncConflictResolution)) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.konflikt_aufgeloest');
  }
  if (typeof resolvedAt !== 'string') {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.konflikt_aufgeloest');
  }
  const resolvedAtDate = new Date(resolvedAt);
  if (Number.isNaN(resolvedAtDate.getTime())) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.konflikt_aufgeloest');
  }

  const event = new KonfliktAufgeloestEvent(
    einsatzId,
    userId,
    einheitId as string | null,
    syncConflictId,
    entityType as SyncConflictEntityType,
    entityId,
    fieldPath,
    resolution as SyncConflictResolution,
    resolvedAtDate,
    aggregateId,
  );
  return Result.ok<DomainEvent>(event);
}

/**
 * Deserialisiert SicherungspostenEingerichtetEvent (Story 4.1).
 */
function deserializeSicherungspostenEingerichtet(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const einsatzId = payload.einsatzId;
  const userId = payload.userId;
  const einheitId = payload.einheitId;
  const sicherungspostenId = payload.sicherungspostenId;
  const bezeichnung = payload.bezeichnung;
  const standortKind = payload.standortKind;
  const personalCount = payload.personalCount;

  if (
    typeof einsatzId !== 'string' ||
    typeof userId !== 'string' ||
    (einheitId !== null && typeof einheitId !== 'string') ||
    typeof sicherungspostenId !== 'string' ||
    typeof bezeichnung !== 'string' ||
    bezeichnung.length < 1 ||
    bezeichnung.length > 200 ||
    (standortKind !== 'coordinate' && standortKind !== 'address') ||
    typeof personalCount !== 'number' ||
    !Number.isInteger(personalCount) ||
    personalCount < 0
  ) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.sicherungsposten_eingerichtet');
  }

  const event = new SicherungspostenEingerichtetEvent(einsatzId, userId, sicherungspostenId, bezeichnung, standortKind, personalCount, einheitId === null ? undefined : einheitId, aggregateId);
  return Result.ok<DomainEvent>(event);
}

/**
 * Deserialisiert SicherungspostenAktualisiertEvent (Story 4.1).
 */
const SICHERUNGSPOSTEN_ALLOWED_FIELD_KEYS: ReadonlyArray<SicherungspostenFieldKey> = ['bezeichnung', 'standort', 'personal', 'einheitId', 'zustaendigkeitsbereich', 'abloesezeiten', 'aufgeloest'];

function deserializeSicherungspostenAktualisiert(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const einsatzId = payload.einsatzId;
  const userId = payload.userId;
  const einheitId = payload.einheitId;
  const sicherungspostenId = payload.sicherungspostenId;
  const fromVersion = payload.fromVersion;
  const toVersion = payload.toVersion;
  const changedFieldsRaw = payload.changedFields;

  if (
    typeof einsatzId !== 'string' ||
    typeof userId !== 'string' ||
    (einheitId !== null && typeof einheitId !== 'string') ||
    typeof sicherungspostenId !== 'string' ||
    typeof fromVersion !== 'number' ||
    typeof toVersion !== 'number' ||
    !Number.isInteger(fromVersion) ||
    !Number.isInteger(toVersion) ||
    fromVersion < 1 ||
    toVersion !== fromVersion + 1
  ) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.sicherungsposten_aktualisiert');
  }
  if (!changedFieldsRaw || typeof changedFieldsRaw !== 'object' || Array.isArray(changedFieldsRaw)) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.sicherungsposten_aktualisiert');
  }
  const changedFieldsObj = changedFieldsRaw as Record<string, unknown>;
  const changedRaw = changedFieldsObj.changed;
  if (!Array.isArray(changedRaw) || changedRaw.length === 0) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.sicherungsposten_aktualisiert');
  }
  for (const entry of changedRaw) {
    if (typeof entry !== 'string' || !SICHERUNGSPOSTEN_ALLOWED_FIELD_KEYS.includes(entry as SicherungspostenFieldKey)) {
      return Result.fail<DomainEvent>('Invalid payload for eigenschutz.sicherungsposten_aktualisiert');
    }
  }
  const aufgeloest = changedFieldsObj.aufgeloest;
  if (aufgeloest !== undefined && aufgeloest !== true) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.sicherungsposten_aktualisiert');
  }
  // Invariante: enthält changed das 'aufgeloest'-Token, MUSS aufgeloest=true gesetzt sein —
  // sonst wäre der Resolved-Übergang im Audit/Telemetry-Stream nicht erkennbar.
  const changedIncludesAufgeloest = (changedRaw as string[]).includes('aufgeloest');
  if (changedIncludesAufgeloest && aufgeloest !== true) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.sicherungsposten_aktualisiert');
  }
  if (aufgeloest === true && !changedIncludesAufgeloest) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.sicherungsposten_aktualisiert');
  }

  const changedFields: SicherungspostenAktualisiertChangedFields = {
    changed: changedRaw as SicherungspostenFieldKey[],
    ...(aufgeloest === true ? { aufgeloest: true as const } : {}),
  };

  const event = new SicherungspostenAktualisiertEvent(einsatzId, userId, sicherungspostenId, fromVersion, toVersion, changedFields, einheitId === null ? undefined : einheitId, aggregateId);
  return Result.ok<DomainEvent>(event);
}

/**
 * Deserialisiert VorfallGemeldetEvent (Story 5.1, FR31/FR32).
 */
function deserializeVorfallGemeldet(payload: Record<string, unknown>, aggregateId?: string, occurredOn?: Date): Result<DomainEvent> {
  const einsatzId = payload.einsatzId;
  const userId = payload.userId;
  const einheitId = payload.einheitId;
  const vorfallId = payload.vorfallId;
  const vorfallZeitRaw = payload.vorfallZeit;
  const unfallkasseRelevant = payload.unfallkasseRelevant;

  if (
    typeof einsatzId !== 'string' ||
    typeof userId !== 'string' ||
    typeof einheitId !== 'string' ||
    typeof vorfallId !== 'string' ||
    typeof vorfallZeitRaw !== 'string' ||
    typeof unfallkasseRelevant !== 'boolean'
  ) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.vorfall_gemeldet');
  }

  const vorfallZeit = new Date(vorfallZeitRaw);
  if (Number.isNaN(vorfallZeit.getTime())) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.vorfall_gemeldet');
  }

  const event = new VorfallGemeldetEvent(einsatzId, userId, einheitId, vorfallId, vorfallZeit, unfallkasseRelevant, aggregateId, occurredOn);
  return Result.ok<DomainEvent>(event);
}

/**
 * Deserialisiert VorfallGeschlossenEvent (Issue #415).
 */
function deserializeVorfallGeschlossen(payload: Record<string, unknown>, aggregateId?: string, occurredOn?: Date): Result<DomainEvent> {
  const einsatzId = payload.einsatzId;
  const userId = payload.userId;
  const einheitId = payload.einheitId;
  const vorfallId = payload.vorfallId;
  const geschlossenAmRaw = payload.geschlossenAm;

  if (typeof einsatzId !== 'string' || typeof userId !== 'string' || typeof einheitId !== 'string' || typeof vorfallId !== 'string' || typeof geschlossenAmRaw !== 'string') {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.vorfall_geschlossen');
  }

  const geschlossenAm = new Date(geschlossenAmRaw);
  if (Number.isNaN(geschlossenAm.getTime())) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.vorfall_geschlossen');
  }

  const event = new VorfallGeschlossenEvent(einsatzId, userId, einheitId, vorfallId, geschlossenAm, aggregateId, occurredOn);
  return Result.ok<DomainEvent>(event);
}

/**
 * Deserialisiert VorfallExportiertEvent (Story 5.6).
 */
function deserializeVorfallExportiert(payload: Record<string, unknown>, aggregateId?: string): Result<DomainEvent> {
  const einsatzId = payload.einsatzId;
  const userId = payload.userId;
  const vorfallId = payload.vorfallId;
  const format = payload.format;
  const downloadedAtRaw = payload.downloadedAt;

  if (typeof einsatzId !== 'string' || typeof userId !== 'string' || typeof vorfallId !== 'string' || (format !== 'pdf' && format !== 'json') || typeof downloadedAtRaw !== 'string') {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.vorfall_exportiert');
  }

  const downloadedAt = new Date(downloadedAtRaw);
  if (Number.isNaN(downloadedAt.getTime())) {
    return Result.fail<DomainEvent>('Invalid payload for eigenschutz.vorfall_exportiert');
  }

  const event = new VorfallExportiertEvent(einsatzId, userId, vorfallId, format as VorfallExportFormat, downloadedAt, aggregateId);
  return Result.ok<DomainEvent>(event);
}
