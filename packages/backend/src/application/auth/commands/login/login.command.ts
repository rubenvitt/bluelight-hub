import { Result } from '@domain/common/result';

/**
 * Command zum Einloggen eines Users.
 *
 * Dieser Command enthält die Credentials für Login-Validierung:
 * - username: Username des Users (wird zu lowercase normalisiert)
 * - password: Optional für PASSWORDLESS Auth (USER role ohne Passwort)
 *
 * **PASSWORDLESS Auth für USER Role:**
 * - USER-Accounts können OHNE Passwort einloggen (nur Username)
 * - ADMIN/SUPER_ADMIN-Accounts erfordern IMMER Passwort
 * - Validierung erfolgt im Handler basierend auf UserRole
 *
 * **Username Normalisierung:**
 * - Username wird automatisch zu lowercase normalisiert
 * - Verhindert case-sensitive Login-Probleme (Ruben vs ruben)
 * - Konsistent mit Username Value Object Validierung
 *
 * @example
 * ```typescript
 * // ADMIN Login (Passwort erforderlich)
 * const adminCommand = LoginCommand.create('admin', 'secure_password');
 * if (adminCommand.isSuccess) {
 *   const token = await commandBus.execute(adminCommand.value);
 * }
 *
 * // USER Login (Passwortlos)
 * const userCommand = LoginCommand.create('ruben_user');
 * if (userCommand.isSuccess) {
 *   const token = await commandBus.execute(userCommand.value);
 * }
 * ```
 */
export class LoginCommand {
  /**
   * Privater Konstruktor - erzwingt Verwendung der Factory-Methode.
   *
   * @param username - Username des Users (lowercase normalisiert)
   * @param password - Optional: Passwort für ADMIN/SUPER_ADMIN Accounts
   */
  private constructor(
    public readonly username: string,
    public readonly password?: string,
  ) {}

  /**
   * Factory-Methode für LoginCommand mit Validierung.
   *
   * Validiert dass Username nicht leer ist und normalisiert zu lowercase.
   * Password ist optional (für PASSWORDLESS Auth bei USER Role).
   *
   * **Warum Username required:**
   * - Jeder Login benötigt Identifier (Username)
   * - Empty Username führt zu Failure Result
   *
   * **Warum Password optional:**
   * - USER Role nutzt PASSWORDLESS Auth (nur Username)
   * - ADMIN/SUPER_ADMIN Role validiert Passwort im Handler
   * - Ermöglicht flexible Authentication Strategies
   *
   * @param username - Username des Users (wird zu lowercase normalisiert)
   * @param password - Optional: Passwort für ADMIN/SUPER_ADMIN Accounts
   * @returns Result mit validiertem Command oder Fehlermeldung
   */
  public static create(username: string, password?: string): Result<LoginCommand> {
    // Validation: username required
    if (!username || username.trim().length === 0) {
      return Result.fail('Username ist erforderlich');
    }

    // Normalisierung: lowercase für case-insensitive matching
    const normalizedUsername = username.toLowerCase();

    return Result.ok(new LoginCommand(normalizedUsername, password));
  }
}
