import { DomainEvent } from '@domain/common/domain-event';

/**
 * Domain Event das auftritt wenn ein neuer Einsatz erstellt wurde.
 * Repräsentiert historische Tatsache (Past Tense: "Created", nicht "Create").
 *
 * Event wird ausgelöst nach erfolgreicher Einsatz Creation um andere
 * Module zu benachrichtigen (z.B. Notifications, Audit Log, Analytics).
 *
 * Warum Rich Data?
 * - Enthält alle relevanten Einsatz-Daten direkt im Event
 * - Vermeidet DB-Queries in Event Handlers (Performance + Decoupling)
 * - Event Store kann Events vollständig rekonstruieren
 *
 * @example
 * ```typescript
 * // Event Creation nach Einsatz Creation
 * const event = new EinsatzCreatedEvent(
 *   'A1B2C3D4E5F6G7H8I9J0K',
 *   'Wohnungsbrand',
 *   'Musterstraße 42, 12345 Berlin',
 *   'aggregate-einsatz-123'
 * );
 *
 * // Event Properties (readonly, immutabel)
 * console.log(event.eventId);        // Auto-generated nanoid
 * console.log(event.occurredAt);     // Auto-generated timestamp
 * console.log(event.einsatzId);      // "A1B2C3D4E5F6G7H8I9J0K"
 * console.log(event.name);           // "Wohnungsbrand"
 * console.log(event.location);       // "Musterstraße 42, 12345 Berlin"
 * console.log(event.aggregateId);    // "aggregate-einsatz-123"
 *
 * // Event Routing
 * console.log(EinsatzCreatedEvent.eventName()); // "EinsatzCreated"
 * console.log(EinsatzCreatedEvent.eventVersion()); // 1
 * ```
 */
export class EinsatzCreatedEvent extends DomainEvent {
  /**
   * Constructor für EinsatzCreatedEvent mit allen relevanten Einsatz-Daten.
   * Base Class auto-generiert eventId und occurredAt.
   *
   * @param einsatzId - Eindeutige ID des erstellten Einsatzes (nanoid)
   * @param name - Name/Typ des Einsatzes (z.B. "Wohnungsbrand", "Verkehrsunfall")
   * @param location - Einsatzort (z.B. "Musterstraße 42, 12345 Berlin")
   * @param aggregateId - Optional: ID der Einsatz Aggregate Root (für Event Store)
   */
  constructor(
    public readonly einsatzId: string,
    public readonly name: string,
    public readonly location: string,
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Wird von Event Dispatcher/Handler verwendet zur Event-Type Resolution.
   *
   * @returns "EinsatzCreated" (Past Tense!)
   */
  static eventName(): string {
    return 'EinsatzCreated';
  }
}
