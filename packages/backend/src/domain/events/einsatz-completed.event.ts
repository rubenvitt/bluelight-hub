import { DomainEvent } from '@domain/common/domain-event';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { UserId } from '@domain/value-objects/user-id';

/**
 * Domain Event das auftritt wenn ein Einsatz abgeschlossen wurde.
 * Repräsentiert historische Tatsache (Past Tense: "Completed", nicht "Complete").
 *
 * Event wird ausgelöst nach erfolgreicher Einsatz-Completion um andere
 * Module zu benachrichtigen (z.B. Notifications, Reporting, Statistics).
 *
 * Warum Rich Data?
 * - Enthält Completion-Zeitstempel für Audit Trail und Zeitreihen-Analysen
 * - User-Info ermöglicht Verantwortlichkeits-Tracking (Wer hat abgeschlossen?)
 * - Event Store kann kompletten Einsatz-Lifecycle rekonstruieren
 *
 * @example
 * ```typescript
 * // Event Creation nach Einsatz Completion
 * const einsatzId = EinsatzId.create().value!;
 * const completedBy = UserId.create().value!;
 * const event = new EinsatzCompletedEvent(
 *   einsatzId,
 *   completedBy,
 *   new Date('2024-11-14T12:34:56.789Z'),
 *   'aggregate-einsatz-123'
 * );
 *
 * // Event Properties (readonly, immutabel)
 * console.log(event.eventId);      // Auto-generated cuid
 * console.log(event.occurredAt);   // Auto-generated timestamp
 * console.log(event.einsatzId);    // EinsatzId instance
 * console.log(event.completedBy);  // UserId instance
 * console.log(event.completedAt);  // Date when completed
 * console.log(event.aggregateId);  // "aggregate-einsatz-123"
 *
 * // Event Routing
 * console.log(EinsatzCompletedEvent.eventName()); // "einsatz.completed"
 * console.log(EinsatzCompletedEvent.eventVersion()); // 1
 * ```
 */
export class EinsatzCompletedEvent extends DomainEvent {
  /**
   * Constructor für EinsatzCompletedEvent mit Completion-Daten.
   * Base Class auto-generiert eventId und occurredAt.
   *
   * @param einsatzId - Type-Safe ID des abgeschlossenen Einsatzes
   * @param completedBy - Type-Safe ID des Users der den Einsatz abgeschlossen hat
   * @param completedAt - Zeitstempel wann der Einsatz abgeschlossen wurde
   * @param aggregateId - Optional: ID der Einsatz Aggregate Root (für Event Store)
   */
  constructor(
    public readonly einsatzId: EinsatzId,
    public readonly completedBy: UserId,
    public readonly completedAt: Date,
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Wird von Event Dispatcher/Handler verwendet zur Event-Type Resolution.
   *
   * Format: Lowercase, dot-separated (z.B. 'einsatz.created', 'einsatz.completed')
   *
   * @returns "einsatz.completed" (lowercase, dot-separated!)
   */
  static eventName(): string {
    return 'einsatz.completed';
  }
}
