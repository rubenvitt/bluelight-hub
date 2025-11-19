/**
 * Nanoid format: 21 characters, alphanumeric + _ and -
 */
const NANOID_REGEX = /^[A-Za-z0-9_-]{21}$/;

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
    if (!einsatzId?.trim()) {
      throw new Error('einsatzId is required');
    }
    if (!NANOID_REGEX.test(einsatzId)) {
      throw new Error('einsatzId must be a valid nanoid format (21 alphanumeric characters)');
    }
  }
}
