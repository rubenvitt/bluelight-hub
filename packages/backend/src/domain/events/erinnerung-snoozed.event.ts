import { DomainEvent } from '@domain/common/domain-event';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import type { UserId } from '@domain/value-objects/user-id';
import { EVENT_NAMES } from './event-names';

/**
 * Domain Event das auftritt wenn eine Erinnerung verschoben (snoozed) wurde.
 * Repräsentiert historische Tatsache (Past Tense).
 *
 * **Event-Carried State Transfer:**
 * Event enthält alle relevanten Daten damit Event Handler KEINE DB-Query brauchen.
 *
 * **Mögliche Event Handler:**
 * - ETB-Integration: Automatischer ETB-Eintrag bei Snooze
 * - WebSocket: Real-time Benachrichtigung an Einsatz-Room (erinnerung.snoozed)
 * - Timer: Timer zurücksetzen mit neuer snoozedUntil Zeit
 *
 * @example
 * ```typescript
 * const event = new ErinnerungSnoozedEvent(
 *   erinnerungId,
 *   einsatzId,
 *   new Date(),
 *   new Date(Date.now() + 5 * 60 * 1000), // +5 Min
 *   snoozedBy, // UserId der Person die snoozed
 *   snoozeMinutes,
 *   snoozeCount,
 *   'Lagebesprechung',
 *   erinnerungId.toString()
 * );
 * console.log(ErinnerungSnoozedEvent.eventName()); // "erinnerung.snoozed"
 * ```
 */
export class ErinnerungSnoozedEvent extends DomainEvent {
  /**
   * Constructor für ErinnerungSnoozedEvent.
   *
   * @param erinnerungId - Type-Safe ID der gesnoozten Erinnerung
   * @param einsatzId - Type-Safe ID des zugehörigen Einsatzes
   * @param snoozedAt - Zeitpunkt der Snooze-Aktion
   * @param snoozedUntil - Neue Fälligkeit (wann die Erinnerung erneut ausgelöst wird)
   * @param snoozedBy - UserId der Person die snoozed hat
   * @param snoozeMinutes - Snooze-Dauer in Minuten (1, 5, oder 10)
   * @param snoozeCount - Wie oft diese Erinnerung bereits gesnoozed wurde
   * @param titel - Titel der Erinnerung (für ETB-Eintrag und Notification)
   * @param aggregateId - Optional: ID des Aggregate Root (für Event Store)
   */
  constructor(
    public readonly erinnerungId: ErinnerungId,
    public readonly einsatzId: EinsatzId,
    public readonly snoozedAt: Date,
    public readonly snoozedUntil: Date,
    public readonly snoozedBy: UserId,
    public readonly snoozeMinutes: number,
    public readonly snoozeCount: number,
    public readonly titel: string,
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Format: Lowercase, dot-separated (konsistent mit project-context.md)
   *
   * @returns "erinnerung.snoozed"
   */
  static eventName(): string {
    return EVENT_NAMES.ERINNERUNG.SNOOZED;
  }
}
