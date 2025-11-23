import { validateRequiredString, validateCuid2Format } from '@application/common/validators/string-validator';

/**
 * Query zum Abrufen eines ETB (Einsatztagebuch) fuer einen Einsatz.
 *
 * Diese Query laedt das ETB mit allen Eintraegen basierend auf der EinsatzId.
 * Optional koennen soft-deleted Eintraege inkludiert werden.
 *
 * **Warum Query Pattern:**
 * - CQRS: Trennung von Read (Query) und Write (Command)
 * - Explizite Intent: GetEtbQuery !== generic "fetch data"
 * - Testbarkeit: Query-Objekte koennen isoliert validiert werden
 *
 * **Unterschied zu Commands:**
 * - Commands aendern State (CreateEtbCommand, AddEintragCommand)
 * - Queries lesen State (GetEtbQuery)
 * - Commands haben Business-Validierung, Queries nur Input-Validierung
 *
 * **includeDeleted Parameter:**
 * - false (default): Nur aktive Eintraege (fuer regulaere UI-Anzeige)
 * - true: Inkl. soft-deleted Eintraege (fuer Admin/Audit-Ansicht)
 */
export class GetEtbQuery {
  /**
   * Erstellt eine Query zum Abrufen eines ETB.
   *
   * Konstruktor-Validierung stellt sicher, dass ungueltige Queries
   * niemals im System existieren (Fail-Fast-Prinzip).
   *
   * @param einsatzId - Eindeutige ID des Einsatzes (CUID2-Format)
   * @param includeDeleted - Ob soft-deleted Eintraege inkludiert werden sollen (default: false)
   * @throws Error wenn einsatzId leer oder undefined ist
   * @throws Error wenn einsatzId kein gueltiges CUID2 Format hat
   */
  constructor(
    public readonly einsatzId: string,
    public readonly includeDeleted: boolean = false,
  ) {
    validateRequiredString(einsatzId, 'einsatzId');
    validateCuid2Format(einsatzId, 'einsatzId');
  }
}
