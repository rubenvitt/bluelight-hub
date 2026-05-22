/**
 * Zentrale Constants für Domain Event Namen.
 *
 * Verhindert Magic Strings in Event Handlers und Domain Events.
 * Analog zu DI_TOKENS für Dependency Injection Tokens.
 *
 * **Warum Constants statt String Literals?**
 * - Type Safety: IDE Auto-Completion für Event-Namen
 * - Refactoring: Umbenennen von Events ist sicher (keine String-Suche)
 * - Typo-Vermeidung: Verhindert "einsatz.craeted" statt "einsatz.created"
 * - Single Source of Truth: Event-Namen an einem zentralen Ort definiert
 *
 * **Naming Convention:**
 * - Lowercase, dot-separated für Event-Hierarchie (z.B. "einsatz.created")
 * - Underscore für multi-word Events (z.B. "einsatz.status_changed")
 * - Past Tense: Events repräsentieren historische Fakten ("created", nicht "create")
 *
 * @example
 * ```typescript
 * // ✅ RICHTIG: Constants verwenden
 * import { EVENT_NAMES } from '@domain/events/event-names';
 *
 * @OnEvent(EVENT_NAMES.EINSATZ.CREATED)
 * async handleEinsatzCreated(event: EinsatzCreatedEvent) { ... }
 *
 * // In Domain Event Class:
 * static eventName(): string {
 *   return EVENT_NAMES.EINSATZ.CREATED;
 * }
 *
 * // ❌ FALSCH: Magic String Literals
 * @OnEvent('einsatz.created') // Typo-anfällig!
 * async handleEinsatzCreated(event: EinsatzCreatedEvent) { ... }
 * ```
 */
export const EVENT_NAMES = {
  /**
   * Einsatz Bounded Context Events
   */
  EINSATZ: {
    /** Event: Neuer Einsatz wurde erstellt */
    CREATED: 'einsatz.created',
    /** Event: Existierender Einsatz wurde aktualisiert */
    UPDATED: 'einsatz.updated',
    /** Event: Einsatz wurde abgeschlossen */
    COMPLETED: 'einsatz.completed',
    /** Event: Einsatz wurde archiviert */
    ARCHIVED: 'einsatz.archived',
    /** Event: Einsatz-Status hat sich geändert */
    STATUS_CHANGED: 'einsatz.status_changed',
  },

  /**
   * Eigenschutz Bounded Context Events (Story 1.7 / Epic 2–5).
   *
   * Die 14 Namen sind pre-allocated nach Architecture §B13 (Event-Katalog
   * MVP, `architecture.md:734-751`). Story 1.7 liefert nur das Framework
   * (Basisklasse + Namespace + Konsistenz-Spec); konkrete Event-Klassen und
   * die vollständige 4-Stellen-Registrierung (Serializer-Switch,
   * Deserializer-Map, AdaptersModule-Provider, Adapters-Barrel) liefern
   * Epic 2.1 – Epic 5 pro Event.
   *
   * **Konsistenz-Invariante:** Die Spec
   * `infrastructure/outbox/__tests__/eigenschutz-event-registry.spec.ts`
   * prüft für jeden dieser Namen, dass die Registrierung entweder **0 oder 4
   * Stellen** umfasst — niemals 1, 2 oder 3 (NFR-I3-Härtung, ADR-006-Scope).
   *
   * **Broadcast-Scope (ADR-006):** Alle Eigenschutz-Events werden per
   * WebSocket an den Room `einsatz:{einsatzId}` ausgeliefert; die
   * Basisklasse `EigenschutzDomainEvent` erzwingt dafür das Pflichtfeld
   * `einsatzId`.
   */
  EIGENSCHUTZ: {
    /** Event: Neue Gefährdungsbeurteilung angelegt (auch aus Vorlage) */
    GEFAEHRDUNGSBEURTEILUNG_ERSTELLT: 'eigenschutz.gefaehrdungsbeurteilung_erstellt',
    /** Event: Gefährdungsbeurteilung aktualisiert (Item add/change/remove; neue Version) */
    GEFAEHRDUNGSBEURTEILUNG_AKTUALISIERT: 'eigenschutz.gefaehrdungsbeurteilung_aktualisiert',
    /** Event: PSA-Profil einer Einheit wurde aktiviert/deaktiviert (kritisch) */
    PSA_PROFIL_GEAENDERT: 'eigenschutz.psa_profil_geaendert',
    /** Event: Sicherheitsregel ausgerufen/aktualisiert */
    SICHERHEITSREGEL_AUSGERUFEN: 'eigenschutz.sicherheitsregel_ausgerufen',
    /** Event: Sicherheitsregel wurde quittiert (Abschnittsleiter) */
    SICHERHEITSREGEL_QUITTIERT: 'eigenschutz.sicherheitsregel_quittiert',
    /** Event: Sicherungsposten eingerichtet (CRUD-Create) */
    SICHERUNGSPOSTEN_EINGERICHTET: 'eigenschutz.sicherungsposten_eingerichtet',
    /** Event: Sicherungsposten aktualisiert (CRUD-Update) */
    SICHERUNGSPOSTEN_AKTUALISIERT: 'eigenschutz.sicherungsposten_aktualisiert',
    /** Event: Vorfall gemeldet (mit Kontext-Snapshot) */
    VORFALL_GEMELDET: 'eigenschutz.vorfall_gemeldet',
    /** Event: Vorfall geschlossen (Issue #415 — additive Closure-Metadaten) */
    VORFALL_GESCHLOSSEN: 'eigenschutz.vorfall_geschlossen',
    /** Event: Vorfall exportiert (Unfallkassen-Export) */
    VORFALL_EXPORTIERT: 'eigenschutz.vorfall_exportiert',
    /** Event: Abschnittsleiter bestätigt PSA-Änderung / Regel (Quittung) */
    QUITTUNG_ABGEGEBEN: 'eigenschutz.quittung_abgegeben',
    /** Event: Rück-Eskalation — fehlende Ausrüstung gemeldet */
    LUECKE_GEMELDET: 'eigenschutz.luecke_gemeldet',
    /** Event: Scheduler — Quittung seit > 5 min offen (Eskalation) */
    QUITTUNG_UEBERFAELLIG: 'eigenschutz.quittung_ueberfaellig',
    /** Event: Sync-Konflikt auf kritischem Eigenschutz-Feld erkannt */
    KONFLIKT_ERKANNT: 'eigenschutz.konflikt_erkannt',
    /** Event: Sync-Konflikt wurde manuell aufgelöst (Sicherheitsbeauftragter) */
    KONFLIKT_AUFGELOEST: 'eigenschutz.konflikt_aufgeloest',
  },

  /**
   * Einsatztagebuch (ETB) Bounded Context Events
   */
  ETB: {
    /** Event: Neues ETB wurde erstellt */
    CREATED: 'etb.created',
    /** Event: ETB wurde gesperrt (finale Transition) */
    LOCKED: 'etb.locked',
    /** Event: Eintrag wurde zum ETB hinzugefügt */
    EINTRAG_ADDED: 'etb.eintrag_added',
    /** Event: Eintrag wurde aktualisiert */
    EINTRAG_UPDATED: 'etb.eintrag_updated',
    /** Event: Eintrag wurde gelöscht (Soft-Delete) */
    EINTRAG_DELETED: 'etb.eintrag_deleted',
    /** Event: Eintrag wurde durch Korrektur-Eintrag ersetzt */
    EINTRAG_KORRIGIERT: 'etb.eintrag_korrigiert',
  },

  /**
   * Lagekarte Bounded Context Events
   */
  LAGEKARTE: {
    /** Event: Neue Lagekarte wurde erstellt */
    CREATED: 'lagekarte.created',
    /** Event: POI wurde zur Lagekarte hinzugefügt */
    POI_ADDED: 'lagekarte.poi_added',
    /** Event: POI wurde von Lagekarte entfernt */
    POI_REMOVED: 'lagekarte.poi_removed',
    /** Event: POI-Position wurde aktualisiert */
    POI_POSITION_UPDATED: 'lagekarte.poi_position_updated',
    /** Event: Lagekarte-Zeichnungs-State wurde aktualisiert (Issue #638) */
    STATE_GEAENDERT: 'lagekarte.state_geaendert',
  },

  /**
   * User Bounded Context Events
   */
  USER: {
    /** Event: Neuer User wurde erstellt */
    CREATED: 'user.created',
    /** Event: User wurde gelöscht */
    DELETED: 'user.deleted',
    /** Event: User-Role wurde geändert */
    ROLE_CHANGED: 'user.role_changed',
    /** Event: Permission wurde einem User gewährt */
    PERMISSION_GRANTED: 'user.permission_granted',
    /** Event: Permission wurde einem User entzogen */
    PERMISSION_REVOKED: 'user.permission_revoked',
    /** Event: User wurde gesperrt */
    LOCKED: 'user.locked',
    /** Event: User wurde entsperrt */
    UNLOCKED: 'user.unlocked',
  },

  /**
   * Server Access Token Bounded Context Events
   */
  SERVER_ACCESS_TOKEN: {
    /** Event: Neues Server Access Token wurde erstellt */
    CREATED: 'server_access_token.created',
    /** Event: Server Access Token wurde verwendet */
    USED: 'server_access_token.used',
    /** Event: Server Access Token wurde widerrufen */
    REVOKED: 'server_access_token.revoked',
    /** Event: Server Access Token wurde reaktiviert */
    REACTIVATED: 'server_access_token.reactivated',
    /** Event: Server Access Token wurde rotiert (altes widerrufen, neues erstellt) */
    ROTATED: 'server_access_token.rotated',
  },

  /**
   * Invite Code Bounded Context Events
   */
  INVITE_CODE: {
    /** Event: Neuer Invite-Code wurde erstellt */
    CREATED: 'invite_code.created',
    /** Event: Invite-Code wurde eingelöst */
    USED: 'invite_code.used',
    /** Event: Invite-Code wurde widerrufen */
    REVOKED: 'invite_code.revoked',
  },

  /**
   * Server Config Bounded Context Events (Story 4.6)
   */
  SERVER_CONFIG: {
    /** Event: Server wurde von INSECURE zu SECURE Mode migriert */
    MIGRATED_TO_SECURE: 'server_config.migrated_to_secure',
  },

  /**
   * Erinnerung Bounded Context Events (Story 1.1+)
   */
  ERINNERUNG: {
    /** Event: Neue Erinnerung wurde erstellt */
    ERSTELLT: 'erinnerung.erstellt',
    /** Event: Existierende Erinnerung wurde aktualisiert (Story 1.3) */
    AKTUALISIERT: 'erinnerung.aktualisiert',
    /** Event: Erinnerung wurde ausgelöst (Timer abgelaufen) */
    AUSGELOEST: 'erinnerung.ausgeloest',
    /** Event: Erinnerung wurde bestätigt (acknowledged) */
    ACKNOWLEDGED: 'erinnerung.acknowledged',
    /** Event: Erinnerung wurde verschoben (snoozed) */
    SNOOZED: 'erinnerung.snoozed',
    /** Event: Erinnerung wurde nach Snooze erneut ausgelöst (Story 2.2) */
    RETRIGGERED: 'erinnerung.retriggered',
    /** Event: Erinnerung wurde eskaliert */
    ESKALIERT: 'erinnerung.eskaliert',
    /** Event: Erinnerung wurde erledigt */
    ERLEDIGT: 'erinnerung.erledigt',
    /** Event: Erinnerung wurde gelöscht (Soft-Delete) (Story 1.4) */
    GELOESCHT: 'erinnerung.geloescht',
    /** Event: Erinnerung wurde einem User zugewiesen (Story 3.1 Vorbereitung für 3.3) */
    ASSIGNED: 'erinnerung.assigned',
    /** Event: Erinnerung wurde intensiviert (Dauerton nach Timeout ohne Eskalationsperson) (Story 4.4) */
    INTENSIVIERT: 'erinnerung.intensiviert',
    /** Event: Neue wiederkehrende Instanz wurde erstellt (Story 6.4) */
    WIEDERKEHRENDE_INSTANZ_ERSTELLT: 'erinnerung.wiederkehrende-instanz-erstellt',
    /** Event: Wiederkehrende Serie wurde gestoppt (Story 6.5) */
    SERIE_GESTOPPT: 'erinnerung.serie-gestoppt',
  },

  /**
   * Erinnerungsvorlage Bounded Context Events (Story 6.1)
   */
  ERINNERUNGSVORLAGE: {
    /** Event: Neue Erinnerungsvorlage wurde erstellt */
    ERSTELLT: 'erinnerungsvorlage.erstellt',
    /** Event: Erinnerungsvorlage wurde aktualisiert (Story 6.2) */
    AKTUALISIERT: 'erinnerungsvorlage.aktualisiert',
    /** Event: Erinnerungsvorlage wurde gelöscht (Story 6.2) */
    GELOESCHT: 'erinnerungsvorlage.geloescht',
  },

  /**
   * Notiz Bounded Context Events (Story 7.1)
   */
  NOTIZ: {
    /** Event: Neue Notiz wurde erstellt */
    ERSTELLT: 'notiz.erstellt',
    /** Event: Notiz wurde aktualisiert (Story 7.3) */
    AKTUALISIERT: 'notiz.aktualisiert',
    /** Event: Notiz wurde gelöscht (Soft-Delete) (Story 7.4) */
    GELOESCHT: 'notiz.geloescht',
  },

  /**
   * Fuehrungsrhythmus-Template Bounded Context Events (Story 6.6)
   */
  FUEHRUNGSRHYTHMUS_TEMPLATE: {
    /** Event: Neues Fuehrungsrhythmus-Template wurde erstellt */
    ERSTELLT: 'fuehrungsrhythmus-template.erstellt',
    /** Event: Fuehrungsrhythmus-Template wurde gelöscht */
    GELOESCHT: 'fuehrungsrhythmus-template.geloescht',
    /** Event: Fuehrungsrhythmus-Template wurde fuer einen Einsatz aktiviert (Story 6.7) */
    AKTIVIERT: 'fuehrungsrhythmus-template.aktiviert',
    /** Event: Fuehrungsrhythmus-Template wurde aktualisiert (Story 6.8) */
    AKTUALISIERT: 'fuehrungsrhythmus-template.aktualisiert',
  },

  /**
   * Kategorie Bounded Context Events (Story 8.1)
   */
  KATEGORIE: {
    /** Event: Neue Kategorie wurde erstellt */
    ERSTELLT: 'kategorie.erstellt',
    /** Event: Kategorie wurde gelöscht (Soft-Delete) */
    GELOESCHT: 'kategorie.geloescht',
  },

  /**
   * Einsatz-Rolle Bounded Context Events (Story 5.4)
   */
  EINSATZ_ROLLE: {
    /** Event: Einsatz-Rolle wurde geaendert (Zuweisung, Aenderung, Entfernung) */
    GEAENDERT: 'rolle.geaendert',
  },

  /**
   * Befehl Bounded Context Events (Epic 1)
   */
  BEFEHL: {
    /** Event: Neuer Befehl wurde erstellt */
    ERSTELLT: 'befehl.erstellt',
    /** Event: Befehl wurde an Empfänger zugestellt */
    ZUGESTELLT: 'befehl.zugestellt',
    /** Event: Befehl-Status hat sich geändert */
    STATUS_GEAENDERT: 'befehl.status_geaendert',
    /** Event: Kommentar wurde zu Befehl hinzugefügt */
    KOMMENTAR_HINZUGEFUEGT: 'befehl.kommentar_hinzugefuegt',
    /** Event: Empfänger hat Befehl quittiert (Story 2.1) */
    QUITTIERT: 'befehl.quittiert',
    /** Event: Befehl wurde DSGVO-konform anonymisiert (Story 5.5) */
    ANONYMISIERT: 'befehl.anonymisiert',
    /** Event: Befehl wurde nach Freigabeperiode soft-deleted (Story 5.5) */
    GELOESCHT: 'befehl.geloescht',
  },

  /**
   * Aufbewahrung Bounded Context Events (Story 5.5)
   */
  AUFBEWAHRUNG: {
    /** Event: Aufbewahrungskonfiguration wurde geändert */
    KONFIGURATION_GEAENDERT: 'aufbewahrung.konfiguration_geaendert',
  },

  /**
   * System Monitoring Events (Story 5.6)
   */
  SYSTEM: {
    /** Event: System-Warnung wurde ausgeloest (Schwellwert ueberschritten) */
    WARNUNG: 'system.warnung',
  },

  /**
   * Operative Rolle Bounded Context Events (Issue #98)
   */
  OPERATIVE_ROLLE: {
    /** Event: Operative Rolle eines Users wurde geändert */
    CHANGED: 'operative_rolle.changed',
    /** Event: Stammperson wurde einem User zugewiesen */
    STAMMPERSON_ASSIGNED: 'operative_rolle.stammperson_assigned',
  },

  /**
   * Einsatz-Beitrittsanfrage Bounded Context Events (Issue #98)
   */
  BEITRITTSANFRAGE: {
    /** Event: Neue Beitrittsanfrage wurde erstellt */
    ERSTELLT: 'beitrittsanfrage.erstellt',
    /** Event: Beitrittsanfrage wurde entschieden (genehmigt/abgelehnt) */
    ENTSCHIEDEN: 'beitrittsanfrage.entschieden',
  },

  /**
   * Gefahrenmatrix Bounded Context Events (Issue #414)
   */
  GEFAHRENMATRIX: {
    /** Event: Gefahrenmatrix wurde aktualisiert (Bewertung geändert) */
    AKTUALISIERT: 'gefahrenmatrix.aktualisiert',
  },

  /**
   * Gefahrenzone Bounded Context Events (Issue #627)
   *
   * Räumliche Verortung von Matrix-Zellen auf der Lagekarte.
   * Warnstufe bleibt in der Matrix (ADR-010) — Zone-Events tragen nur Geometrie.
   */
  GEFAHRENZONE: {
    /** Event: Neue Gefahrenzone wurde auf der Karte gezeichnet und mit Matrix-Zelle verknüpft */
    ERSTELLT: 'gefahrenzone.erstellt',
    /** Event: Geometrie einer bestehenden Zone wurde geändert (Polygon/Kreis-Anpassung) */
    GEOMETRY_GEAENDERT: 'gefahrenzone.geometry-geaendert',
    /** Event: Gefahrenzone wurde gelöscht */
    GELOESCHT: 'gefahrenzone.geloescht',
  },

  /**
   * Alarmierung Bounded Context Events (Issue #408)
   */
  ALARMIERUNG: {
    /** Event: Neue Alarmierung wurde ausgelöst */
    ERSTELLT: 'alarmierung.erstellt',
    /** Event: Empfänger wurde zur Alarmierung hinzugefügt */
    EMPFAENGER_HINZUGEFUEGT: 'alarmierung.empfaenger_hinzugefuegt',
    /** Event: Empfänger wurde aus Alarmierung entfernt */
    EMPFAENGER_ENTFERNT: 'alarmierung.empfaenger_entfernt',
    /** Event: Zeitpunkt eines Empfängers wurde manuell korrigiert (auditierbar) */
    ZEITPUNKT_KORRIGIERT: 'alarmierung.zeitpunkt_korrigiert',
    /** Event: Zeitpunkt wurde automatisch aus FMS-Statuswechsel gesetzt */
    ZEITPUNKT_FMS_GESETZT: 'alarmierung.zeitpunkt_fms_gesetzt',
    /** Event: Alarmierung wurde abgeschlossen */
    ABGESCHLOSSEN: 'alarmierung.abgeschlossen',
    /** Event: Nachalarmierung wurde erstellt (referenziert Ursprungsalarmierung) */
    NACHALARMIERUNG_ERSTELLT: 'alarmierung.nachalarmierung_erstellt',
  },

  /**
   * Funkkanal Bounded Context Events (Issue #407)
   */
  FUNKKANAL: {
    /** Event: Neuer Funkkanal wurde erstellt */
    ERSTELLT: 'funkkanal.erstellt',
    /** Event: Funkkanal-Stammdaten wurden geändert (Name, Details, Zweck, Status, sortIndex) */
    GEAENDERT: 'funkkanal.geaendert',
    /** Event: Funkkanal wurde archiviert */
    ARCHIVIERT: 'funkkanal.archiviert',
    /** Event: Reihenfolge mehrerer Funkkanäle eines Einsatzes wurde geändert */
    REIHENFOLGE_GEAENDERT: 'funkkanal.reihenfolge_geaendert',
    /** Event: Kraft wurde einem Funkkanal zugeordnet */
    ZUORDNUNG_ERSTELLT: 'funkkanal.zuordnung_erstellt',
    /** Event: Zuordnung wurde von einem Funkkanal entfernt */
    ZUORDNUNG_ENTFERNT: 'funkkanal.zuordnung_entfernt',
  },

  /**
   * Funk-bezogene, aggregatsübergreifende Events (Issue #407)
   */
  FUNK: {
    /** Event: Funkspruch mit Priorität `notfall` — triggert Notfall-Alert-Broadcast */
    NOTFALL_ALERT_REQUESTED: 'funk.notfall_alert_requested',
  },

  /**
   * Patienten Bounded Context Events (Story 1.2, Architecture §D-6).
   *
   * Story 1.2 produziert ausschließlich `patient.erfasst`. Die übrigen Namen
   * (`gesichtet`, `behandlung-begonnen`, etc.) sind reserviert und werden von
   * Folge-Stories (1.3 ff.) freigeschaltet — pro Event muss die
   * 4-Stellen-Registry (Serializer, Deserializer, AdaptersModule, Event-Logger)
   * vollständig sein, sonst stille Pipeline-Lücken (Architecture §D-6).
   */
  PATIENT: {
    /** Event: Patient erstmalig erfasst (Story 1.2) */
    ERFASST: 'patient.erfasst',
    /** Event: Patient initial gesichtet — Erst-Sichtung (Story 1.1/1.3 Registry-Vervollständigung) */
    GESICHTET: 'patient.gesichtet',
    /** Event: Sichtungs-Reevaluierung (Story 1.3, FR17) */
    SICHTUNG_AKTUALISIERT: 'patient.sichtung-aktualisiert',
  },

  /**
   * Taktische Zeichen Bounded Context Events (Issue #636)
   */
  TAKTISCHES_ZEICHEN: {
    /** Event: Taktisches Zeichen wurde neu erstellt */
    ERSTELLT: 'taktisches_zeichen.erstellt',
    /** Event: Taktisches Zeichen wurde auf der Lagekarte platziert */
    PLATZIERT: 'taktisches_zeichen.platziert',
    /** Event: Taktisches Zeichen wurde verschoben */
    VERSCHOBEN: 'taktisches_zeichen.verschoben',
    /** Event: Metadaten des taktischen Zeichens wurden aktualisiert */
    AKTUALISIERT: 'taktisches_zeichen.aktualisiert',
    /** Event: Taktisches Zeichen wurde von der Lagekarte entfernt */
    ENTFERNT: 'taktisches_zeichen.entfernt',
  },
} as const;

/**
 * Type Helper: Union aller Event Namen.
 *
 * Ermöglicht Type-Safe Event Name Validierung zur Compile-Time.
 *
 * @example
 * ```typescript
 * function emitEvent(eventName: EventName, payload: unknown) {
 *   // eventName muss einer der definierten Event-Namen sein
 *   this.eventEmitter.emit(eventName, payload);
 * }
 * ```
 */
export type EventName =
  | (typeof EVENT_NAMES.EINSATZ)[keyof typeof EVENT_NAMES.EINSATZ]
  | (typeof EVENT_NAMES.EIGENSCHUTZ)[keyof typeof EVENT_NAMES.EIGENSCHUTZ]
  | (typeof EVENT_NAMES.PATIENT)[keyof typeof EVENT_NAMES.PATIENT]
  | (typeof EVENT_NAMES.ETB)[keyof typeof EVENT_NAMES.ETB]
  | (typeof EVENT_NAMES.LAGEKARTE)[keyof typeof EVENT_NAMES.LAGEKARTE]
  | (typeof EVENT_NAMES.USER)[keyof typeof EVENT_NAMES.USER]
  | (typeof EVENT_NAMES.SERVER_ACCESS_TOKEN)[keyof typeof EVENT_NAMES.SERVER_ACCESS_TOKEN]
  | (typeof EVENT_NAMES.INVITE_CODE)[keyof typeof EVENT_NAMES.INVITE_CODE]
  | (typeof EVENT_NAMES.SERVER_CONFIG)[keyof typeof EVENT_NAMES.SERVER_CONFIG]
  | (typeof EVENT_NAMES.ERINNERUNG)[keyof typeof EVENT_NAMES.ERINNERUNG]
  | (typeof EVENT_NAMES.ERINNERUNGSVORLAGE)[keyof typeof EVENT_NAMES.ERINNERUNGSVORLAGE]
  | (typeof EVENT_NAMES.NOTIZ)[keyof typeof EVENT_NAMES.NOTIZ]
  | (typeof EVENT_NAMES.FUEHRUNGSRHYTHMUS_TEMPLATE)[keyof typeof EVENT_NAMES.FUEHRUNGSRHYTHMUS_TEMPLATE]
  | (typeof EVENT_NAMES.KATEGORIE)[keyof typeof EVENT_NAMES.KATEGORIE]
  | (typeof EVENT_NAMES.EINSATZ_ROLLE)[keyof typeof EVENT_NAMES.EINSATZ_ROLLE]
  | (typeof EVENT_NAMES.BEFEHL)[keyof typeof EVENT_NAMES.BEFEHL]
  | (typeof EVENT_NAMES.AUFBEWAHRUNG)[keyof typeof EVENT_NAMES.AUFBEWAHRUNG]
  | (typeof EVENT_NAMES.SYSTEM)[keyof typeof EVENT_NAMES.SYSTEM]
  | (typeof EVENT_NAMES.OPERATIVE_ROLLE)[keyof typeof EVENT_NAMES.OPERATIVE_ROLLE]
  | (typeof EVENT_NAMES.BEITRITTSANFRAGE)[keyof typeof EVENT_NAMES.BEITRITTSANFRAGE]
  | (typeof EVENT_NAMES.GEFAHRENMATRIX)[keyof typeof EVENT_NAMES.GEFAHRENMATRIX]
  | (typeof EVENT_NAMES.GEFAHRENZONE)[keyof typeof EVENT_NAMES.GEFAHRENZONE]
  | (typeof EVENT_NAMES.FUNKKANAL)[keyof typeof EVENT_NAMES.FUNKKANAL]
  | (typeof EVENT_NAMES.FUNK)[keyof typeof EVENT_NAMES.FUNK]
  | (typeof EVENT_NAMES.ALARMIERUNG)[keyof typeof EVENT_NAMES.ALARMIERUNG]
  | (typeof EVENT_NAMES.TAKTISCHES_ZEICHEN)[keyof typeof EVENT_NAMES.TAKTISCHES_ZEICHEN];
