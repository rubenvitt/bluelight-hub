import { DomainEvent } from '@domain/common/domain-event';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import type { UserId } from '@domain/value-objects/user-id';
import { EVENT_NAMES } from './event-names';

/**
 * Domain Event das auftritt wenn eine Erinnerung gelöscht wurde.
 * Repräsentiert historische Tatsache (Past Tense).
 *
 * **Event-Carried State Transfer:**
 * Event enthält alle relevanten Daten damit Event Handler KEINE DB-Query brauchen.
 *
 * **Mögliche Event Handler:**
 * - ETB-Integration: Automatischer ETB-Eintrag bei Löschung
 * - WebSocket: Real-time Benachrichtigung an Einsatz-Room
 * - Audit-Log: Dokumentation wer wann welche Erinnerung gelöscht hat
 * - Cleanup: Abhängige Ressourcen aufräumen
 *
 * @example
 * ```typescript
 * const event = new ErinnerungGeloeschtEvent(
 *   erinnerungId,
 *   einsatzId,
 *   'Lagebesprechung',
 *   userId,
 *   erinnerungId.toString()
 * );
 * console.log(ErinnerungGeloeschtEvent.eventName()); // "erinnerung.geloescht"
 * ```
 */
export class ErinnerungGeloeschtEvent extends DomainEvent {
  /**
   * Constructor für ErinnerungGeloeschtEvent.
   *
   * @param erinnerungId - Type-Safe ID der gelöschten Erinnerung
   * @param einsatzId - Type-Safe ID des zugehörigen Einsatzes
   * @param titel - Titel der Erinnerung (für Audit Trail und ETB)
   * @param geloeschtVon - User der die Erinnerung gelöscht hat
   * @param aggregateId - Optional: ID des Aggregate Root (für Event Store)
   */
  constructor(
    public readonly erinnerungId: ErinnerungId,
    public readonly einsatzId: EinsatzId,
    public readonly titel: string,
    public readonly geloeschtVon: UserId,
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Format: Lowercase, dot-separated, deutsch (konsistent mit project-context.md)
   *
   * @returns "erinnerung.geloescht"
   */
  static eventName(): string {
    return EVENT_NAMES.ERINNERUNG.GELOESCHT;
  }
}
