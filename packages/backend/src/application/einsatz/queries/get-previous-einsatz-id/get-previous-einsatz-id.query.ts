import { validateCuid2Format, validateRequiredString } from '@application/common/validators/string-validator';

/**
 * Query zum Abrufen der ID des vorherigen Einsatzes (Navigation).
 *
 * Gibt die ID des Einsatzes zurück, der zeitlich VOR dem angegebenen
 * Einsatz erstellt wurde (basierend auf createdAt).
 *
 * **Business Rules:**
 * - Nur aktive Einsätze (Status !== ARCHIVIERT) werden berücksichtigt
 * - Sortierung nach createdAt DESC (neueste zuerst)
 * - Return null wenn kein vorheriger Einsatz existiert
 *
 * **Validation Rules:**
 * - einsatzId ist required (nicht leer)
 * - einsatzId muss gueltigem CUID2-Format entsprechen
 *
 * **Use Case:**
 * - Frontend Navigation: "Vorheriger Einsatz" Button
 * - Keyboard Shortcuts: Arrow Left für Navigation
 *
 * @example
 * ```typescript
 * // Success
 * const query = new GetPreviousEinsatzIdQuery('clw3h8x9y0000qwertyuiopas');
 *
 * // Failure: Leere ID
 * const query1 = new GetPreviousEinsatzIdQuery(''); // Throws Error
 *
 * // Failure: Ungültiges Format
 * const query2 = new GetPreviousEinsatzIdQuery('invalid-id'); // Throws Error
 * ```
 */
export class GetPreviousEinsatzIdQuery {
  public readonly einsatzId: string;

  constructor(einsatzId: string) {
    validateRequiredString(einsatzId, 'einsatzId');
    validateCuid2Format(einsatzId, 'einsatzId');
    this.einsatzId = einsatzId;
  }
}
