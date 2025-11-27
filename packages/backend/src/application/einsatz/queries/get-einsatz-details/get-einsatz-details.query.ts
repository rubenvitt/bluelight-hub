import { validateCuid2Format, validateRequiredString } from '@application/common/validators/string-validator';

/**
 * Query zum Laden eines Einsatzes mit allen zugehörigen Daten (ETB + Lagekarte).
 *
 * Kombiniert 3 Aggregate-Abfragen in einer Anfrage für Frontend-Effizienz.
 * Diese Query ist optimiert für den häufigsten Frontend-Use-Case:
 * "Zeige vollständige Einsatz-Detail-View mit allen Komponenten".
 *
 * **Warum kombinierte Query:**
 * - Performance: 1 statt 3 API-Roundtrips
 * - Konsistenz: Alle Daten aus gleicher Read-Transaktion
 * - Convenience: Frontend bekommt vollständigen State auf einmal
 *
 * **Validation Rules:**
 * - einsatzId ist required (nicht leer)
 * - einsatzId muss gültigem CUID2-Format entsprechen
 *
 * **Warum Konstruktor-Validierung:**
 * - Fail Fast: Ungültige Queries werden sofort abgelehnt
 * - Type Safety: Query-Instanzen sind garantiert valide
 * - Single Responsibility: Query kapselt Validierungslogik
 *
 * **Handler-Behavior:**
 * - Einsatz MUSS existieren (sonst Result<null>)
 * - ETB kann fehlen (wird als null returned)
 * - Lagekarte kann fehlen (wird als null returned)
 *
 * @example
 * ```typescript
 * // Success
 * const query = new GetEinsatzDetailsQuery('clw3h8x9y0000qwertyuiopas');
 *
 * // Failure: Leere ID
 * const query1 = new GetEinsatzDetailsQuery(''); // Throws Error
 *
 * // Failure: Ungültiges Format
 * const query2 = new GetEinsatzDetailsQuery('invalid-id'); // Throws Error
 * ```
 */
export class GetEinsatzDetailsQuery {
  public readonly einsatzId: string;

  constructor(einsatzId: string) {
    validateRequiredString(einsatzId, 'einsatzId');
    validateCuid2Format(einsatzId, 'einsatzId');
    this.einsatzId = einsatzId;
  }
}
