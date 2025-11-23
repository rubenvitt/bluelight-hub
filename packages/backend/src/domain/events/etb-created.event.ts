import { DomainEvent } from '@domain/common/domain-event';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { EtbId } from '@domain/value-objects/etb-id';

/**
 * Event: Einsatztagebuch wurde erstellt.
 *
 * Wird emittiert, wenn ein neues ETB für einen Einsatz angelegt wird.
 * Handler können dieses Event nutzen, um:
 * - Audit-Logs für DRK-Compliance zu schreiben
 * - Notifications an Einsatzkräfte zu versenden
 * - Initial-Konfiguration für das ETB vorzubereiten
 *
 * **Event-Carried State Transfer:**
 * Das Event enthält alle relevanten Daten (etbId, einsatzId),
 * damit Handler ohne zusätzliche Datenbank-Queries reagieren können.
 *
 * @example
 * ```typescript
 * // Im CreateEtbHandler nach erfolgreichem Save:
 * this.eventPublisher.publish(new EtbCreatedEvent(
 *   aggregate.id,
 *   aggregate.einsatzId
 * ));
 * ```
 */
export class EtbCreatedEvent extends DomainEvent {
  /**
   * Event Name für Event Router (Past Tense, lowercase dot-separated).
   */
  public readonly eventName = 'etb.created';

  /**
   * @param etbId - ID des erstellten ETBs
   * @param einsatzId - ID des zugehörigen Einsatzes
   */
  constructor(
    public readonly etbId: EtbId,
    public readonly einsatzId: EinsatzId,
  ) {
    super(etbId.value);
  }

  /**
   * Static Method für type-safe Event Routing.
   * @returns Event Name in past tense
   */
  public static eventName(): string {
    return 'etb.created';
  }
}
