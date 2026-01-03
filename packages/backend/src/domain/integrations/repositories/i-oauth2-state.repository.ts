/**
 * IOAuth2StateRepository - Repository Interface für OAuth2 State Verwaltung.
 *
 * Port-Interface für die Persistenz von OAuth2State Entities.
 * Wird im Infrastructure Layer mit Prisma implementiert.
 *
 * **Lifecycle:**
 * 1. `save()` - State bei OAuth Flow Start speichern
 * 2. `findByState()` - State bei Callback validieren
 * 3. `deleteByState()` - State nach Token-Exchange löschen
 * 4. `deleteExpired()` - Cleanup-Job für abgelaufene States
 *
 * @module domain/integrations/repositories
 */

import type { Result } from '@domain/common/result';
import type { OAuth2State } from '../entities/oauth2-state.entity';

/**
 * Repository Interface für OAuth2State Entities.
 *
 * **Verwendung im Application Layer:**
 * ```typescript
 * constructor(
 *   @Inject(DI_TOKENS.INTEGRATIONS.OAUTH2_STATE_REPOSITORY)
 *   private readonly oauth2StateRepo: IOAuth2StateRepository,
 * ) {}
 * ```
 */
export interface IOAuth2StateRepository {
  /**
   * Speichert einen neuen OAuth2State.
   *
   * Generiert automatisch eine ID falls nicht vorhanden.
   *
   * @param state - Die zu speichernde OAuth2State Entity
   * @returns Result mit gespeicherter Entity (inkl. generierter ID)
   */
  save(state: OAuth2State): Promise<Result<OAuth2State>>;

  /**
   * Findet OAuth2State anhand des State-Tokens.
   *
   * Wird beim OAuth Callback verwendet um den zugehörigen
   * Code Verifier für den Token-Exchange zu finden.
   *
   * **Wichtig:** Auch abgelaufene States werden zurückgegeben.
   * Der Aufrufer muss `isExpired()` prüfen!
   *
   * @param state - Das State-Token aus dem OAuth Callback
   * @returns Result mit Entity oder undefined wenn nicht gefunden
   */
  findByState(state: string): Promise<Result<OAuth2State | undefined>>;

  /**
   * Löscht OAuth2State anhand des State-Tokens.
   *
   * Sollte nach erfolgreichem Token-Exchange aufgerufen werden
   * um den State zu invalidieren (One-Time-Use).
   *
   * @param state - Das State-Token zum Löschen
   * @returns Result<void> bei Erfolg
   */
  deleteByState(state: string): Promise<Result<void>>;

  /**
   * Löscht alle abgelaufenen OAuth2States.
   *
   * Sollte regelmäßig durch einen Cleanup-Job aufgerufen werden
   * um die Datenbank sauber zu halten.
   *
   * @returns Result mit Anzahl der gelöschten States
   */
  deleteExpired(): Promise<Result<number>>;
}
