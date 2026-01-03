/**
 * OAuth2StateCleanupTask - Bereinigt abgelaufene OAuth2-States aus der Datenbank.
 *
 * States haben eine Lebensdauer von 10 Minuten. Dieser Task raeumt
 * alle States auf, die abgelaufen sind. Da die Repository-Methode
 * `deleteExpired()` bereits auf `expiresAt < NOW()` prueft, ist kein
 * zusaetzlicher Puffer notwendig.
 *
 * **Warum separater Cron-Job:**
 * - States von abgebrochenen OAuth Flows werden nur beim Callback-Versuch geloescht
 * - Ohne Cleanup wuerden verwaiste States unbegrenzt in der DB bleiben
 * - Regelmaessige Bereinigung haelt die Tabelle klein und performant
 *
 * @module infrastructure/integrations/tasks
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { INTEGRATIONS } from '@/infrastructure/di-tokens';
import type { IOAuth2StateRepository } from '@domain/integrations/repositories/i-oauth2-state.repository';

/**
 * Scheduled Task fuer OAuth2 State Cleanup.
 *
 * Laeuft stuendlich und entfernt alle abgelaufenen OAuth2 States.
 * Fehler werden geloggt aber nicht geworfen (Task soll nicht crashen).
 */
@Injectable()
export class OAuth2StateCleanupTask {
  private readonly logger = new Logger(OAuth2StateCleanupTask.name);

  constructor(
    @Inject(INTEGRATIONS.OAUTH2_STATE_REPOSITORY)
    private readonly stateRepository: IOAuth2StateRepository,
  ) {}

  /**
   * Laeuft jede Stunde um abgelaufene States zu entfernen.
   *
   * Warum stuendlich statt oefter?
   * - States leben nur 10 Minuten, aber Cleanup ist nicht zeitkritisch
   * - Niedrige Frequenz minimiert DB-Last
   * - Selbst bei hohem OAuth-Traffic reicht stuendlicher Cleanup
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredStates(): Promise<void> {
    this.logger.log('Starting OAuth2 state cleanup...');

    try {
      const result = await this.stateRepository.deleteExpired();

      if (result.isFailure) {
        this.logger.error('Failed to cleanup expired OAuth2 states', {
          error: result.error,
        });
        return;
      }

      const deletedCount = result.value ?? 0;

      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} expired OAuth2 state(s)`);
      } else {
        this.logger.debug('No expired OAuth2 states to cleanup');
      }
    } catch (error) {
      // Fehler loggen aber nicht werfen - Task soll nicht crashen
      this.logger.error('Unexpected error during OAuth2 state cleanup', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }
}
