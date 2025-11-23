import { validateRequiredString, validateCuid2Format } from '@application/common/validators/string-validator';

/**
 * Query zum Abrufen der Versions-Historie eines ETB.
 *
 * Diese Query laedt alle gespeicherten Snapshots fuer ein Einsatztagebuch,
 * um Audit-Trail, Rollback-Funktionalitaet und zeitliche Zustandsanalyse
 * zu ermoeglichen.
 *
 * **Warum Query Pattern:**
 * - CQRS: Trennung von Read (Query) und Write (Command)
 * - Explizite Intent: GetEtbHistoryQuery != generic "fetch data"
 * - Testbarkeit: Query-Objekte koennen isoliert validiert werden
 *
 * **Use Cases:**
 * - Audit-Trail: Anzeige aller ETB-Aenderungen fuer DRK-Compliance
 * - Rollback UI: Auswaehlen einer frueheren Version zum Wiederherstellen
 * - Report-Generierung: PDF-Export eines historischen Zustands
 *
 * **Unterschied zu GetEtbQuery:**
 * - GetEtbQuery: Laedt aktuellen Live-Zustand des Aggregates
 * - GetEtbHistoryQuery: Laedt Array aller historischen Snapshots
 */
export class GetEtbHistoryQuery {
  /**
   * Erstellt eine Query zum Abrufen der ETB-Historie.
   *
   * Konstruktor-Validierung stellt sicher, dass ungueltige Queries
   * niemals im System existieren (Fail-Fast-Prinzip).
   *
   * @param etbId - Eindeutige ID des Einsatztagebuchs (CUID2, 20-30 Zeichen)
   * @throws Error wenn etbId leer oder undefined ist
   * @throws Error wenn etbId kein gueltiges CUID2 Format hat
   */
  constructor(public readonly etbId: string) {
    validateRequiredString(etbId, 'etbId');
    validateCuid2Format(etbId, 'etbId');
  }
}
