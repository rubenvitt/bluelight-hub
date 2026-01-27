import { DomainEvent } from '@domain/common/domain-event';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { UserId } from '@domain/value-objects/user-id';
import { EVENT_NAMES } from './event-names';

/**
 * Event das emittiert wird, wenn eine Erinnerung "eskaliert" werden soll,
 * aber KEINE Eskalationsperson definiert ist.
 *
 * **Auslöser:**
 * - Erinnerung war im Status triggerable (AUSGELOEST, SNOOZED)
 * - Eskalations-Timeout überschritten
 * - CronJob ruft `eskalieren()` auf
 * - `eskalationsPersonId` ist NULL
 *
 * **Folge:**
 * - Status bleibt AUSGELOEST
 * - Event dient als Trigger für intensiveres UI/Audio-Feedback (z.B. Dauerton)
 */
export class ErinnerungIntensiviertEvent extends DomainEvent {
  constructor(
    public readonly erinnerungId: { toString(): string },
    public readonly einsatzId: EinsatzId,
    public readonly intensiviertAm: Date,
    public readonly titel: string,
    public readonly erstelltVon: UserId,
    aggregateId: string,
  ) {
    super(aggregateId);
  }

  static eventName(): string {
    return EVENT_NAMES.ERINNERUNG.INTENSIVIERT;
  }

  static eventVersion(): number {
    return 1;
  }
}
