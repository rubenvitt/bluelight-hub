import { DomainEvent } from '@domain/common/domain-event';
import type { EtbId } from '@domain/value-objects/etb-id';
import type { UserId } from '@domain/value-objects/user-id';

/**
 * Event: Das ETB wurde gesperrt (finale Transition zu LOCKED).
 *
 * Dieses Event wird emittiert wenn ein ETB finalisiert wurde und in den
 * LOCKED-Status übergeht. Dies ist eine irreversible Operation - ein gesperrtes
 * ETB kann NIEMALS wieder entsperrt oder modifiziert werden (DRK-Compliance).
 *
 * **Warum irreversibel?**
 * - Compliance: DRK verlangt unveränderliche finale Einsatzberichte
 * - Rechtssicherheit: Gesperrte ETBs sind rechtsgültige Dokumente
 * - Audit-Trail: Verhindert nachträgliche Manipulation finalisierter Berichte
 * - State Machine: LOCKED ist finaler Zustand ohne Ausgangs-Transitions
 *
 * **Business Kontext:**
 * Nach Einsatzende wird das ETB vom Einsatzleiter finalisiert und gesperrt.
 * Ab diesem Zeitpunkt dürfen KEINE Änderungen mehr vorgenommen werden
 * (keine neuen Einträge, keine Updates, keine Deletes). Das ETB wird
 * zu einem unveränderlichen historischen Dokument.
 *
 * **Use Cases:**
 * - Notification Service: Benachrichtige Team über ETB-Finalisierung
 * - Document Generation: Generiere PDF-Bericht aus gesperrtem ETB
 * - Access Control: Entziehe Schreibrechte für dieses ETB
 * - Archive Service: Verschiebe in langfristige Archivierung
 *
 * @example
 * ```typescript
 * // Im EinsatztagebuchAggregate nach lock():
 * this._status = EtbStatus.LOCKED();
 * this.addDomainEvent(new EtbLockedEvent(
 *   this.id,
 *   userId,
 *   new Date()
 * ));
 * ```
 */
export class EtbLockedEvent extends DomainEvent {
  /**
   * Event Name für Event Router (Past Tense).
   *
   * @returns Event Name in past tense
   */
  public static eventName(): string {
    return 'etb.locked';
  }

  /**
   * @param etbId - ID des gesperrten ETB Aggregates
   * @param lockedBy - User ID des Sperrenden (typischerweise Einsatzleiter)
   * @param lockedAt - Timestamp der Sperrung (für Audit-Trail)
   */
  constructor(
    public readonly etbId: EtbId,
    public readonly lockedBy: UserId,
    public readonly lockedAt: Date,
  ) {
    super();
  }
}
