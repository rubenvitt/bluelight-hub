import { DomainEvent } from '@domain/common/domain-event';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import type { UserId } from '@domain/value-objects/user-id';
import { EVENT_NAMES } from './event-names';

/**
 * Repräsentiert die geänderten Felder einer Erinnerung.
 * Nur gesetzte Properties wurden tatsächlich geändert.
 */
export interface ErinnerungAenderungen {
  titel?: string;
  beschreibung?: string | null;
  faelligAm?: Date;
  eskalationsPersonId?: UserId | null; // Story 4.1
}

/**
 * Domain Event das auftritt wenn eine existierende Erinnerung aktualisiert wurde.
 * Repräsentiert historische Tatsache (Past Tense).
 *
 * **Event-Carried State Transfer:**
 * Event enthält alle geänderten Daten damit Event Handler KEINE DB-Query brauchen.
 *
 * **Mögliche Event Handler:**
 * - ETB-Integration: Automatischer ETB-Eintrag bei Aktualisierung
 * - WebSocket: Real-time Updates an Einsatz-Room
 * - Audit-Log: Dokumentation welche Felder geändert wurden
 *
 * @example
 * ```typescript
 * const event = new ErinnerungAktualisiertEvent(
 *   erinnerungId,
 *   einsatzId,
 *   { titel: 'Neuer Titel', faelligAm: new Date('2025-01-20T15:00:00Z') },
 *   erinnerungId.toString()
 * );
 * console.log(ErinnerungAktualisiertEvent.eventName()); // "erinnerung.aktualisiert"
 * ```
 */
export class ErinnerungAktualisiertEvent extends DomainEvent {
  /**
   * Constructor für ErinnerungAktualisiertEvent.
   *
   * @param erinnerungId - Type-Safe ID der aktualisierten Erinnerung
   * @param einsatzId - Type-Safe ID des zugehörigen Einsatzes
   * @param aenderungen - Object mit den geänderten Feldern
   * @param aktualisierVon - UserId des Users der die Änderung vorgenommen hat
   * @param titel - Aktueller Titel der Erinnerung (für ETB-Eintrag)
   * @param aggregateId - Optional: ID des Aggregate Root (für Event Store)
   */
  constructor(
    public readonly erinnerungId: ErinnerungId,
    public readonly einsatzId: EinsatzId,
    public readonly aenderungen: ErinnerungAenderungen,
    public readonly aktualisierVon: UserId,
    public readonly titel: string,
    aggregateId?: string,
  ) {
    super(aggregateId);
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Format: Lowercase, dot-separated, deutsch (konsistent mit project-context.md)
   *
   * @returns "erinnerung.aktualisiert"
   */
  static eventName(): string {
    return EVENT_NAMES.ERINNERUNG.AKTUALISIERT;
  }
}
