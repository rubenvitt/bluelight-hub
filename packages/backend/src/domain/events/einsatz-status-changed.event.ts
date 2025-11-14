import { DomainEvent } from '@domain/common/domain-event';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { EinsatzStatus } from '@domain/value-objects/einsatz-status';

/**
 * Domain Event das auftritt wenn der Status eines Einsatzes geändert wurde.
 * Repräsentiert historische Tatsache (Past Tense: "Changed", nicht "Change").
 *
 * Event wird ausgelöst bei jeder Status-Transition um andere
 * Module zu benachrichtigen (z.B. Workflow Engine, Notifications, Analytics).
 *
 * Warum Old/New Status wichtig ist:
 * - Ermöglicht State Machine Validierung in Event Handlers (canTransitionTo())
 * - Event Handler können Transition-spezifische Logik ausführen (z.B. ANGELEGT → IN_BEARBEITUNG sendet Notification)
 * - Audit Trail: Vollständige Historie aller Status-Änderungen rekonstruierbar
 * - Analytics: Status-Übergänge können für Reporting/Metriken verwendet werden (z.B. Durchschnittszeit ANGELEGT → ABGESCHLOSSEN)
 *
 * @example
 * ```typescript
 * // Event Creation nach Status-Transition
 * const einsatzId = EinsatzId.create().value!;
 * const oldStatus = EinsatzStatus.ANGELEGT();
 * const newStatus = EinsatzStatus.IN_BEARBEITUNG();
 * const event = new EinsatzStatusChangedEvent(
 *   einsatzId,
 *   oldStatus,
 *   newStatus,
 *   'aggregate-einsatz-123'
 * );
 *
 * // Event Properties (readonly, immutabel)
 * console.log(event.eventId);      // Auto-generated nanoid
 * console.log(event.occurredAt);   // Auto-generated timestamp
 * console.log(event.einsatzId);    // EinsatzId instance
 * console.log(event.oldStatus);    // EinsatzStatus instance (ANGELEGT)
 * console.log(event.newStatus);    // EinsatzStatus instance (IN_BEARBEITUNG)
 * console.log(event.aggregateId);  // "aggregate-einsatz-123"
 *
 * // Event Routing
 * console.log(EinsatzStatusChangedEvent.eventName()); // "einsatz.status_changed"
 * console.log(EinsatzStatusChangedEvent.eventVersion()); // 1
 * ```
 */
export class EinsatzStatusChangedEvent extends DomainEvent {
  /**
   * Constructor für EinsatzStatusChangedEvent mit Transition-Daten.
   * Base Class auto-generiert eventId und occurredAt.
   *
   * @param einsatzId - Type-Safe ID des Einsatzes dessen Status geändert wurde
   * @param oldStatus - Vorheriger Status des Einsatzes (z.B. ANGELEGT)
   * @param newStatus - Neuer Status des Einsatzes (z.B. IN_BEARBEITUNG)
   * @param aggregateId - Optional: ID der Einsatz Aggregate Root (für Event Store)
   */
  constructor(
    public readonly einsatzId: EinsatzId,
    public readonly oldStatus: EinsatzStatus,
    public readonly newStatus: EinsatzStatus,
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Wird von Event Dispatcher/Handler verwendet zur Event-Type Resolution.
   *
   * Format: Lowercase, dot-separated, snake_case für multi-word (z.B. 'einsatz.status_changed')
   *
   * @returns "einsatz.status_changed" (lowercase, dot-separated, snake_case!)
   */
  static eventName(): string {
    return 'einsatz.status_changed';
  }
}
