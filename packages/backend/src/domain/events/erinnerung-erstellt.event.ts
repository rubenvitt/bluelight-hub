import { DomainEvent } from '@domain/common/domain-event';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import type { UserId } from '@domain/value-objects/user-id';
import { EVENT_NAMES } from './event-names';

/**
 * Domain Event das auftritt wenn eine neue Erinnerung erstellt wurde.
 * Repräsentiert historische Tatsache (Past Tense).
 *
 * **Event-Carried State Transfer:**
 * Event enthält alle relevanten Daten damit Event Handler KEINE DB-Query brauchen.
 *
 * **Mögliche Event Handler:**
 * - ETB-Integration: Automatischer ETB-Eintrag bei Erstellung
 * - WebSocket: Real-time Benachrichtigung an Einsatz-Room
 * - Audit-Log: Dokumentation wer wann welche Erinnerung erstellt hat
 *
 * @example
 * ```typescript
 * const event = new ErinnerungErstelltEvent(
 *   erinnerungId,
 *   einsatzId,
 *   'Lagebesprechung',
 *   new Date(Date.now() + 30 * 60 * 1000),
 *   userId,
 *   null, // keine Zuweisung bei Erstellung
 *   erinnerungId.toString()
 * );
 * console.log(ErinnerungErstelltEvent.eventName()); // "erinnerung.erstellt"
 * ```
 */
export class ErinnerungErstelltEvent extends DomainEvent {
  /**
   * Constructor für ErinnerungErstelltEvent.
   *
   * @param erinnerungId - Type-Safe ID der erstellten Erinnerung
   * @param einsatzId - Type-Safe ID des zugehörigen Einsatzes
   * @param titel - Titel der Erinnerung
   * @param faelligAm - Fälligkeitszeitpunkt
   * @param erstelltVon - User der die Erinnerung erstellt hat
   * @param assignedToId - Story 3.3: Optional zugewiesener User (null bei Erstellung ohne Zuweisung)
   * @param aggregateId - Optional: ID des Aggregate Root (für Event Store)
   */
  constructor(
    public readonly erinnerungId: ErinnerungId,
    public readonly einsatzId: EinsatzId,
    public readonly titel: string,
    public readonly faelligAm: Date,
    public readonly erstelltVon: UserId,
    public readonly assignedToId: UserId | null = null,
    public readonly eskalationsPersonId: UserId | null = null, // Story 4.1
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Format: Lowercase, dot-separated, deutsch (konsistent mit project-context.md)
   *
   * @returns "erinnerung.erstellt"
   */
  static eventName(): string {
    return EVENT_NAMES.ERINNERUNG.ERSTELLT;
  }
}
