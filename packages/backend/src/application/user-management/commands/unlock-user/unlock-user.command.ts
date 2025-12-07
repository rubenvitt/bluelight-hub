import { Result } from '@domain/common/result';

/**
 * Command für das Entsperren eines User-Accounts.
 *
 * Kapselt alle Parameter für die User Unlock Operation in einem
 * immutable DTO. Folgt Command Pattern für CQRS Architecture.
 *
 * **Business Context:**
 * - ADMIN entsperrt USER nach Klärung verdächtiger Aktivitäten
 * - SUPER_ADMIN entsperrt ADMIN nach beendeter Untersuchung
 * - System-triggered Unlock nach Timeout
 *
 * **Validation:**
 * - id muss valide UUID sein (wird von UserId.create() validiert)
 * - unlockedBy muss valide UUID sein (wird von UserId.create() validiert)
 *
 * **Immutability:**
 * - Readonly fields verhindert Mutation nach Erstellung
 * - Factory Method enforces Validation vor Command-Erstellung
 * - Command repräsentiert validierte Intent (nicht mehr änderbar)
 *
 * @example
 * ```typescript
 * const commandResult = UnlockUserCommand.create({
 *   id: 'abc123',
 *   unlockedBy: 'xyz789',
 * });
 *
 * if (commandResult.isSuccess) {
 *   const command = commandResult.value!;
 *   const result = await handler.execute(command);
 * }
 * ```
 */
export class UnlockUserCommand {
  /**
   * Private Constructor erzwingt Factory Method Nutzung.
   * Verhindert direkte Instanziierung ohne Validation.
   *
   * @param id - UUID des zu entsperrenden Users
   * @param unlockedBy - UUID des Users der die Entsperrung durchführt
   */
  private constructor(
    public readonly id: string,
    public readonly unlockedBy: string,
  ) {}

  /**
   * Factory Method zur Erstellung eines UnlockUserCommand mit Basic Validation.
   * Verwendet Result<T> Pattern zur expliziten Fehlerbehandlung.
   *
   * **Validation Rules:**
   * - id ist required und darf nicht leer sein
   * - unlockedBy ist required und darf nicht leer sein
   *
   * **Warum hier nur Basic Validation:**
   * - Detaillierte UUID-Validation erfolgt im Handler (UserId.create())
   * - Command Layer fokussiert auf Presence Checks
   * - Domain Layer (Handler + Aggregate) enforced Business Rules
   *
   * @param props - Command Properties
   * @param props.id - UUID des zu entsperrenden Users
   * @param props.unlockedBy - UUID des Users der die Entsperrung durchführt
   * @returns Result<UnlockUserCommand> - Success mit Command oder Failure mit Error Message
   */
  static create(props: { id: string; unlockedBy: string }): Result<UnlockUserCommand> {
    // Validate required fields
    if (!props.id?.trim()) {
      return Result.fail<UnlockUserCommand>('User ID is required');
    }

    if (!props.unlockedBy?.trim()) {
      return Result.fail<UnlockUserCommand>('UnlockedBy ID is required');
    }

    // Create command
    return Result.ok<UnlockUserCommand>(new UnlockUserCommand(props.id.trim(), props.unlockedBy.trim()));
  }
}
