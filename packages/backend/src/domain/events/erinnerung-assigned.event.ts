import { DomainEvent } from '@domain/common/domain-event';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import type { UserId } from '@domain/value-objects/user-id';
import { EVENT_NAMES } from './event-names';

/**
 * Domain Event das auftritt wenn eine Erinnerung einem User zugewiesen wurde.
 * Repräsentiert historische Tatsache (Past Tense).
 *
 * **Event-Carried State Transfer:**
 * Event enthält alle relevanten Daten damit Event Handler KEINE DB-Query brauchen.
 *
 * **Mögliche Event Handler (Story 3.3+):**
 * - WebSocket: Real-time Benachrichtigung an Einsatz-Room (erinnerung.assigned)
 * - Notification: Push-Notification an zugewiesenen User (Story 3.7)
 * - ETB-Integration: Automatischer ETB-Eintrag bei Zuweisung
 *
 * @example
 * ```typescript
 * const event = new ErinnerungAssignedEvent(
 *   erinnerungId,
 *   einsatzId,
 *   assignedToId, // UserId des zugewiesenen Users
 *   assignedById, // UserId der Person die zugewiesen hat
 *   'Lagebesprechung',
 *   erinnerungId.toString()
 * );
 * console.log(ErinnerungAssignedEvent.eventName()); // "erinnerung.assigned"
 * ```
 */
export class ErinnerungAssignedEvent extends DomainEvent {
  /**
   * Constructor für ErinnerungAssignedEvent.
   *
   * @param erinnerungId - Type-Safe ID der zugewiesenen Erinnerung
   * @param einsatzId - Type-Safe ID des zugehörigen Einsatzes
   * @param assignedToId - UserId des Users dem die Erinnerung zugewiesen wurde
   * @param assignedById - UserId der Person die die Zuweisung durchgeführt hat
   * @param titel - Titel der Erinnerung (für ETB-Eintrag und Notification)
   * @param assignedAt - Zeitpunkt der Zuweisung
   * @param aggregateId - Optional: ID des Aggregate Root (für Event Store)
   */
  constructor(
    public readonly erinnerungId: ErinnerungId,
    public readonly einsatzId: EinsatzId,
    public readonly assignedToId: UserId,
    public readonly assignedById: UserId,
    public readonly titel: string,
    public readonly assignedAt: Date,
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Format: Lowercase, dot-separated (konsistent mit project-context.md)
   *
   * @returns "erinnerung.assigned"
   */
  static eventName(): string {
    return EVENT_NAMES.ERINNERUNG.ASSIGNED;
  }
}
