/**
 * Nanoid format: 21 characters, alphanumeric + _ and -
 */
const NANOID_REGEX = /^[A-Za-z0-9_-]{21}$/;

/**
 * Query zum Prüfen ob eine Lagekarte für einen Einsatz existiert.
 *
 * Diese Query wird verwendet, um Duplikate zu vermeiden (z.B. vor
 * CreateLagekarteCommand). Sie gibt nur ein einfaches boolean zurück,
 * da keine weiteren Daten benötigt werden.
 *
 * **Warum Query Pattern:**
 * - CQRS: Trennung von Read (Query) und Write (Command)
 * - Explizite Intent: GetLagekarteExistsQuery ≠ generic "check exists"
 * - Testbarkeit: Query-Objekte können isoliert validiert werden
 *
 * **Unterschied zu anderen Queries:**
 * - GetLagekarteQuery: Lädt komplette Lagekarte + POIs (Result<DTO|null>)
 * - GetPoisQuery: Lädt POIs einer Lagekarte (Result<PoiDto[]>)
 * - GetLagekarteExistsQuery: Nur Existenz-Check (boolean, kein Result<T>)
 *
 * **Use Cases:**
 * - Lazy Creation Pattern: Prüfen vor CreateLagekarteCommand
 * - Guard Clauses: Validierung ob Lagekarte bereits vorhanden
 * - Performance: Schneller als findByEinsatzId() (kein Row-Loading)
 *
 * **Warum keine Result<boolean> Wrapper:**
 * Existenz-Check ist binär: existiert oder nicht existiert.
 * Repository-Fehler sind unexpected (Infrastruktur-Fehler) → Exception.
 * Einfachere API für Caller (kein Result unwrapping nötig).
 */
export class GetLagekarteExistsQuery {
  /**
   * Erstellt eine Query zum Prüfen ob eine Lagekarte existiert.
   *
   * Konstruktor-Validierung stellt sicher, dass ungültige Queries
   * niemals im System existieren (Fail-Fast-Prinzip).
   *
   * @param einsatzId - Eindeutige ID des Einsatzes (Nanoid, 21 Zeichen)
   * @throws Error wenn einsatzId leer oder undefined ist
   * @throws Error wenn einsatzId kein gültiges nanoid Format hat
   *
   * @example
   * ```typescript
   * // Valid Query
   * const query = new GetLagekarteExistsQuery('einsatz-123');
   * const exists = await handler.execute(query);
   * // exists === true | false
   *
   * // Validation Error
   * const invalid = new GetLagekarteExistsQuery(''); // Throws Error
   * ```
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
