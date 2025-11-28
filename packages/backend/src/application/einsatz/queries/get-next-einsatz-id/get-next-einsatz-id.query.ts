import { validateCuid2Format, validateRequiredString } from '@application/common/validators/string-validator';

/**
 * Query zum Abrufen der ID des naechsten Einsatzes (Navigation).
 *
 * Gibt die ID des Einsatzes zurück, der zeitlich NACH dem angegebenen
 * Einsatz erstellt wurde (basierend auf createdAt).
 *
 * **Business Rules:**
 * - Nur aktive Einsätze (Status !== ARCHIVIERT) werden berücksichtigt
 * - Sortierung nach createdAt ASC (älteste zuerst)
 * - Return null wenn kein nächster Einsatz existiert
 *
 * **Validation Rules:**
 * - einsatzId ist required (nicht leer)
 * - einsatzId muss gueltigem CUID2-Format entsprechen
 *
 * **Use Case:**
 * - Frontend Navigation: "Nächster Einsatz" Button
 * - Keyboard Shortcuts: Arrow Right für Navigation
 *
 * @example
 * ```typescript
 * // Success
 * const query = new GetNextEinsatzIdQuery('clw3h8x9y0000qwertyuiopas');
 *
 * // Failure: Leere ID
 * const query1 = new GetNextEinsatzIdQuery(''); // Throws Error
 *
 * // Failure: Ungültiges Format
 * const query2 = new GetNextEinsatzIdQuery('invalid-id'); // Throws Error
 * ```
 */
export class GetNextEinsatzIdQuery {
  public readonly einsatzId: string;

  constructor(einsatzId: string) {
    validateRequiredString(einsatzId, 'einsatzId');
    validateCuid2Format(einsatzId, 'einsatzId');
    this.einsatzId = einsatzId;
  }
}
