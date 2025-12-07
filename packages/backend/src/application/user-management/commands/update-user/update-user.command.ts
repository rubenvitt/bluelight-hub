import { Result } from '@domain/common/result';

/**
 * Erlaubte UserRole-Werte als String-Literal-Union.
 *
 * Entspricht dem Prisma UserRole enum, aber ohne direkten Prisma-Import
 * um die Clean Architecture Grenzen einzuhalten.
 */
export type UserRoleValue = 'SUPER_ADMIN' | 'ADMIN' | 'USER';

/**
 * Command zum Aktualisieren eines bestehenden Users.
 *
 * Unterstützt partielle Updates (nur geänderte Felder werden übermittelt).
 * Verwendet Result Pattern für konsistente Fehlerbehandlung im CQRS-Flow.
 *
 * **Business Rules:**
 * - User muss existieren (nicht gelöscht, nicht gesperrt)
 * - Username muss unique sein (falls geändert)
 * - Letzter SUPER_ADMIN darf nicht herabgestuft werden
 *
 * **Warum Command Pattern:**
 * - Entkoppelt Controller von Domain-Logic
 * - Ermöglicht spätere Event-Sourcing-Migration ohne Controller-Änderungen
 * - Validierung bei Command-Erstellung (Fail-Fast-Prinzip)
 */
export class UpdateUserCommand {
  /**
   * Privater Konstruktor - erzwingt Verwendung der Factory-Methode.
   *
   * @param id - ID des zu aktualisierenden Users
   * @param username - Optionaler neuer Username
   * @param role - Optionale neue UserRole
   * @param updatedBy - ID des Admin-Users der die Änderung durchführt
   */
  private constructor(
    public readonly id: string,
    public readonly username: string | undefined,
    public readonly role: UserRoleValue | undefined,
    public readonly updatedBy: string,
  ) {}

  /**
   * Factory-Methode für UpdateUserCommand mit Validierung.
   *
   * **Warum Result<T>-Pattern:**
   * - Konsistente Fehlerbehandlung im gesamten CQRS-Flow
   * - Validierung bei Command-Erstellung verhindert ungültige Commands (Fail-Fast)
   * - Type-Safe Error Handling ohne Exceptions
   *
   * @param id - ID des zu aktualisierenden Users (required)
   * @param updatedBy - ID des Admin-Users der die Änderung durchführt (required)
   * @param username - Optionaler neuer Username
   * @param role - Optionale neue UserRole
   * @returns Result mit validiertem Command oder Fehlermeldung
   */
  public static create(id: string, updatedBy: string, username?: string, role?: UserRoleValue): Result<UpdateUserCommand> {
    // Validation: id required
    if (!id || id.trim().length === 0) {
      return Result.fail('id is required');
    }

    // Validation: updatedBy required
    if (!updatedBy || updatedBy.trim().length === 0) {
      return Result.fail('updatedBy is required');
    }

    // Validation: mindestens ein Feld muss gesetzt sein
    if (!username && !role) {
      return Result.fail('At least one field (username or role) must be provided');
    }

    // Validation: username format (falls gesetzt)
    if (username !== undefined) {
      const trimmedUsername = username.trim();
      if (trimmedUsername.length === 0) {
        return Result.fail('username cannot be empty');
      }
      if (trimmedUsername.length < 3) {
        return Result.fail('username must be at least 3 characters');
      }
      if (trimmedUsername.length > 50) {
        return Result.fail('username must be at most 50 characters');
      }
      // Username pattern validation (alphanumeric + underscore + dot)
      if (!/^[a-zA-Z0-9._]+$/.test(trimmedUsername)) {
        return Result.fail('username can only contain letters, numbers, underscores and dots');
      }
    }

    return Result.ok(new UpdateUserCommand(id, username, role, updatedBy));
  }
}
