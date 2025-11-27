import { Result } from '@domain/common/result';

/**
 * Command zum Ausloggen eines Users.
 *
 * Dieser Command enthält den JWT Token der invalidiert werden soll:
 * - token: JWT Token String aus Authorization Header
 *
 * **MVP: No-Op (Stateless JWT)**
 * - Stateless JWTs können NICHT serverseitig revoked werden
 * - Token bleibt gültig bis Expiration (24h)
 * - Client MUSS Token aus localStorage/sessionStorage löschen
 * - Security Risk: Token kann gestohlen und wiederverwendet werden (bis Expiration)
 *
 * **Future: Redis Token Blacklist**
 * - Token wird in Redis Blacklist gespeichert (Key: Token Hash, TTL: remaining lifetime)
 * - validateToken() prüft Blacklist vor Claims-Extraktion
 * - Ermöglicht echtes Logout (Token wird ungültig gemacht)
 * - Trade-off: Performance vs Security (Redis Query bei jedem Request)
 *
 * **Warum Token als Required Parameter:**
 * - Command muss wissen welcher Token revoked werden soll
 * - Ermöglicht spätere Redis Blacklist Implementation
 * - Explizites Token Handling (kein impliziter State)
 *
 * @example
 * ```typescript
 * // Logout (MVP: No-Op, Future: Redis Blacklist)
 * const token = "eyJhbGc..."; // JWT Token aus Authorization Header
 * const commandResult = LogoutCommand.create(token);
 * if (commandResult.isSuccess) {
 *   await commandBus.execute(commandResult.value);
 *   // Client MUSS Token aus localStorage löschen!
 * }
 * ```
 */
export class LogoutCommand {
  /**
   * Privater Konstruktor - erzwingt Verwendung der Factory-Methode.
   *
   * @param token - JWT Token String der invalidiert werden soll
   */
  private constructor(public readonly token: string) {}

  /**
   * Factory-Methode für LogoutCommand mit Validierung.
   *
   * Validiert dass Token nicht leer ist (required für Logout).
   *
   * **Warum Token required:**
   * - Command muss wissen welcher Token revoked werden soll
   * - Ermöglicht spätere Redis Blacklist Implementation
   * - Empty Token führt zu Failure Result
   *
   * @param token - Optional: JWT Token String (undefined wird als Fehler behandelt)
   * @returns Result mit validiertem Command oder Fehlermeldung
   */
  public static create(token?: string): Result<LogoutCommand> {
    // Validation: token required
    if (!token || token.trim().length === 0) {
      return Result.fail('Token ist erforderlich');
    }

    return Result.ok(new LogoutCommand(token));
  }
}
