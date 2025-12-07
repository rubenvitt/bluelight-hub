import { Result } from '@domain/common/result';

/**
 * Command für das Sperren eines User-Accounts.
 *
 * Kapselt alle Parameter für die User Lock Operation in einem
 * immutable DTO. Folgt Command Pattern für CQRS Architecture.
 *
 * **Business Context:**
 * - ADMIN/SUPER_ADMIN sperrt USER wegen verdächtiger Aktivitäten
 * - SUPER_ADMIN sperrt ADMIN wegen Policy-Verstößen
 * - System-triggered Lock nach mehrfachen Fehlversuchen
 *
 * **Validation:**
 * - id muss valide UUID sein (wird von UserId.create() validiert)
 * - lockedBy muss valide UUID sein (wird von UserId.create() validiert)
 * - reason ist optional (für Transparency und Audit)
 *
 * **Immutability:**
 * - Readonly fields verhindert Mutation nach Erstellung
 * - Factory Method enforces Validation vor Command-Erstellung
 * - Command repräsentiert validierte Intent (nicht mehr änderbar)
 *
 * @example
 * ```typescript
 * const commandResult = LockUserCommand.create({
 *   id: 'abc123',
 *   lockedBy: 'xyz789',
 *   reason: 'Verdächtige Login-Aktivitäten',
 * });
 *
 * if (commandResult.isSuccess) {
 *   const command = commandResult.value!;
 *   const result = await handler.execute(command);
 * }
 * ```
 */
export class LockUserCommand {
  /**
   * Private Constructor erzwingt Factory Method Nutzung.
   * Verhindert direkte Instanziierung ohne Validation.
   *
   * @param id - UUID des zu sperrenden Users
   * @param lockedBy - UUID des Users der die Sperrung durchführt
   * @param reason - Optional: Grund der Sperrung
   */
  private constructor(
    public readonly id: string,
    public readonly lockedBy: string,
    public readonly reason?: string,
  ) {}

  /**
   * Factory Method zur Erstellung eines LockUserCommand mit Basic Validation.
   * Verwendet Result<T> Pattern zur expliziten Fehlerbehandlung.
   *
   * **Validation Rules:**
   * - id ist required und darf nicht leer sein
   * - lockedBy ist required und darf nicht leer sein
   * - reason ist optional (für Transparency und Audit)
   *
   * **Warum hier nur Basic Validation:**
   * - Detaillierte UUID-Validation erfolgt im Handler (UserId.create())
   * - Command Layer fokussiert auf Presence Checks
   * - Domain Layer (Handler + Aggregate) enforced Business Rules
   *
   * @param props - Command Properties
   * @param props.id - UUID des zu sperrenden Users
   * @param props.lockedBy - UUID des Users der die Sperrung durchführt
   * @param props.reason - Optional: Grund der Sperrung
   * @returns Result<LockUserCommand> - Success mit Command oder Failure mit Error Message
   */
  static create(props: { id: string; lockedBy: string; reason?: string }): Result<LockUserCommand> {
    // Validate required fields
    if (!props.id?.trim()) {
      return Result.fail<LockUserCommand>('User ID is required');
    }

    if (!props.lockedBy?.trim()) {
      return Result.fail<LockUserCommand>('LockedBy ID is required');
    }

    // Create command
    return Result.ok<LockUserCommand>(new LockUserCommand(props.id.trim(), props.lockedBy.trim(), props.reason?.trim()));
  }
}
