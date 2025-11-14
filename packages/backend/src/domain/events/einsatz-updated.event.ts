import { DomainEvent } from '@domain/common/domain-event';

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
 * // Event Creation nach Einsatz Update (nur name geändert)
 * const event = new EinsatzUpdatedEvent(
 *   'A1B2C3D4E5F6G7H8I9J0K',
 *   { name: 'Großbrand' }, // Nur name geändert
 *   'aggregate-einsatz-123'
 * );
 *
 * // Event Properties (readonly, immutabel)
 * console.log(event.eventId);        // Auto-generated nanoid
 * console.log(event.occurredAt);     // Auto-generated timestamp
 * console.log(event.einsatzId);      // "A1B2C3D4E5F6G7H8I9J0K"
 * console.log(event.updates.name);   // "Großbrand" (changed)
 * console.log(event.updates.location); // undefined (not changed)
 * console.log(event.aggregateId);    // "aggregate-einsatz-123"
 *
 * // Event Routing
 * console.log(EinsatzUpdatedEvent.eventName()); // "EinsatzUpdated"
 * console.log(EinsatzUpdatedEvent.eventVersion()); // 1
 * ```
 */
export class EinsatzUpdatedEvent extends DomainEvent {
  /**
   * Constructor für EinsatzUpdatedEvent mit Partial Updates.
   * Base Class auto-generiert eventId und occurredAt.
   *
   * @param einsatzId - Eindeutige ID des aktualisierten Einsatzes (nanoid)
   * @param updates - Partial Object mit geänderten Feldern (z.B. { name: 'Neuer Name' })
   * @param aggregateId - Optional: ID der Einsatz Aggregate Root (für Event Store)
   */
  constructor(
    public readonly einsatzId: string,
    public readonly updates: {
      name?: string;
      location?: string;
      status?: string;
    },
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Wird von Event Dispatcher/Handler verwendet zur Event-Type Resolution.
   *
   * @returns "EinsatzUpdated" (Past Tense!)
   */
  static eventName(): string {
    return 'EinsatzUpdated';
  }
}
