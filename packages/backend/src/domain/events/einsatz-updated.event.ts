import { DomainEvent } from '@domain/common/domain-event';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EVENT_NAMES } from './event-names';

/**
 * Domain Event das auftritt wenn ein existierender Einsatz aktualisiert wurde.
 * Repräsentiert historische Tatsache (Past Tense: "Updated", nicht "Update").
 *
 * Event wird ausgelöst nach erfolgreicher Einsatz Update um andere
 * Module zu benachrichtigen (z.B. Real-time Updates, Audit Log, Analytics).
 *
 * Warum Partial Updates?
 * - Nur geänderte Felder werden im Event mitgegeben (effizient)
 * - Event Handler können selektiv auf spezifische Changes reagieren
 * - Audit Log kann exakte Änderungen tracken (Delta, nicht Full State)
 *
 * @example
 * ```typescript
 * // Event Creation nach Einsatz Update (nur alarmstichwort geändert)
 * const event = new EinsatzUpdatedEvent(
 *   einsatzId,
 *   { alarmstichwort: 'Großbrand' },
 *   'aggregate-einsatz-123'
 * );
 * ```
 */
export class EinsatzUpdatedEvent extends DomainEvent {
  /**
   * Constructor für EinsatzUpdatedEvent mit Partial Updates.
   * Base Class auto-generiert eventId und occurredAt.
   *
   * @param einsatzId - Type-Safe ID des aktualisierten Einsatzes
   * @param updates - Partial Object mit geänderten Feldern
   * @param aggregateId - Optional: ID der Einsatz Aggregate Root (für Event Store)
   */
  constructor(
    public readonly einsatzId: EinsatzId,
    public readonly updates: {
      alarmstichwort?: string;
      einsatzort?: string; // Serialized Address string
      bemerkung?: string;
    },
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Format: Lowercase, dot-separated (konsistent mit einsatz.created)
   *
   * @returns "einsatz.updated"
   */
  static eventName(): string {
    return EVENT_NAMES.EINSATZ.UPDATED;
  }
}
