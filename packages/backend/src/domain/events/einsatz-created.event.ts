import { DomainEvent } from '@domain/common/domain-event';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { UserId } from '@domain/value-objects/user-id';
import { EVENT_NAMES } from './event-names';

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
 * - Event Handler können direkt mit nummer arbeiten (z.B. Benachrichtigungen)
 *
 * @example
 * ```typescript
 * // Event Creation nach Einsatz Creation
 * const einsatzId = EinsatzId.create().value!;
 * const createdBy = UserId.create().value!;
 * const event = new EinsatzCreatedEvent(
 *   einsatzId,
 *   createdBy,
 *   'Wohnungsbrand',
 *   'E2024-abc12345',
 *   'aggregate-einsatz-123'
 * );
 *
 * // Event Properties (readonly, immutabel)
 * console.log(event.eventId);        // Auto-generated cuid
 * console.log(event.occurredAt);     // Auto-generated timestamp
 * console.log(event.einsatzId);      // EinsatzId instance
 * console.log(event.createdBy);      // UserId instance
 * console.log(event.alarmstichwort); // "Wohnungsbrand"
 * console.log(event.nummer);         // "E2024-abc12345"
 * console.log(event.aggregateId);    // "aggregate-einsatz-123"
 *
 * // Event Routing
 * console.log(EinsatzCreatedEvent.eventName()); // "einsatz.created"
 * console.log(EinsatzCreatedEvent.eventVersion()); // 1
 * ```
 */
export class EinsatzCreatedEvent extends DomainEvent {
  /**
   * Constructor für EinsatzCreatedEvent mit allen relevanten Einsatz-Daten.
   * Base Class auto-generiert eventId und occurredAt.
   *
   * @param einsatzId - Type-Safe ID des erstellten Einsatzes
   * @param createdBy - Type-Safe ID des Users der den Einsatz erstellt hat
   * @param alarmstichwort - Alarmstichwort des Einsatzes (z.B. "Wohnungsbrand", "Verkehrsunfall")
   * @param nummer - Human-readable Einsatznummer (Format: E{YEAR}-{CUID-8}, z.B. "E2024-abc12345")
   * @param aggregateId - Optional: ID der Einsatz Aggregate Root (für Event Store)
   */
  constructor(
    public readonly einsatzId: EinsatzId,
    public readonly createdBy: UserId,
    public readonly alarmstichwort: string,
    public readonly nummer: string,
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Wird von Event Dispatcher/Handler verwendet zur Event-Type Resolution.
   *
   * Format: Lowercase, dot-separated (z.B. 'einsatz.created', 'einsatz.updated')
   *
   * @returns "einsatz.created" (lowercase, dot-separated!)
   */
  static eventName(): string {
    return EVENT_NAMES.EINSATZ.CREATED;
  }
}
