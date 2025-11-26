import { EINSATZ_FIELD_LIMITS, validateRequiredStringResult, validateStringLengthResult } from '@application/common/validators/string-validator';
import { Result } from '@domain/common/result';
import type { Address } from '@domain/value-objects/address';

/**
 * Command zum Erstellen eines neuen Einsatzes.
 *
 * Kapselt alle erforderlichen und optionalen Daten für die Einsatz-Erstellung:
 * - alarmstichwort: Pflichtfeld (z.B. "Wohnungsbrand", "Verkehrsunfall")
 * - createdBy: User-ID des Erstellers (für Audit-Trail)
 * - einsatzort: Optional - Adresse des Einsatzortes
 * - bemerkung: Optional - Freitext-Bemerkung
 *
 * @example
 * ```typescript
 * const result = CreateEinsatzCommand.create(
 *   'Wohnungsbrand',
 *   'clx_user_abc123',
 *   address,
 *   'Dachstuhl brennt'
 * );
 * if (result.isSuccess) {
 *   await handler.execute(result.value);
 * }
 * ```
 */
export class CreateEinsatzCommand {
  private constructor(
    public readonly alarmstichwort: string,
    public readonly createdBy: string,
    public readonly einsatzort?: Address,
    public readonly bemerkung?: string,
  ) {}

  /**
   * Factory-Methode mit Validierung.
   * Verwendet Result<T> Pattern für explizite Fehlerbehandlung.
   */
  public static create(alarmstichwort: string, createdBy: string, einsatzort?: Address, bemerkung?: string): Result<CreateEinsatzCommand> {
    // Business Rule: alarmstichwort ist Pflichtfeld mit maxLength
    const alarmstichwortError = validateRequiredStringResult(alarmstichwort, 'Alarmstichwort', EINSATZ_FIELD_LIMITS.ALARMSTICHWORT_MAX_LENGTH);
    if (alarmstichwortError) return Result.fail(alarmstichwortError);

    // createdBy ist required für Audit Trail
    const createdByError = validateRequiredStringResult(createdBy, 'createdBy');
    if (createdByError) return Result.fail(createdByError);

    // bemerkung ist optional, aber mit maxLength wenn gesetzt
    const bemerkungError = validateStringLengthResult(bemerkung, 'Bemerkung', EINSATZ_FIELD_LIMITS.BEMERKUNG_MAX_LENGTH);
    if (bemerkungError) return Result.fail(bemerkungError);

    return Result.ok(new CreateEinsatzCommand(alarmstichwort.trim(), createdBy.trim(), einsatzort, bemerkung?.trim()));
  }
}
