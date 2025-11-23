import { Result } from '@domain/common/result';

/**
 * Command zum Aktualisieren eines bestehenden Eintrags im Einsatztagebuch.
 *
 * Diese Command enthält alle Daten für ein Eintrag-Update:
 * - etbId: ID des Ziel-ETBs
 * - eintragId: ID des zu aktualisierenden Eintrags
 * - newText: Neuer Textinhalt des Eintrags
 * - userId: ID des bearbeitenden Users (für Audit-Trail)
 *
 * Der alte Text wird automatisch vom Aggregate gespeichert (für Change Tracking).
 *
 * @example
 * ```typescript
 * const commandResult = UpdateEintragCommand.create(
 *   'clx1234567890abcdefghijk', // ETB-ID
 *   'clx_entry_abc123def456',   // Eintrag-ID
 *   'Fahrzeug W1 um 14:30 Uhr am Einsatzort eingetroffen',
 *   'clx_user_abc123def456'     // User-ID
 * );
 * if (commandResult.isSuccess) {
 *   await commandBus.execute(commandResult.value);
 * }
 * ```
 */
export class UpdateEintragCommand {
  /**
   * Privater Konstruktor - erzwingt Verwendung der Factory-Methode.
   *
   * @param etbId - ID des Einsatztagebuchs (CUID2-Format)
   * @param eintragId - ID des zu aktualisierenden Eintrags (CUID2-Format)
   * @param newText - Neuer Textinhalt des Eintrags
   * @param userId - ID des bearbeitenden Users (CUID2-Format)
   */
  private constructor(
    public readonly etbId: string,
    public readonly eintragId: string,
    public readonly newText: string,
    public readonly userId: string,
  ) {}

  /**
   * Factory-Methode für UpdateEintragCommand mit Validierung.
   *
   * Validiert alle erforderlichen Felder. Die Format-Validierung (CUID2)
   * erfolgt im Handler bei Value Object Creation.
   *
   * @param etbId - ID des ETBs, in dem der Eintrag aktualisiert wird
   * @param eintragId - ID des zu aktualisierenden Eintrags
   * @param newText - Neuer Textinhalt des Eintrags (darf nicht leer sein)
   * @param userId - ID des Users, der den Eintrag aktualisiert
   * @returns Result mit validiertem Command oder Fehlermeldung
   */
  public static create(etbId: string, eintragId: string, newText: string, userId: string): Result<UpdateEintragCommand> {
    // Validation: etbId required
    if (!etbId || etbId.trim().length === 0) {
      return Result.fail('etbId is required');
    }

    // Validation: eintragId required
    if (!eintragId || eintragId.trim().length === 0) {
      return Result.fail('eintragId is required');
    }

    // Validation: newText required and not empty
    if (!newText || newText.trim().length === 0) {
      return Result.fail('newText is required and cannot be empty');
    }

    // Validation: userId required
    if (!userId || userId.trim().length === 0) {
      return Result.fail('userId is required');
    }

    return Result.ok(new UpdateEintragCommand(etbId, eintragId, newText, userId));
  }
}
