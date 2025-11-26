import { validateCuid2Format, validateRequiredString } from '@application/common/validators/string-validator';

/**
 * Query zum Abrufen eines Einsatzes by ID.
 *
 * Validiert einsatzId im Konstruktor und stellt sicher,
 * dass nur gueltige CUID2-IDs verarbeitet werden.
 *
 * **Validation Rules:**
 * - einsatzId ist required (nicht leer)
 * - einsatzId muss gueltigem CUID2-Format entsprechen
 *
 * **Warum Konstruktor-Validierung:**
 * - Fail Fast: Ungueltige Queries werden sofort abgelehnt
 * - Type Safety: Query-Instanzen sind garantiert valide
 * - Single Responsibility: Query kapselt Validierungslogik
 *
 * @example
 * ```typescript
 * // Success
 * const query = new GetEinsatzByIdQuery('clw3h8x9y0000qwertyuiopas');
 *
 * // Failure: Leere ID
 * const query1 = new GetEinsatzByIdQuery(''); // Throws Error
 *
 * // Failure: Ungültiges Format
 * const query2 = new GetEinsatzByIdQuery('invalid-id'); // Throws Error
 * ```
 */
export class GetEinsatzByIdQuery {
  public readonly einsatzId: string;

  constructor(einsatzId: string) {
    validateRequiredString(einsatzId, 'einsatzId');
    validateCuid2Format(einsatzId, 'einsatzId');
    this.einsatzId = einsatzId;
  }
}
