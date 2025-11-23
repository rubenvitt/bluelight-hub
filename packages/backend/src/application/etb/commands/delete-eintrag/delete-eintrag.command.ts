import { Result } from '@domain/common/result';

/**
 * Command zum Löschen eines Eintrags aus dem Einsatztagebuch (Soft-Delete).
 *
 * Dieses Command initiiert einen Soft-Delete-Vorgang:
 * - etbId: ID des parent ETB-Aggregates
 * - eintragId: ID des zu löschenden Eintrags
 * - userId: ID des löschenden Users (für Audit-Trail)
 *
 * **Wichtig: Soft-Delete Pattern**
 * Der Eintrag wird NICHT physisch entfernt, sondern mit `isDeleted=true`
 * markiert. Dies garantiert DRK-konforme Revisionssicherheit und
 * lückenlose Audit-Trails.
 *
 * @example
 * ```typescript
 * const commandResult = DeleteEintragCommand.create(
 *   'clx1234567890abcdefghijk', // ETB-ID
 *   'clx_eintrag_abc123def456', // Eintrag-ID
 *   'clx_user_abc123def456'     // User-ID
 * );
 * if (commandResult.isSuccess) {
 *   await commandBus.execute(commandResult.value);
 * }
 * ```
 */
export class DeleteEintragCommand {
  /**
   * Privater Konstruktor - erzwingt Verwendung der Factory-Methode.
   *
   * @param etbId - ID des Einsatztagebuchs (CUID2-Format)
   * @param eintragId - ID des zu löschenden Eintrags (CUID2-Format)
   * @param userId - ID des löschenden Users (CUID2-Format)
   */
  private constructor(
    public readonly etbId: string,
    public readonly eintragId: string,
    public readonly userId: string,
  ) {}

  /**
   * Factory-Methode für DeleteEintragCommand mit Validierung.
   *
   * Validiert alle erforderlichen Felder. Die Format-Validierung (CUID2)
   * erfolgt im Handler bei Value Object Creation.
   *
   * @param etbId - ID des ETBs, aus dem der Eintrag gelöscht wird
   * @param eintragId - ID des zu löschenden Eintrags
   * @param userId - ID des Users, der den Eintrag löscht
   * @returns Result mit validiertem Command oder Fehlermeldung
   */
  public static create(etbId: string, eintragId: string, userId: string): Result<DeleteEintragCommand> {
    // Validation: etbId required
    if (!etbId || etbId.trim().length === 0) {
      return Result.fail('etbId is required');
    }

    // Validation: eintragId required
    if (!eintragId || eintragId.trim().length === 0) {
      return Result.fail('eintragId is required');
    }

    // Validation: userId required
    if (!userId || userId.trim().length === 0) {
      return Result.fail('userId is required');
    }

    return Result.ok(new DeleteEintragCommand(etbId, eintragId, userId));
  }
}
