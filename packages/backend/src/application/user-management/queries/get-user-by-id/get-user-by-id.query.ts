import { validateRequiredString } from '@application/common/validators/string-validator';
import { isCuid } from '@paralleldrive/cuid2';

/**
 * Query zum Abrufen eines Users by ID.
 *
 * Validiert userId im Konstruktor und stellt sicher,
 * dass nur gueltige CUID-IDs verarbeitet werden.
 *
 * **WICHTIG:** User IDs verwenden cuid-Format (21 Zeichen, gemischte Gross-/Kleinbuchstaben),
 * NICHT CUID2-Format wie Einsatz IDs. Dies entspricht dem Prisma-Schema:
 * `model User { id String @id @default(cuid()) }`
 *
 * **Validation Rules:**
 * - userId ist required (nicht leer)
 * - userId muss gueltigem cuid-Format entsprechen (21 Zeichen)
 *
 * **Warum Konstruktor-Validierung:**
 * - Fail Fast: Ungueltige Queries werden sofort abgelehnt
 * - Type Safety: Query-Instanzen sind garantiert valide
 * - Single Responsibility: Query kapselt Validierungslogik
 *
 * @example
 * ```typescript
 * // Success
 * const query = new GetUserByIdQuery('clw3h8x9y0000qwerty01');
 *
 * // Failure: Leere ID
 * const query1 = new GetUserByIdQuery(''); // Throws Error
 *
 * // Failure: Ungültiges Format (CUID2 statt cuid)
 * const query2 = new GetUserByIdQuery('invalid-id'); // Throws Error
 * ```
 */
export class GetUserByIdQuery {
  public readonly userId: string;

  constructor(userId: string) {
    validateRequiredString(userId, 'userId');

    // Validiere cuid-Format (21 Zeichen, alphanumeric mit Gross-/Kleinbuchstaben)
    if (!isCuid(userId)) {
      throw new Error('userId must be a valid cuid format (21 alphanumeric characters)');
    }

    this.userId = userId;
  }
}
