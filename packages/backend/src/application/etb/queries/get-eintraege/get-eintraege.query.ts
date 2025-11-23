import { validateRequiredString, validateCuid2Format } from '@application/common/validators/string-validator';

/**
 * Query zum Abrufen von Eintraegen eines ETB.
 *
 * Diese Query laedt alle Eintraege eines Einsatztagebuchs mit optionaler
 * Filterung von soft-deleted Eintraegen. Die Eintraege werden nach
 * sequenceNumber sortiert zurueckgegeben (Audit-Anforderung).
 *
 * **Warum Query Pattern:**
 * - CQRS: Trennung von Read (Query) und Write (Command)
 * - Explizite Intent: GetEintraegeQuery statt generic "fetch entries"
 * - Testbarkeit: Query-Objekte koennen isoliert validiert werden
 *
 * **Unterschied zu GetEtbQuery:**
 * - GetEtbQuery: Laedt komplettes ETB + alle Eintraege (null ist valide)
 * - GetEintraegeQuery: Laedt NUR Eintraege (ETB MUSS existieren - NotFoundException!)
 * - GetEintraegeQuery: Optionales includeDeleted Flag fuer Audit-Trail
 *
 * **Use Cases:**
 * - UI-Anzeige: "Zeige alle aktiven Eintraege im ETB"
 * - Audit-Trail: "Zeige ALLE Eintraege inkl. geloeschter"
 * - Export: "Exportiere chronologische Eintragsliste"
 *
 * **Warum ETB MUSS existieren:**
 * Eintraege ohne ETB haben keinen Kontext (zu welchem Einsatz gehoeren sie?).
 * Daher ist "ETB not found" ein Fehler via NotFoundException (nicht null wie bei GetEtbQuery).
 */
export class GetEintraegeQuery {
  /**
   * Erstellt eine Query zum Abrufen von ETB-Eintraegen.
   *
   * Konstruktor-Validierung stellt sicher, dass ungueltige Queries
   * niemals im System existieren (Fail-Fast-Prinzip).
   *
   * **includeDeleted Parameter:**
   * - false (default): Nur aktive Eintraege (isDeleted === false)
   * - true: Alle Eintraege inkl. soft-deleted (fuer Audit-Trail)
   *
   * @param etbId - Eindeutige ID des ETB (CUID2-Format)
   * @param includeDeleted - Ob soft-deleted Eintraege inkludiert werden (default: false)
   * @throws Error wenn etbId leer oder undefined ist
   * @throws Error wenn etbId kein gueltiges CUID2-Format hat
   *
   * @example
   * ```typescript
   * // Nur aktive Eintraege
   * const query1 = new GetEintraegeQuery('cm3abc123xyz');
   * // -> Gibt nur Eintraege mit isDeleted === false zurueck
   *
   * // Alle Eintraege (inkl. geloeschter)
   * const query2 = new GetEintraegeQuery('cm3abc123xyz', true);
   * // -> Gibt ALLE Eintraege zurueck (fuer Audit-Trail)
   *
   * // Validation Error
   * const invalid = new GetEintraegeQuery(''); // Throws Error
   * ```
   */
  constructor(
    public readonly etbId: string,
    public readonly includeDeleted: boolean = false,
  ) {
    validateRequiredString(etbId, 'etbId');
    validateCuid2Format(etbId, 'etbId');
  }
}
