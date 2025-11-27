import { DomainEvent } from '@domain/common/domain-event';
import type { LagekarteId } from '@domain/value-objects/lagekarte-id';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { UserId } from '@domain/value-objects/user-id';

/**
 * Event: Lagekarte wurde erstellt.
 *
 * Wird emittiert, wenn eine neue Lagekarte für einen Einsatz angelegt wird.
 * Handler können dieses Event nutzen, um:
 * - Audit-Logs für Compliance zu schreiben
 * - Notifications an Einsatzkräfte zu versenden
 * - Initiale Konfiguration für die Lagekarte vorzubereiten
 *
 * **Event-Carried State Transfer:**
 * Das Event enthält alle relevanten Daten (lagekarteId, einsatzId, createdBy, hasInitialPoi),
 * damit Handler ohne zusätzliche Datenbank-Queries reagieren können.
 *
 * @example
 * ```typescript
 * // Im LagekarteAggregate.create():
 * this.addDomainEvent(new LagekarteCreatedEvent(
 *   this.id,
 *   einsatzId,
 *   userId,
 *   initialPoi !== undefined
 * ));
 * ```
 */
export class LagekarteCreatedEvent extends DomainEvent {
  /**
   * @param lagekarteId - ID der erstellten Lagekarte
   * @param einsatzId - ID des zugehörigen Einsatzes
   * @param createdBy - User ID des Erstellers
   * @param hasInitialPoi - True wenn Lagekarte mit initialem POI erstellt wurde
   */
  constructor(
    public readonly lagekarteId: LagekarteId,
    public readonly einsatzId: EinsatzId,
    public readonly createdBy: UserId,
    public readonly hasInitialPoi: boolean,
  ) {
    super(lagekarteId.value);
  }

  /**
   * Static Method für type-safe Event Routing.
   * @returns Event Name in past tense
   */
  public static eventName(): string {
    return 'lagekarte.created';
  }
}
