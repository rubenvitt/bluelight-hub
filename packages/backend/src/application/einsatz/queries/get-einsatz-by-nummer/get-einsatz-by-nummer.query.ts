import { validateRequiredString } from '@application/common/validators/string-validator';

/**
 * Query zum Abrufen eines Einsatzes by Einsatznummer.
 *
 * Diese Query lädt einen Einsatz anhand seiner Einsatznummer (Business Key),
 * die als Alternative zur internen ID für User-Facing Referenzen genutzt wird.
 *
 * **Warum Query Pattern:**
 * - CQRS: Trennung von Read (Query) und Write (Command)
 * - Explizite Intent: GetEinsatzByNummerQuery ≠ generic "fetch by field"
 * - Testbarkeit: Query-Objekte können isoliert validiert werden
 *
 * **Unterschied zu GetEinsatzByIdQuery:**
 * - ByNummer: Nutzt Business Key (z.B. "E2024-abc123xy") für User-Suche
 * - ById: Nutzt interne ID (CUID2) für System-Referenzen
 *
 * **Business Key:**
 * Einsatznummer ist ein eindeutiger Business Key (Format: "E{YEAR}-{CUID-8}"),
 * der User-sichtbar ist und für Suche/Referenzierung genutzt wird.
 */
export class GetEinsatzByNummerQuery {
  public readonly nummer: string;

  /**
   * Erstellt eine Query zum Abrufen eines Einsatzes by Nummer.
   *
   * Konstruktor-Validierung stellt sicher, dass ungültige Queries
   * niemals im System existieren (Fail-Fast-Prinzip).
   *
   * @param nummer - Einsatznummer (z.B. "E2024-abc123xy")
   * @throws Error wenn nummer leer oder undefined ist
   */
  constructor(nummer: string) {
    validateRequiredString(nummer, 'nummer');
    this.nummer = nummer;
  }
}
