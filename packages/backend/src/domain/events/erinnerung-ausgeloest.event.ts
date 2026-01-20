import { DomainEvent } from '@domain/common/domain-event';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import type { UserId } from '@domain/value-objects/user-id';
import { EVENT_NAMES } from './event-names';

/**
 * Domain Event das auftritt wenn eine Erinnerung bei Fälligkeit ausgelöst wurde.
 * Repräsentiert historische Tatsache (Past Tense).
 *
 * **Event-Carried State Transfer:**
 * Event enthält alle relevanten Daten damit Event Handler KEINE DB-Query brauchen.
 *
 * **Mögliche Event Handler:**
 * - ETB-Integration: Automatischer ETB-Eintrag bei Auslösung
 * - WebSocket: Real-time Benachrichtigung an Einsatz-Room (erinnerung.triggered)
 * - Notification: OS-Notification und Audio-Alarm
 *
 * @example
 * ```typescript
 * const event = new ErinnerungAusgeloestEvent(
 *   erinnerungId,
 *   einsatzId,
 *   new Date(),
 *   'Lagebesprechung',
 *   erstelltVon, // UserId des Erstellers
 *   erinnerungId.toString()
 * );
 * console.log(ErinnerungAusgeloestEvent.eventName()); // "erinnerung.ausgeloest"
 * ```
 */
export class ErinnerungAusgeloestEvent extends DomainEvent {
  /**
   * Constructor für ErinnerungAusgeloestEvent.
   *
   * @param erinnerungId - Type-Safe ID der ausgelösten Erinnerung
   * @param einsatzId - Type-Safe ID des zugehörigen Einsatzes
   * @param ausgeloestAm - Zeitpunkt der Auslösung
   * @param titel - Titel der Erinnerung (für ETB-Eintrag und Notification)
   * @param erstelltVon - UserId des Erstellers (für ETB-Eintrag)
   * @param aggregateId - Optional: ID des Aggregate Root (für Event Store)
   */
  constructor(
    public readonly erinnerungId: ErinnerungId,
    public readonly einsatzId: EinsatzId,
    public readonly ausgeloestAm: Date,
    public readonly titel: string,
    public readonly erstelltVon: UserId,
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Format: Lowercase, dot-separated, deutsch (konsistent mit project-context.md)
   *
   * @returns "erinnerung.ausgeloest"
   */
  static eventName(): string {
    return EVENT_NAMES.ERINNERUNG.AUSGELOEST;
  }
}
