import { DomainEvent } from '@domain/common/domain-event';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import type { UserId } from '@domain/value-objects/user-id';
import { EVENT_NAMES } from './event-names';

/**
 * Domain Event das auftritt wenn eine Erinnerung als erledigt markiert wurde.
 * Repräsentiert historische Tatsache (Past Tense).
 *
 * **Event-Carried State Transfer:**
 * Event enthält alle relevanten Daten damit Event Handler KEINE DB-Query brauchen.
 *
 * **Mögliche Event Handler:**
 * - ETB-Integration: Automatischer ETB-Eintrag bei Erledigung mit optionaler Notiz
 * - WebSocket: Real-time Benachrichtigung an Einsatz-Room (erinnerung.erledigt)
 * - Timer: Alle Timer und Alarme für diese Erinnerung stoppen
 *
 * @example
 * ```typescript
 * const event = new ErinnerungErledigtEvent(
 *   erinnerungId,
 *   einsatzId,
 *   new Date(),
 *   erledigtBy, // UserId der Person die erledigt hat
 *   'Lagebesprechung',
 *   'Aufgabe erfolgreich abgeschlossen',
 *   erinnerungId.toString()
 * );
 * console.log(ErinnerungErledigtEvent.eventName()); // "erinnerung.erledigt"
 * ```
 */
export class ErinnerungErledigtEvent extends DomainEvent {
  /**
   * Constructor für ErinnerungErledigtEvent.
   *
   * @param erinnerungId - Type-Safe ID der erledigten Erinnerung
   * @param einsatzId - Type-Safe ID des zugehörigen Einsatzes
   * @param erledigtAm - Zeitpunkt der Erledigung
   * @param erledigtBy - UserId der Person die erledigt hat
   * @param titel - Titel der Erinnerung (für ETB-Eintrag und Notification)
   * @param erledigungsNotiz - Optionale Notiz zur Erledigung (max 500 Zeichen)
   * @param aggregateId - Optional: ID des Aggregate Root (für Event Store)
   */
  constructor(
    public readonly erinnerungId: ErinnerungId,
    public readonly einsatzId: EinsatzId,
    public readonly erledigtAm: Date,
    public readonly erledigtBy: UserId,
    public readonly titel: string,
    public readonly erledigungsNotiz: string | null,
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Format: Lowercase, dot-separated (konsistent mit project-context.md)
   *
   * @returns "erinnerung.erledigt"
   */
  static eventName(): string {
    return EVENT_NAMES.ERINNERUNG.ERLEDIGT;
  }
}
