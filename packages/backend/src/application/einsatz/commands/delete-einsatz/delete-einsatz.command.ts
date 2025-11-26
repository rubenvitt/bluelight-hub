import { validateRequiredStringResult } from '@application/common/validators/string-validator';
import { Result } from '@domain/common/result';

/**
 * Command zum Löschen eines Einsatzes.
 *
 * WICHTIG: Dieser Command wird IMMER abgelehnt (NO-DELETE Policy).
 * Einsätze können gemäß DRK-Compliance (10-Jahre-Aufbewahrungspflicht)
 * NIEMALS physisch gelöscht werden. Verwende stattdessen ArchiveEinsatzCommand.
 *
 * Warum existiert dieser Command trotzdem?
 * - API-Konsistenz: DELETE Endpoint muss existieren für REST-Konformität
 * - Explizite Fehlermeldung: User erhält klare Info über NO-DELETE Policy
 * - Future-Proofing: Falls Policy sich ändert, ist Infrastruktur vorhanden
 *
 * @example
 * ```typescript
 * const result = DeleteEinsatzCommand.create('einsatz-id');
 * const deleteResult = await handler.execute(result.value);
 * // deleteResult.isFailure === true (IMMER)
 * // deleteResult.error === "Einsätze können nicht gelöscht werden..."
 * ```
 */
export class DeleteEinsatzCommand {
  private constructor(public readonly einsatzId: string) {}

  /**
   * Factory-Methode mit Validierung.
   */
  public static create(einsatzId: string): Result<DeleteEinsatzCommand> {
    // einsatzId ist required
    const einsatzIdError = validateRequiredStringResult(einsatzId, 'einsatzId');
    if (einsatzIdError) return Result.fail(einsatzIdError);

    return Result.ok(new DeleteEinsatzCommand(einsatzId.trim()));
  }
}
