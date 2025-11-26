import { DomainEvent } from '@domain/common/domain-event';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { UserId } from '@domain/value-objects/user-id';

/**
 * Domain Event das auftritt wenn ein Einsatz archiviert wurde.
 * Repräsentiert historische Tatsache (Past Tense: "Archived", nicht "Archive").
 *
 * Event wird ausgelöst nach erfolgreicher Einsatz-Archivierung um andere
 * Module zu benachrichtigen (z.B. Data Retention, Compliance, Backup Systems).
 *
 * Warum dieses Event wichtig ist:
 * - Archivierung ist finale Transition im Einsatz-Lifecycle (irreversibel)
 * - Triggert Compliance-relevante Prozesse (z.B. DSGVO-konforme Langzeit-Speicherung)
 * - Event Handler können automatische Archiv-Backups oder Data Export durchführen
 *
 * @example
 * ```typescript
 * // Event Creation nach Einsatz Archivierung
 * const einsatzId = EinsatzId.create().value!;
 * const archivedBy = UserId.create().value!;
 * const event = new EinsatzArchivedEvent(
 *   einsatzId,
 *   archivedBy,
 *   'aggregate-einsatz-123'
 * );
 *
 * // Event Properties (readonly, immutabel)
 * console.log(event.eventId);      // Auto-generated cuid
 * console.log(event.occurredAt);   // Auto-generated timestamp
 * console.log(event.einsatzId);    // EinsatzId instance
 * console.log(event.archivedBy);   // UserId instance
 * console.log(event.aggregateId);  // "aggregate-einsatz-123"
 *
 * // Event Routing
 * console.log(EinsatzArchivedEvent.eventName()); // "einsatz.archived"
 * console.log(EinsatzArchivedEvent.eventVersion()); // 1
 * ```
 */
export class EinsatzArchivedEvent extends DomainEvent {
  /**
   * Constructor für EinsatzArchivedEvent mit Archivierungs-Daten.
   * Base Class auto-generiert eventId und occurredAt.
   *
   * @param einsatzId - Type-Safe ID des archivierten Einsatzes
   * @param archivedBy - Type-Safe ID des Users der den Einsatz archiviert hat
   * @param aggregateId - Optional: ID der Einsatz Aggregate Root (für Event Store)
   */
  constructor(
    public readonly einsatzId: EinsatzId,
    public readonly archivedBy: UserId,
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Wird von Event Dispatcher/Handler verwendet zur Event-Type Resolution.
   *
   * Format: Lowercase, dot-separated (z.B. 'einsatz.created', 'einsatz.archived')
   *
   * @returns "einsatz.archived" (lowercase, dot-separated!)
   */
  static eventName(): string {
    return 'einsatz.archived';
  }
}
