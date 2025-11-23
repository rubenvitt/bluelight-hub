import { Result } from '@domain/common/result';

/**
 * Command zum Sperren eines Einsatztagebuchs (irreversible Aktion).
 *
 * Dieses Command loest die finale Transition zu LOCKED aus.
 * Nach der Sperrung sind KEINE Aenderungen mehr moeglich (DRK-Compliance).
 *
 * **Wichtige Business Rules:**
 * - Lock ist IRREVERSIBEL - es gibt keine Unlock-Operation
 * - Nur ADMIN oder SUPER_ADMIN duerfen ETBs sperren
 * - Ein bereits gesperrtes ETB kann nicht erneut gesperrt werden
 *
 * **Daten:**
 * - etbId: ID des zu sperrenden ETBs
 * - userId: ID des sperrenden Users (fuer Audit-Trail)
 * - userRole: Rolle des Users (ADMIN/SUPER_ADMIN fuer Authorization-Check)
 *
 * @example
 * ```typescript
 * const commandResult = LockEtbCommand.create(
 *   'clx1234567890abcdefghijk', // ETB-ID
 *   'clx_user_abc123def456',    // User-ID
 *   'ADMIN'                     // User-Role
 * );
 * if (commandResult.isSuccess) {
 *   await handler.execute(commandResult.value);
 * }
 * ```
 */
export class LockEtbCommand {
  /**
   * Privater Konstruktor - erzwingt Verwendung der Factory-Methode.
   *
   * @param etbId - ID des Einsatztagebuchs (CUID2-Format)
   * @param userId - ID des sperrenden Users (CUID2-Format)
   * @param userRole - Rolle des Users fuer defensive Authorization
   */
  private constructor(
    public readonly etbId: string,
    public readonly userId: string,
    public readonly userRole: string,
  ) {}

  /**
   * Factory-Methode fuer LockEtbCommand mit Validierung.
   *
   * Validiert alle erforderlichen Felder. Die Format-Validierung (CUID2)
   * erfolgt im Handler bei Value Object Creation.
   *
   * @param etbId - ID des zu sperrenden ETBs
   * @param userId - ID des sperrenden Users
   * @param userRole - Rolle des Users (ADMIN/SUPER_ADMIN erforderlich)
   * @returns Result mit validiertem Command oder Fehlermeldung
   */
  public static create(etbId: string, userId: string, userRole: string): Result<LockEtbCommand> {
    // Validation: etbId required
    if (!etbId || etbId.trim().length === 0) {
      return Result.fail('etbId is required');
    }

    // Validation: userId required
    if (!userId || userId.trim().length === 0) {
      return Result.fail('userId is required');
    }

    // Validation: userRole required
    if (!userRole || userRole.trim().length === 0) {
      return Result.fail('userRole is required');
    }

    return Result.ok(new LockEtbCommand(etbId, userId, userRole));
  }
}
