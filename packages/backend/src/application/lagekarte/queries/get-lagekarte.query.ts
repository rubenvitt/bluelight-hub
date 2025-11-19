import { validateRequiredString, validateNanoidFormat } from '@application/common/validators/string-validator';

/**
 * Query zum Abrufen einer Lagekarte für einen Einsatz.
 *
 * Diese Query lädt die Lagekarte mit allen POIs und konvertiert
 * MGRS-Koordinaten zusätzlich zu Lat/Lng, damit das Frontend
 * beide Formate nutzen kann (MGRS für Anzeige, Lat/Lng für Leaflet).
 *
 * **Warum Query Pattern:**
 * - CQRS: Trennung von Read (Query) und Write (Command)
 * - Explizite Intent: GetLagekarteQuery ≠ generic "fetch data"
 * - Testbarkeit: Query-Objekte können isoliert validiert werden
 *
 * **Unterschied zu Commands:**
 * - Commands ändern State (CreateLagekarteCommand)
 * - Queries lesen State (GetLagekarteQuery)
 * - Commands haben Business-Validierung, Queries nur Input-Validierung
 */
export class GetLagekarteQuery {
  /**
   * Erstellt eine Query zum Abrufen einer Lagekarte.
   *
   * Konstruktor-Validierung stellt sicher, dass ungültige Queries
   * niemals im System existieren (Fail-Fast-Prinzip).
   *
   * @param einsatzId - Eindeutige ID des Einsatzes (Nanoid, 21 Zeichen)
   * @throws Error wenn einsatzId leer oder undefined ist
   * @throws Error wenn einsatzId kein gültiges nanoid Format hat
   */
  constructor(public readonly einsatzId: string) {
    validateRequiredString(einsatzId, 'einsatzId');
    validateNanoidFormat(einsatzId, 'einsatzId');
  }
}
