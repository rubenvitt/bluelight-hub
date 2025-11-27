import { Result } from '@domain/common/result';
import type { IJwtAuthServicePort } from '@domain/ports/i-jwt-auth-service.port';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { JWT_AUTH_SERVICE } from '@infrastructure/di-tokens';
import type { LogoutCommand } from './logout.command';

/**
 * Handler für LogoutCommand.
 *
 * Orchestriert das Logout durch Token-Invalidation:
 * 1. Token Revocation via IJwtAuthServicePort
 * 2. MVP: No-Op (stateless JWT bleibt gültig bis Expiration)
 * 3. Future: Redis Blacklist (Token wird ungültig gemacht)
 *
 * **MVP Implementation: No-Op (Stateless JWT)**
 * - Stateless JWTs können NICHT serverseitig revoked werden
 * - Token bleibt gültig bis Expiration (24h)
 * - Client MUSS Token aus localStorage/sessionStorage löschen
 * - Security Risk: Token kann gestohlen und wiederverwendet werden (bis Expiration)
 *
 * **Future Implementation: Redis Token Blacklist**
 * - Token wird in Redis Blacklist gespeichert (Key: Token Hash, TTL: remaining lifetime)
 * - validateToken() prüft Blacklist vor Claims-Extraktion
 * - Ermöglicht echtes Logout (Token wird ungültig gemacht)
 * - Trade-off: Performance vs Security (Redis Query bei jedem Request)
 *
 * **Client-Side Logout:**
 * ```typescript
 * // Frontend (after calling logout endpoint)
 * localStorage.removeItem('jwt_token');
 * // Token ist noch 24h gültig, aber Client hat ihn vergessen
 * ```
 *
 * @example
 * ```typescript
 * // Logout (MVP: No-Op)
 * const command = LogoutCommand.create('eyJhbGc...').value!;
 * const result = await handler.execute(command);
 * if (result.isSuccess) {
 *   console.log('Logout successful (Client muss Token löschen!)');
 * }
 * ```
 */
@Injectable()
export class LogoutHandler {
  private readonly logger = new Logger(LogoutHandler.name);

  constructor(
    @Inject(JWT_AUTH_SERVICE)
    private readonly jwtService: IJwtAuthServicePort,
  ) {}

  /**
   * Invalidiert den übergebenen JWT-Token.
   *
   * **MVP: No-Op (stateless JWT), Future: Redis Blacklist**
   *
   * Im MVP ist dies ein No-Op, da stateless JWTs nicht serverseitig
   * revoked werden können. Der Client MUSS den Token clientseitig löschen.
   *
   * In einer zukünftigen Implementation wird der Token in eine Redis Blacklist
   * geschrieben, damit validateToken() den Token als ungültig markieren kann.
   *
   * @param command - LogoutCommand mit Token
   * @returns Result<void> - Success (immer) oder Failure bei Fehler
   */
  async execute(command: LogoutCommand): Promise<Result<void>> {
    try {
      // Delegate to JWT Service (MVP: No-Op, Future: Redis Blacklist)
      await this.jwtService.revokeToken(command.token);

      this.logger.log('Logout successful (MVP: Token bleibt gültig bis Expiration)', {
        // Log token hash (NICHT raw token) für Audit Trail
        tokenHash: command.token.substring(0, 20),
      });

      return Result.ok<void>(undefined);
    } catch (error) {
      this.logger.error('Logout failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return Result.fail<void>(`Logout fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
