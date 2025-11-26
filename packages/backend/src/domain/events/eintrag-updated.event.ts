import { DomainEvent } from '@domain/common/domain-event';
import type { EintragId } from '@domain/value-objects/eintrag-id';
import type { EtbId } from '@domain/value-objects/etb-id';
import type { UserId } from '@domain/value-objects/user-id';

/**
 * Event: Ein Eintrag wurde aktualisiert.
 *
 * Dieses Event wird emittiert wenn der Text eines bestehenden Eintrags geändert wurde.
 * Es enthält sowohl den alten als auch den neuen Text, damit Event-Handler die
 * Änderung nachvollziehen können ohne vorherige Versionen aus der Datenbank zu laden.
 *
 * **Warum oldText UND newText?**
 * - Audit-Trail: Vollständige Change-Log Generierung ohne DB-Query
 * - Diff-Generierung: UI kann Änderungen hervorheben (Change Tracking)
 * - Rollback-Support: Handler können vorherige Version wiederherstellen
 * - Compliance: DRK-konforme Nachvollziehbarkeit aller Änderungen
 *
 * **Use Cases:**
 * - Notification Service: "User X hat Eintrag geändert von 'A' zu 'B'"
 * - Audit-Log: Persistiere alte + neue Version für Compliance
 * - Version History: Baue Change-Log für UI (wer, wann, was geändert)
 * - Conflict Detection: Prüfe ob parallele Updates aufgetreten sind
 *
 * @example
 * ```typescript
 * // Im EinsatztagebuchAggregate nach updateEintrag():
 * const oldText = eintrag.text;
 * eintrag.update(newText);
 * this.addDomainEvent(new EintragUpdatedEvent(
 *   this.id,
 *   eintragId,
 *   oldText,
 *   newText,
 *   userId
 * ));
 * ```
 */
export class EintragUpdatedEvent extends DomainEvent {
  /**
   * Event Name für Event Router (Past Tense).
   *
   * @returns Event Name in past tense
   */
  public static eventName(): string {
    return 'etb.eintrag_updated';
  }

  /**
   * @param etbId - ID des parent ETB Aggregates
   * @param eintragId - ID des aktualisierten Eintrags
   * @param oldText - Alter Textinhalt (vor Änderung)
   * @param newText - Neuer Textinhalt (nach Änderung)
   * @param updatedBy - User ID des Bearbeiters
   */
  constructor(
    public readonly etbId: EtbId,
    public readonly eintragId: EintragId,
    public readonly oldText: string,
    public readonly newText: string,
    public readonly updatedBy: UserId,
  ) {
    super();
  }
}
