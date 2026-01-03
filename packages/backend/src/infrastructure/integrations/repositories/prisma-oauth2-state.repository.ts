/**
 * PrismaOAuth2StateRepository - Prisma Implementation von IOAuth2StateRepository.
 *
 * Verwaltet temporäre OAuth2 States für CSRF-Schutz und PKCE-Flow.
 * States sind kurzlebig (max. 10 Minuten) und werden nach Callback gelöscht.
 *
 * **Sicherheit:**
 * - State-Token schützt vor CSRF-Angriffen
 * - Code Verifier ist Teil des PKCE-Flows (RFC 7636)
 * - Automatische Ablaufzeit verhindert Replay-Attacken
 *
 * @module infrastructure/integrations/repositories
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { Result } from '@domain/common/result';
import { OAuth2State, INTEGRATION_ERROR_CODES, IntegrationError } from '@domain/integrations';
import type { IOAuth2StateRepository } from '@domain/integrations/repositories/i-oauth2-state.repository';
import type { OAuth2State as PrismaOAuth2State } from '@prisma/client';

/**
 * Prisma-basiertes Repository für OAuth2State.
 *
 * **Lifecycle:**
 * 1. `save()` - State bei OAuth Flow Start speichern
 * 2. `findByState()` - State bei Callback validieren
 * 3. `deleteByState()` - State nach Token-Exchange löschen
 * 4. `deleteExpired()` - Cleanup-Job für abgelaufene States
 */
@Injectable()
export class PrismaOAuth2StateRepository implements IOAuth2StateRepository {
  private readonly logger = new Logger(PrismaOAuth2StateRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Speichert einen neuen OAuth2State.
   *
   * Generiert automatisch eine CUID als ID.
   *
   * @param state - Die zu speichernde OAuth2State Entity
   * @returns Result mit gespeicherter Entity (inkl. generierter ID)
   */
  async save(state: OAuth2State): Promise<Result<OAuth2State>> {
    try {
      const created = await this.prisma.oAuth2State.create({
        data: {
          state: state.state,
          codeVerifier: state.codeVerifier,
          integrationType: state.integrationType,
          redirectUri: state.redirectUri,
          createdBy: state.createdBy,
          expiresAt: state.expiresAt,
        },
      });

      this.logger.debug(`Saved OAuth2State for integration ${state.integrationType} (expires: ${state.expiresAt.toISOString()})`);

      return Result.ok(this.toDomain(created));
    } catch (error) {
      this.logger.error('Failed to save OAuth2State', error);
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.STATE_SAVE_FAILED, 'OAuth2State konnte nicht gespeichert werden'));
    }
  }

  /**
   * Findet OAuth2State anhand des State-Tokens.
   *
   * Wird beim OAuth Callback verwendet um den zugehörigen
   * Code Verifier für den Token-Exchange zu finden.
   *
   * **Wichtig:** Auch abgelaufene States werden zurückgegeben.
   * Der Aufrufer muss `isExpired()` prüfen!
   *
   * @param stateToken - Das State-Token aus dem OAuth Callback
   * @returns Result mit Entity oder undefined wenn nicht gefunden
   */
  async findByState(stateToken: string): Promise<Result<OAuth2State | undefined>> {
    try {
      const found = await this.prisma.oAuth2State.findUnique({
        where: { state: stateToken },
      });

      if (!found) {
        this.logger.debug(`OAuth2State not found for token: ${stateToken.substring(0, 8)}...`);
        return Result.ok(undefined);
      }

      return Result.ok(this.toDomain(found));
    } catch (error) {
      this.logger.error('Failed to find OAuth2State', error);
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.STATE_NOT_FOUND, 'OAuth2State konnte nicht geladen werden'));
    }
  }

  /**
   * Löscht OAuth2State anhand des State-Tokens.
   *
   * Sollte nach erfolgreichem Token-Exchange aufgerufen werden
   * um den State zu invalidieren (One-Time-Use).
   *
   * @param stateToken - Das State-Token zum Löschen
   * @returns Result<void> bei Erfolg
   */
  async deleteByState(stateToken: string): Promise<Result<void>> {
    try {
      await this.prisma.oAuth2State.delete({
        where: { state: stateToken },
      });

      this.logger.debug(`Deleted OAuth2State for token: ${stateToken.substring(0, 8)}...`);
      return Result.ok(undefined);
    } catch (error) {
      // P2025: Record to delete does not exist - ignorieren (bereits gelöscht)
      if ((error as { code?: string }).code === 'P2025') {
        this.logger.debug(`OAuth2State already deleted for token: ${stateToken.substring(0, 8)}...`);
        return Result.ok(undefined);
      }

      this.logger.error('Failed to delete OAuth2State', error);
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.STATE_DELETE_FAILED, 'OAuth2State konnte nicht gelöscht werden'));
    }
  }

  /**
   * Löscht alle abgelaufenen OAuth2States.
   *
   * Sollte regelmäßig durch einen Cleanup-Job aufgerufen werden
   * um die Datenbank sauber zu halten.
   *
   * @returns Result mit Anzahl der gelöschten States
   */
  async deleteExpired(): Promise<Result<number>> {
    try {
      const result = await this.prisma.oAuth2State.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      if (result.count > 0) {
        this.logger.log(`Deleted ${result.count} expired OAuth2State(s)`);
      }

      return Result.ok(result.count);
    } catch (error) {
      this.logger.error('Failed to delete expired OAuth2States', error);
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.STATE_DELETE_FAILED, 'Abgelaufene OAuth2States konnten nicht gelöscht werden'));
    }
  }

  /**
   * Mappt Prisma Record auf Domain Entity.
   *
   * @param record - Prisma OAuth2State Record
   * @returns Domain OAuth2State Entity
   */
  private toDomain(record: PrismaOAuth2State): OAuth2State {
    return OAuth2State.fromPersistence({
      id: record.id,
      state: record.state,
      codeVerifier: record.codeVerifier,
      integrationType: record.integrationType,
      redirectUri: record.redirectUri,
      createdBy: record.createdBy,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
    });
  }
}
