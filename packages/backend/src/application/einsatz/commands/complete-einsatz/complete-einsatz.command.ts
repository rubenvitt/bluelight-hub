import { validateRequiredStringResult } from '@application/common/validators/string-validator';
import { Result } from '@domain/common/result';

/**
 * Command zum Abschließen eines Einsatzes.
 *
 * Kapselt alle erforderlichen Daten für die complete()-Operation:
 * - einsatzId: ID des abzuschließenden Einsatzes
 * - completedBy: User-ID des abschließenden Users (für Audit-Trail)
 */
export class CompleteEinsatzCommand {
  private constructor(
    public readonly einsatzId: string,
    public readonly completedBy: string,
  ) {}

  /**
   * Factory-Methode mit Validierung.
   * Verwendet Result<T> Pattern für explizite Fehlerbehandlung.
   */
  public static create(einsatzId: string, completedBy: string): Result<CompleteEinsatzCommand> {
    // einsatzId ist Pflichtfeld
    const einsatzIdError = validateRequiredStringResult(einsatzId, 'einsatzId');
    if (einsatzIdError) return Result.fail(einsatzIdError);

    // completedBy ist required für Audit Trail
    const completedByError = validateRequiredStringResult(completedBy, 'completedBy');
    if (completedByError) return Result.fail(completedByError);

    return Result.ok(new CompleteEinsatzCommand(einsatzId.trim(), completedBy.trim()));
  }
}
