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
  | (typeof EVENT_NAMES.USER)[keyof typeof EVENT_NAMES.USER];
