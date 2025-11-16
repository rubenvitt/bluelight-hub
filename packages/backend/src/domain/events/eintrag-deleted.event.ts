import { DomainEvent } from '@domain/common/domain-event';
import type { EintragId } from '@domain/value-objects/eintrag-id';
import type { EtbId } from '@domain/value-objects/etb-id';
import type { UserId } from '@domain/value-objects/user-id';

/**
 * Event: Ein Eintrag wurde gelöscht (Soft-Delete).
 *
 * Dieses Event wird emittiert wenn ein Eintrag als gelöscht markiert wurde.
 * WICHTIG: Soft-Delete bedeutet der Eintrag bleibt in der Datenbank (isDeleted=true),
 * wird aber aus der aktiven UI ausgefiltert. Dies garantiert DRK-konforme
 * Revisionssicherheit und lückenlose Audit-Trails.
 *
 * **Warum Soft-Delete?**
 * - Compliance: DRK verlangt unveränderliche Historie
 * - Audit-Trail: Gelöschte Einträge müssen nachvollziehbar bleiben
 * - Forensik: Wer hat wann was gelöscht? Vollständige Nachvollziehbarkeit
 * - Recovery: Möglichkeit zur Wiederherstellung bei versehentlichem Löschen
 *
 * **Use Cases:**
 * - Read Model Update: Filtere gelöschte Einträge aus UI-Ansicht
 * - Notification Service: "User X hat Eintrag Y gelöscht"
 * - Audit-Log: Persistiere Löschung mit deletedBy und Zeitstempel
 * - Compliance Report: Zeige Historie inkl. gelöschter Einträge
 *
 * @example
 * ```typescript
 * // Im EinsatztagebuchAggregate nach deleteEintrag():
 * eintrag.markAsDeleted();
 * this.addDomainEvent(new EintragDeletedEvent(
 *   this.id,
 *   eintragId,
 *   userId
 * ));
 * ```
 */
export class EintragDeletedEvent extends DomainEvent {
  /**
   * Event Name für Event Router (Past Tense).
   */
  public readonly eventName = 'etb.eintrag_deleted';

  /**
   * @param etbId - ID des parent ETB Aggregates
   * @param eintragId - ID des gelöschten Eintrags
   * @param deletedBy - User ID des Löschenden
   */
  constructor(
    public readonly etbId: EtbId,
    public readonly eintragId: EintragId,
    public readonly deletedBy: UserId,
  ) {
    super();
  }
}
