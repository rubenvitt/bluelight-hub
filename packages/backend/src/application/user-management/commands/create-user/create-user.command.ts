import { validateRequiredStringResult } from '@application/common/validators/string-validator';
import { Result } from '@domain/common/result';
import type { UserRole } from '@domain/value-objects/user-role';

/**
 * Command zum Erstellen eines neuen Users.
 *
 * Kapselt alle erforderlichen und optionalen Daten für die User-Erstellung:
 * - username: Pflichtfeld (3-50 Zeichen, alphanumerisch + underscore)
 * - role: Optional - UserRole (default: USER in Handler)
 * - createdBy: User-ID des Erstellers (für Audit-Trail)
 *
 * **Business Rules:**
 * - Username muss unique sein (wird in Handler geprüft)
 * - Bei gleichem Username eines gelöschten Users: Reaktivierung
 * - Erster User im System wird automatisch SUPER_ADMIN
 *
 * @example
 * ```typescript
 * const result = CreateUserCommand.create(
 *   'ruben_admin',
 *   'clx_user_abc123',
 *   UserRole.ADMIN()
 * );
 * if (result.isSuccess) {
 *   await handler.execute(result.value);
 * }
 * ```
 */
export class CreateUserCommand {
  private constructor(
    public readonly username: string,
    public readonly createdBy: string,
    public readonly role?: UserRole,
  ) {}

  /**
   * Factory-Methode mit Validierung.
   * Verwendet Result<T> Pattern für explizite Fehlerbehandlung.
   *
   * @param username - Username String (wird zu lowercase normalisiert in Handler)
   * @param createdBy - User-ID des Erstellers (für Audit Trail)
   * @param role - Optional UserRole (default: USER in Handler)
   * @returns Result<CreateUserCommand> - Success oder Failure mit Error Message
   */
  public static create(username: string, createdBy: string, role?: UserRole): Result<CreateUserCommand> {
    // Business Rule: username ist Pflichtfeld
    const usernameError = validateRequiredStringResult(username, 'Username');
    if (usernameError) return Result.fail(usernameError);

    // createdBy ist required für Audit Trail
    const createdByError = validateRequiredStringResult(createdBy, 'createdBy');
    if (createdByError) return Result.fail(createdByError);

    return Result.ok(new CreateUserCommand(username.trim(), createdBy.trim(), role));
  }
}
