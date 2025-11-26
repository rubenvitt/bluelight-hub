import { validateCuid2Format, validateRequiredString } from '@application/common/validators/string-validator';

/**
 * Query zum Abrufen von POIs einer Lagekarte.
 *
 * Diese Query lädt POIs mit optionaler Kategorie-Filterung und konvertiert
 * MGRS-Koordinaten zusätzlich zu Lat/Lng für Frontend-Kompatibilität.
 *
 * **Warum Query Pattern:**
 * - CQRS: Trennung von Read (Query) und Write (Command)
 * - Explizite Intent: GetPoisQuery ≠ generic "fetch POIs"
 * - Testbarkeit: Query-Objekte können isoliert validiert werden
 *
 * **Unterschied zu GetLagekarteQuery:**
 * - GetLagekarteQuery: Lädt komplette Lagekarte + alle POIs (null ist valide)
 * - GetPoisQuery: Lädt NUR POIs einer Lagekarte (Lagekarte MUSS existieren)
 * - GetPoisQuery: Optionale Kategorie-Filterung für UI-Performance
 *
 * **Use Cases:**
 * - UI-Filterung: "Zeige nur Einsatzstellen auf Karte"
 * - Map-Layer: "Lade Gefahrenstellen für separaten Layer"
 * - Reporting: "Exportiere alle Wasserentnahmestellen"
 *
 * **Warum Lagekarte MUSS existieren:**
 * POIs ohne Lagekarte haben keinen Kontext (zu welchem Einsatz gehören sie?).
 * Daher ist "Lagekarte not found" ein Fehler (nicht null wie bei GetLagekarteQuery).
 */
export class GetPoisQuery {
  /**
   * Erstellt eine Query zum Abrufen von POIs einer Lagekarte.
   *
   * Konstruktor-Validierung stellt sicher, dass ungültige Queries
   * niemals im System existieren (Fail-Fast-Prinzip).
   *
   * **Kategorie-Filterung:**
   * - Wenn category undefined: Alle POIs werden zurückgegeben
   * - Wenn category definiert: Nur POIs mit dieser Kategorie
   * - Filterung erfolgt im Handler via aggregate.findPoisByCategory()
   *
   * @param lagekarteId - Eindeutige ID der Lagekarte (cuid)
   * @param category - Optionale Kategorie-Filterung (z.B. "EINSATZSTELLE")
   * @throws Error wenn lagekarteId leer oder undefined ist
   * @throws Error wenn lagekarteId kein gültiges cuid Format hat
   *
   * @example
   * ```typescript
   * // Alle POIs einer Lagekarte
   * const query1 = new GetPoisQuery('lagekarte-123');
   * // → Gibt alle POIs zurück (keine Filterung)
   *
   * // Nur Einsatzstellen
   * const query2 = new GetPoisQuery('lagekarte-123', 'EINSATZSTELLE');
   * // → Gibt nur POIs mit category=EINSATZSTELLE zurück
   *
   * // Validation Error
   * const invalid = new GetPoisQuery(''); // Throws Error
   * ```
   */
  constructor(
    public readonly lagekarteId: string,
    public readonly category?: string,
  ) {
    validateRequiredString(lagekarteId, 'lagekarteId');
    validateCuid2Format(lagekarteId, 'lagekarteId');
  }
}
