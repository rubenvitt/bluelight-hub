import { validateRequiredStringResult } from '@application/common/validators/string-validator';
import { Result } from '@domain/common/result';

/**
 * Command zum Löschen eines Benutzers mit optionalem Admin-Downgrade.
 *
 * Implementiert Soft Delete Pattern für Datenintegrität (z.B. ETB createdBy).
 * Der gelöschte Benutzer wird auf isDeleted=true gesetzt und bekommt deletedAt/deletedBy.
 *
 * **Business Rules:**
 * - Soft Delete: User wird NICHT physisch gelöscht (isDeleted=true)
 * - SUPER_ADMIN Schutz: Letzter SUPER_ADMIN kann weder gelöscht noch herabgestuft werden
 * - Admin Downgrade: Optional kann Admin-User zu USER herabgestuft werden statt gelöscht
 * - Audit Trail: deletedBy wird immer gesetzt für Compliance
 *
 * **Admin Downgrade vs. Delete:**
 * - downgradeAdmin=false (default): Admin wird soft-deleted (isDeleted=true)
 * - downgradeAdmin=true: Admin wird zu USER herabgestuft (bleibt aktiv)
 * - Use Case für Downgrade: Admin verlässt Organisation, soll aber als USER bleiben
 *
 * **Warum Soft Delete:**
 * - Datenintegrität: ETB-Einträge haben createdBy → Fremdschlüssel bleibt gültig
 * - Audit Trail: Gelöschte User bleiben nachvollziehbar
 * - Reaktivierung: Gelöschte User können reaktiviert werden
 * - Compliance: DSGVO-konform (Anonymisierung möglich, aber nicht zwingend erforderlich)
 *
 * @example
 * ```typescript
 * // Standard Delete (Soft Delete)
 * const deleteCmd = DeleteUserCommand.create({
 *   id: 'user-id-123',
 *   deletedBy: 'admin-id-456',
 * });
 * const result = await handler.execute(deleteCmd.value);
 *
 * // Admin Downgrade (herabstufen statt löschen)
 * const downgradeCmd = DeleteUserCommand.create({
 *   id: 'admin-id-789',
 *   downgradeAdmin: true,
 *   deletedBy: 'super-admin-id-001',
 * });
 * const result2 = await handler.execute(downgradeCmd.value);
 * // Admin-User ist jetzt USER Role, bleibt aber aktiv
 * ```
 */
export class DeleteUserCommand {
  private constructor(
    public readonly id: string,
    public readonly deletedBy: string,
    public readonly downgradeAdmin: boolean,
  ) {}

  /**
   * Factory-Methode mit Validierung.
   *
   * @param props - Command Props mit id, deletedBy und optionalem downgradeAdmin
   * @returns Result<DeleteUserCommand> - Success mit Command oder Failure mit Error
   */
  public static create(props: { id: string; deletedBy: string; downgradeAdmin?: boolean }): Result<DeleteUserCommand> {
    // id ist required
    const idError = validateRequiredStringResult(props.id, 'id');
    if (idError) return Result.fail(idError);

    // deletedBy ist required (Audit Trail)
    const deletedByError = validateRequiredStringResult(props.deletedBy, 'deletedBy');
    if (deletedByError) return Result.fail(deletedByError);

    return Result.ok(new DeleteUserCommand(props.id.trim(), props.deletedBy.trim(), props.downgradeAdmin ?? false));
  }
}
