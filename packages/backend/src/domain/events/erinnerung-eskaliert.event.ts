import { DomainEvent } from '@domain/common/domain-event';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { UserId } from '@domain/value-objects/user-id';
import { EVENT_NAMES } from './event-names';

/**
 * Event das emittiert wird, wenn eine Erinnerung eskaliert wird.
 *
 * **Auslöser:**
 * - Erinnerung war im Status triggerable (AUSGELOEST, SNOOZED)
 * - Eskalations-Timeout wurde überschritten (konfigurierbar, default 5 min)
 * - CronJob hat die Überfälligkeit erkannt und `eskalieren()` aufgerufen
 */
export class ErinnerungEskaliertEvent extends DomainEvent {
  constructor(
    public readonly erinnerungId: { toString(): string },
    public readonly einsatzId: EinsatzId,
    public readonly eskaliertAm: Date,
    public readonly titel: string,
    public readonly erstelltVon: UserId,
    public readonly eskalationsPersonId: UserId | null,
    aggregateId: string,
  ) {
    super(aggregateId);
  }

  static eventName(): string {
    return EVENT_NAMES.ERINNERUNG.ESKALIERT;
  }

  static eventVersion(): number {
    return 1;
  }
}
