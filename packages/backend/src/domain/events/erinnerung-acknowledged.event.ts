import { DomainEvent } from '@domain/common/domain-event';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import type { UserId } from '@domain/value-objects/user-id';
import { EVENT_NAMES } from './event-names';

/**
 * Domain Event das auftritt wenn eine Erinnerung bestätigt (acknowledged) wurde.
 * Repräsentiert historische Tatsache (Past Tense).
 *
 * **Event-Carried State Transfer:**
 * Event enthält alle relevanten Daten damit Event Handler KEINE DB-Query brauchen.
 *
 * **Mögliche Event Handler:**
 * - ETB-Integration: Automatischer ETB-Eintrag bei Bestätigung
 * - WebSocket: Real-time Benachrichtigung an Einsatz-Room (erinnerung.acknowledged)
 * - Timer: Timer und Audio-Alarm stoppen
 *
 * @example
 * ```typescript
 * const event = new ErinnerungAcknowledgedEvent(
 *   erinnerungId,
 *   einsatzId,
 *   new Date(),
 *   acknowledgedBy, // UserId der Person die bestätigt
 *   'Lagebesprechung',
 *   erinnerungId.toString()
 * );
 * console.log(ErinnerungAcknowledgedEvent.eventName()); // "erinnerung.acknowledged"
 * ```
 */
export class ErinnerungAcknowledgedEvent extends DomainEvent {
  /**
   * Constructor für ErinnerungAcknowledgedEvent.
   *
   * @param erinnerungId - Type-Safe ID der bestätigten Erinnerung
   * @param einsatzId - Type-Safe ID des zugehörigen Einsatzes
   * @param acknowledgedAm - Zeitpunkt der Bestätigung
   * @param acknowledgedBy - UserId der Person die bestätigt hat
   * @param titel - Titel der Erinnerung (für ETB-Eintrag und Notification)
   * @param aggregateId - Optional: ID des Aggregate Root (für Event Store)
   */
  constructor(
    public readonly erinnerungId: ErinnerungId,
    public readonly einsatzId: EinsatzId,
    public readonly acknowledgedAm: Date,
    public readonly acknowledgedBy: UserId,
    public readonly titel: string,
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Format: Lowercase, dot-separated (konsistent mit project-context.md)
   *
   * @returns "erinnerung.acknowledged"
   */
  static eventName(): string {
    return EVENT_NAMES.ERINNERUNG.ACKNOWLEDGED;
  }
}
