import { DomainEvent } from '@domain/common/domain-event';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import type { UserId } from '@domain/value-objects/user-id';
import { EVENT_NAMES } from './event-names';

/**
 * Domain Event das auftritt wenn eine gesnoozede Erinnerung erneut ausgelöst wurde (Story 2.2).
 * Repräsentiert historische Tatsache (Past Tense).
 *
 * **Event-Carried State Transfer:**
 * Event enthält alle relevanten Daten damit Event Handler KEINE DB-Query brauchen.
 * Enthält zusätzlich Snooze-Historie für Audit-Trail und UI-Anzeige.
 *
 * **Mögliche Event Handler:**
 * - ETB-Integration: Automatischer ETB-Eintrag mit Snooze-Counter ("X. Auslösung")
 * - WebSocket: Real-time Benachrichtigung mit isRetrigger Flag
 * - Notification: OS-Notification und Audio-Alarm
 *
 * @example
 * ```typescript
 * const event = new ErinnerungRetriggeredEvent(
 *   erinnerungId,
 *   einsatzId,
 *   new Date(),
 *   'Lagebesprechung',
 *   erstelltVon,
 *   2,                    // snoozeCount - bereits 2x gesnoozed
 *   previousSnoozedAt,    // Wann zuletzt gesnoozed
 *   erinnerungId.toString()
 * );
 * console.log(ErinnerungRetriggeredEvent.eventName()); // "erinnerung.retriggered"
 * ```
 */
export class ErinnerungRetriggeredEvent extends DomainEvent {
  /**
   * Constructor für ErinnerungRetriggeredEvent.
   *
   * @param erinnerungId - Type-Safe ID der erneut ausgelösten Erinnerung
   * @param einsatzId - Type-Safe ID des zugehörigen Einsatzes
   * @param retriggeredAm - Zeitpunkt der erneuten Auslösung
   * @param titel - Titel der Erinnerung (für ETB-Eintrag und Notification)
   * @param erstelltVon - UserId des Erstellers (für ETB-Eintrag)
   * @param snoozeCount - Anzahl der bisherigen Snoozes (für UI-Badge "X. Auslösung")
   * @param previousSnoozedAt - Zeitpunkt des letzten Snooze (für Audit-Trail)
   * @param aggregateId - Optional: ID des Aggregate Root (für Event Store)
   */
  constructor(
    public readonly erinnerungId: ErinnerungId,
    public readonly einsatzId: EinsatzId,
    public readonly retriggeredAm: Date,
    public readonly titel: string,
    public readonly erstelltVon: UserId,
    public readonly snoozeCount: number,
    public readonly previousSnoozedAt: Date | null,
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Format: Lowercase, dot-separated, deutsch (konsistent mit project-context.md)
   *
   * @returns "erinnerung.retriggered"
   */
  static eventName(): string {
    return EVENT_NAMES.ERINNERUNG.RETRIGGERED;
  }
}
