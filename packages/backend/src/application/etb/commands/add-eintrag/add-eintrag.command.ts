import { Result } from '@domain/common/result';

/**
 * Command zum Hinzufügen eines neuen Eintrags zum Einsatztagebuch.
 *
 * Diese Command enthält alle Daten für einen neuen ETB-Eintrag:
 * - etbId: ID des Ziel-ETBs
 * - text: Textinhalt des Eintrags
 * - userId: ID des erstellenden Users (für Audit-Trail)
 *
 * Die Sequenznummer wird automatisch vom Aggregate vergeben (auto-increment).
 *
 * @example
 * ```typescript
 * const commandResult = AddEintragCommand.create(
 *   'clx1234567890abcdefghijk', // ETB-ID
 *   'Fahrzeug W1 am Einsatzort eingetroffen',
 *   'clx_user_abc123def456' // User-ID
 * );
 * if (commandResult.isSuccess) {
 *   const eintrag = await commandBus.execute(commandResult.value);
 * }
 * ```
 */
export class AddEintragCommand {
  /**
   * Privater Konstruktor - erzwingt Verwendung der Factory-Methode.
   *
   * @param etbId - ID des Einsatztagebuchs (CUID2-Format)
   * @param text - Textinhalt des neuen Eintrags
   * @param userId - ID des erstellenden Users (CUID2-Format)
   */
  private constructor(
    public readonly etbId: string,
    public readonly text: string,
    public readonly userId: string,
  ) {}

  /**
   * Factory-Methode für AddEintragCommand mit Validierung.
   *
   * Validiert alle erforderlichen Felder. Die Format-Validierung (CUID2)
   * erfolgt im Handler bei Value Object Creation.
   *
   * @param etbId - ID des ETBs, zu dem der Eintrag hinzugefügt wird
   * @param text - Textinhalt des Eintrags (darf nicht leer sein)
   * @param userId - ID des Users, der den Eintrag erstellt
   * @returns Result mit validiertem Command oder Fehlermeldung
   */
  public static create(etbId: string, text: string, userId: string): Result<AddEintragCommand> {
    // Validation: etbId required
    if (!etbId || etbId.trim().length === 0) {
      return Result.fail('etbId is required');
    }

    // Validation: text required and not empty
    if (!text || text.trim().length === 0) {
      return Result.fail('text is required and cannot be empty');
    }

    // Validation: userId required
    if (!userId || userId.trim().length === 0) {
      return Result.fail('userId is required');
    }

    return Result.ok(new AddEintragCommand(etbId, text, userId));
  }
}
