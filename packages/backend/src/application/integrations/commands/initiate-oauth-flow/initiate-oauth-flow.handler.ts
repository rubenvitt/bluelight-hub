/**
 * InitiateOAuthFlowHandler - Startet OAuth2 Authorization Code Flow mit PKCE.
 *
 * Generiert eine Authorization URL und speichert den State für CSRF-Schutz.
 * Der State enthält auch den PKCE Code Verifier für den späteren Token-Exchange.
 *
 * **Ablauf:**
 * 1. Integration Type validieren (nur unterstützte Typen)
 * 2. OAuth2 Config aus Environment laden
 * 3. Authorization URL mit PKCE generieren (via IOAuth2Port)
 * 4. State in Datenbank speichern (via IOAuth2StateRepository)
 * 5. Authorization URL zurückgeben (User wird dorthin redirected)
 *
 * @module application/integrations/commands/initiate-oauth-flow
 */

import { Inject, Injectable } from '@nestjs/common';
// biome-ignore lint/style/useImportType: ConfigService needed for DI at runtime
import { ConfigService } from '@nestjs/config';
import { Result } from '@domain/common/result';
import { OAuth2State, type IOAuth2StateRepository, INTEGRATION_TYPES, INTEGRATION_ERROR_CODES, IntegrationError } from '@domain/integrations';
import type { IOAuth2Port } from '@domain/ports/i-oauth2.port';
import { INTEGRATIONS } from '@/infrastructure/di-tokens';
import { HIORG_OAUTH_CONFIG } from '@/infrastructure/config/hiorg-oauth.config';
import type { InitiateOAuthFlowCommand } from './initiate-oauth-flow.command';

/**
 * Ergebnis des InitiateOAuthFlowHandler.
 */
export interface InitiateOAuthFlowResult {
  /** Vollständige Authorization URL für User-Redirect */
  authorizationUrl: string;
}

/**
 * Handler für InitiateOAuthFlowCommand.
 *
 * **Sicherheit:**
 * - State-Token schützt vor CSRF-Angriffen
 * - PKCE (Proof Key for Code Exchange) schützt vor Authorization Code Interception
 * - State wird in DB gespeichert und hat kurze Ablaufzeit (10 Minuten)
 */
@Injectable()
export class InitiateOAuthFlowHandler {
  constructor(
    @Inject(INTEGRATIONS.OAUTH2_PORT)
    private readonly oauth2: IOAuth2Port,
    @Inject(INTEGRATIONS.OAUTH2_STATE_REPOSITORY)
    private readonly stateRepository: IOAuth2StateRepository,
    private readonly config: ConfigService,
  ) {}

  /**
   * Führt den Command aus und generiert die Authorization URL.
   *
   * @param command - Command mit Integration Type und User ID
   * @returns Result mit Authorization URL bei Erfolg
   */
  async execute(command: InitiateOAuthFlowCommand): Promise<Result<InitiateOAuthFlowResult>> {
    // 1. Validate integration type (nur HIORG_SERVER unterstützt)
    if (command.integrationType !== INTEGRATION_TYPES.HIORG_SERVER) {
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.INVALID_INTEGRATION_TYPE, `Unbekannter Integration Type: ${command.integrationType}`));
    }

    // 2. Get OAuth config from environment
    const clientId = this.config.get<string>('HIORG_OAUTH_CLIENT_ID');
    if (!clientId) {
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.OAUTH_NOT_CONFIGURED, 'HIORG_OAUTH_CLIENT_ID ist nicht konfiguriert'));
    }

    // 3. Build redirect URI from APP_URL
    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3091');
    const redirectUri = `${appUrl}/api/oauth/hiorg/callback`;

    // 4. Generate Authorization URL with PKCE
    const { authorizationUrl, state, codeVerifier } = this.oauth2.generateAuthorizationUrl({
      authorizationUrl: HIORG_OAUTH_CONFIG.authorizationUrl,
      clientId,
      redirectUri,
      scopes: [...HIORG_OAUTH_CONFIG.scopes],
    });

    // 5. Create and save OAuth2State for CSRF protection
    const stateResult = OAuth2State.create({
      state,
      codeVerifier,
      integrationType: command.integrationType,
      redirectUri,
      createdBy: command.userId,
      expiresInMinutes: 10, // State ist nur 10 Minuten gültig
    });

    if (stateResult.isFailure) {
      return Result.fail(stateResult.error ?? 'Fehler beim Erstellen des OAuth State');
    }

    const oauthState = stateResult.value;
    if (!oauthState) {
      return Result.fail('OAuth State konnte nicht erstellt werden');
    }

    // 6. Persist state to database
    const saveResult = await this.stateRepository.save(oauthState);
    if (saveResult.isFailure) {
      return Result.fail(saveResult.error ?? 'Fehler beim Speichern des OAuth State');
    }

    return Result.ok({ authorizationUrl });
  }
}
