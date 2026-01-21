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
  | (typeof EVENT_NAMES.ETB)[keyof typeof EVENT_NAMES.ETB]
  | (typeof EVENT_NAMES.LAGEKARTE)[keyof typeof EVENT_NAMES.LAGEKARTE]
  | (typeof EVENT_NAMES.USER)[keyof typeof EVENT_NAMES.USER]
  | (typeof EVENT_NAMES.SERVER_ACCESS_TOKEN)[keyof typeof EVENT_NAMES.SERVER_ACCESS_TOKEN]
  | (typeof EVENT_NAMES.INVITE_CODE)[keyof typeof EVENT_NAMES.INVITE_CODE]
  | (typeof EVENT_NAMES.SERVER_CONFIG)[keyof typeof EVENT_NAMES.SERVER_CONFIG]
  | (typeof EVENT_NAMES.ERINNERUNG)[keyof typeof EVENT_NAMES.ERINNERUNG];
