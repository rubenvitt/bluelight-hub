import { validateRequiredStringResult } from '@application/common/validators/string-validator';
import { Result } from '@domain/common/result';

/**
 * Command zum Ändern des Einsatz-Status (State Machine Transition).
 *
 * Kapselt alle erforderlichen Daten für die updateStatus()-Operation:
 * - einsatzId: ID des zu ändernden Einsatzes
 * - newStatus: Neuer Status als String (wird im Handler zu EinsatzStatus konvertiert)
 *
 * **Erlaubte Status-Werte:** ANGELEGT, IN_BEARBEITUNG, ABGESCHLOSSEN, ARCHIVIERT
 */
export class UpdateEinsatzStatusCommand {
  private constructor(
    public readonly einsatzId: string,
    public readonly newStatus: string,
  ) {}

  /**
   * Factory-Methode mit Validierung.
   * Verwendet Result<T> Pattern für explizite Fehlerbehandlung.
   *
   * HINWEIS: Status-Validierung erfolgt im Handler via EinsatzStatus.create().
   */
  public static create(einsatzId: string, newStatus: string): Result<UpdateEinsatzStatusCommand> {
    // einsatzId ist Pflichtfeld
    const einsatzIdError = validateRequiredStringResult(einsatzId, 'einsatzId');
    if (einsatzIdError) return Result.fail(einsatzIdError);

    // newStatus ist Pflichtfeld (Validierung ob gültiger Status erfolgt im Handler)
    const newStatusError = validateRequiredStringResult(newStatus, 'newStatus');
    if (newStatusError) return Result.fail(newStatusError);

    return Result.ok(new UpdateEinsatzStatusCommand(einsatzId.trim(), newStatus.trim().toUpperCase()));
  }
}
