import { EINSATZ_FIELD_LIMITS, validateRequiredStringResult, validateStringLengthResult } from '@application/common/validators/string-validator';
import { Result } from '@domain/common/result';
import type { Address } from '@domain/value-objects/address';

/**
 * Command zum Aktualisieren eines existierenden Einsatzes.
 *
 * Implementiert Partial Update Pattern: Nur übergebene Felder werden aktualisiert.
 * - einsatzId: Pflichtfeld - ID des zu aktualisierenden Einsatzes
 * - alarmstichwort: Optional - Neues Alarmstichwort
 * - einsatzort: Optional - Neue Adresse
 * - bemerkung: Optional - Neue Bemerkung
 *
 * @example
 * ```typescript
 * // Nur alarmstichwort ändern
 * const result = UpdateEinsatzCommand.create('einsatz-id', 'Großbrand');
 *
 * // Mehrere Felder ändern
 * const result2 = UpdateEinsatzCommand.create('einsatz-id', undefined, address, 'Neue Bemerkung');
 * ```
 */
export class UpdateEinsatzCommand {
  private constructor(
    public readonly einsatzId: string,
    public readonly alarmstichwort?: string,
    public readonly einsatzort?: Address,
    public readonly bemerkung?: string,
  ) {}

  /**
   * Factory-Methode mit Validierung.
   */
  public static create(einsatzId: string, alarmstichwort?: string, einsatzort?: Address, bemerkung?: string): Result<UpdateEinsatzCommand> {
    // einsatzId ist required
    const einsatzIdError = validateRequiredStringResult(einsatzId, 'einsatzId');
    if (einsatzIdError) return Result.fail(einsatzIdError);

    // Mindestens ein Feld muss aktualisiert werden
    const hasUpdates = alarmstichwort !== undefined || einsatzort !== undefined || bemerkung !== undefined;

    if (!hasUpdates) {
      return Result.fail('Mindestens ein Feld muss aktualisiert werden');
    }

    // alarmstichwort mit maxLength validieren (wenn übergeben)
    const alarmstichwortError = validateStringLengthResult(alarmstichwort, 'Alarmstichwort', EINSATZ_FIELD_LIMITS.ALARMSTICHWORT_MAX_LENGTH);
    if (alarmstichwortError) return Result.fail(alarmstichwortError);

    // bemerkung mit maxLength validieren (wenn übergeben)
    const bemerkungError = validateStringLengthResult(bemerkung, 'Bemerkung', EINSATZ_FIELD_LIMITS.BEMERKUNG_MAX_LENGTH);
    if (bemerkungError) return Result.fail(bemerkungError);

    return Result.ok(new UpdateEinsatzCommand(einsatzId.trim(), alarmstichwort?.trim(), einsatzort, bemerkung?.trim()));
  }
}
