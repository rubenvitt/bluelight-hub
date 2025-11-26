import { validateRequiredStringResult } from '@application/common/validators/string-validator';
import { Result } from '@domain/common/result';

/**
 * Command zum Archivieren eines Einsatzes (finale Transition).
 *
 * Kapselt alle erforderlichen Daten für die archive()-Operation:
 * - einsatzId: ID des zu archivierenden Einsatzes
 * - archivedBy: User-ID des archivierenden Users (für Audit-Trail)
 *
 * **Business Rule:** 10-Jahres-Aufbewahrungspflicht muss erfüllt sein.
 */
export class ArchiveEinsatzCommand {
  private constructor(
    public readonly einsatzId: string,
    public readonly archivedBy: string,
  ) {}

  /**
   * Factory-Methode mit Validierung.
   * Verwendet Result<T> Pattern für explizite Fehlerbehandlung.
   */
  public static create(einsatzId: string, archivedBy: string): Result<ArchiveEinsatzCommand> {
    // einsatzId ist Pflichtfeld
    const einsatzIdError = validateRequiredStringResult(einsatzId, 'einsatzId');
    if (einsatzIdError) return Result.fail(einsatzIdError);

    // archivedBy ist required für Audit Trail
    const archivedByError = validateRequiredStringResult(archivedBy, 'archivedBy');
    if (archivedByError) return Result.fail(archivedByError);

    return Result.ok(new ArchiveEinsatzCommand(einsatzId.trim(), archivedBy.trim()));
  }
}
