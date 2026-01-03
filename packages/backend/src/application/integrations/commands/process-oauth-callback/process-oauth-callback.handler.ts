/**
 * ProcessOAuthCallbackHandler - Verarbeitet OAuth2 Callback nach User-Authentifizierung.
 *
 * Validiert den State (CSRF-Schutz), tauscht den Authorization Code gegen Tokens
 * und speichert die verschlüsselten Tokens in IntegrationCredential.
 *
 * **Ablauf:**
 * 1. State aus Datenbank laden und validieren
 * 2. Prüfen ob State abgelaufen ist
 * 3. Authorization Code gegen Tokens tauschen (via IOAuth2Port)
 * 4. State löschen (One-Time-Use)
 * 5. Tokens verschlüsseln (via IEncryptionPort)
 * 6. IntegrationCredential erstellen/aktualisieren
 *
 * @module application/integrations/commands/process-oauth-callback
 */

import { Inject, Injectable } from '@nestjs/common';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { IHiOrgOAuthConfigPort } from '@domain/ports/i-hiorg-oauth-config.port';
import { LOGGER, INTEGRATIONS } from '@/infrastructure/di-tokens';
import { Result } from '@domain/common/result';
import { type IOAuth2StateRepository, type IIntegrationCredentialRepository, INTEGRATION_ERROR_CODES, IntegrationError, INTEGRATION_TYPES, IntegrationCredential } from '@domain/integrations';
import type { IOAuth2Port } from '@domain/ports/i-oauth2.port';
import type { IEncryptionPort } from '@domain/ports/i-encryption.port';
import { HIORG_OAUTH_CONFIG } from '@/infrastructure/config/hiorg-oauth.config';
import type { ProcessOAuthCallbackCommand } from './process-oauth-callback.command';

/**
 * Handler für ProcessOAuthCallbackCommand.
 *
 * **Sicherheit:**
 * - State wird nach Verwendung sofort gelöscht (One-Time-Use)
 * - Abgelaufene States werden abgelehnt
 * - Tokens werden mit AES-256-GCM verschlüsselt gespeichert
 */
@Injectable()
export class ProcessOAuthCallbackHandler {
  constructor(
    @Inject(LOGGER)
    private readonly logger: ILogger,
    @Inject(INTEGRATIONS.OAUTH2_PORT)
    private readonly oauth2: IOAuth2Port,
    @Inject(INTEGRATIONS.OAUTH2_STATE_REPOSITORY)
    private readonly stateRepository: IOAuth2StateRepository,
    @Inject(INTEGRATIONS.CREDENTIAL_REPOSITORY)
    private readonly credentialRepository: IIntegrationCredentialRepository,
    @Inject(INTEGRATIONS.ENCRYPTION_PORT)
    private readonly encryption: IEncryptionPort,
    @Inject(INTEGRATIONS.HIORG_OAUTH_CONFIG_PORT)
    private readonly oauthConfig: IHiOrgOAuthConfigPort,
  ) {}

  /**
   * Führt den Command aus und verarbeitet den OAuth2 Callback.
   *
   * @param command - Command mit Authorization Code und State
   * @returns Result<void> bei Erfolg, Fehler bei Validierungsproblemen
   */
  async execute(command: ProcessOAuthCallbackCommand): Promise<Result<void>> {
    // 1. Find state from database
    const stateResult = await this.stateRepository.findByState(command.state);
    if (stateResult.isFailure) {
      return Result.fail(stateResult.error ?? 'Fehler beim Laden des OAuth State');
    }

    const oauthState = stateResult.value;
    if (!oauthState) {
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.OAUTH_STATE_INVALID, 'Ungültiger OAuth State'));
    }

    // 2. Check if state is expired
    if (oauthState.isExpired()) {
      // Delete expired state
      await this.stateRepository.deleteByState(command.state);
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.OAUTH_STATE_INVALID, 'OAuth State ist abgelaufen'));
    }

    // 3. Get OAuth client credentials via Port
    const credentials = this.oauthConfig.getClientCredentials();

    if (!credentials) {
      // Delete state before returning error
      await this.stateRepository.deleteByState(command.state);
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.OAUTH_NOT_CONFIGURED, 'HIORG_OAUTH_CLIENT_ID oder HIORG_OAUTH_CLIENT_SECRET nicht konfiguriert'));
    }

    // 4. Exchange authorization code for tokens
    const tokenResult = await this.oauth2.exchangeCodeForTokens({
      code: command.code,
      codeVerifier: oauthState.codeVerifier,
      redirectUri: oauthState.redirectUri,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      tokenUrl: HIORG_OAUTH_CONFIG.tokenUrl,
    });

    // 5. Delete state after use (One-Time-Use, auch bei Token-Exchange-Fehler)
    await this.stateRepository.deleteByState(command.state);

    if (tokenResult.isFailure) {
      this.logger.warn(`OAuth2 token exchange failed: ${tokenResult.error}`);
      return Result.fail(tokenResult.error ?? 'Token Exchange fehlgeschlagen');
    }

    const tokens = tokenResult.value;
    if (!tokens) {
      return Result.fail('Keine Tokens erhalten');
    }

    // 6. Encrypt tokens before storage
    let encryptedAccessToken: string;
    let encryptedRefreshToken: string | undefined;

    try {
      encryptedAccessToken = this.encryption.encrypt(tokens.accessToken);
      if (tokens.refreshToken) {
        encryptedRefreshToken = this.encryption.encrypt(tokens.refreshToken);
      }
    } catch (error) {
      this.logger.error('Token encryption failed', error);
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.ENCRYPTION_FAILED, 'Token-Verschlüsselung fehlgeschlagen'));
    }

    // 7. Save/Update IntegrationCredential with OAuth2 tokens
    const accessTokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    // Check for existing credential
    const existingResult = await this.credentialRepository.findByType(INTEGRATION_TYPES.HIORG_SERVER);
    if (existingResult.isFailure) {
      return Result.fail(existingResult.error ?? 'Fehler beim Laden der bestehenden Credentials');
    }

    let credential: IntegrationCredential;

    if (existingResult.value) {
      // Update existing credential with new OAuth tokens
      credential = existingResult.value.updateOAuthTokens({
        encryptedAccessToken,
        encryptedRefreshToken,
        accessTokenExpiresAt,
        updatedBy: oauthState.createdBy,
      });
    } else {
      // Create new credential (OAuth flow without prior API token setup)
      // Note: orgKuerzel is not available via OAuth - might need to be fetched from API
      const createResult = IntegrationCredential.createFromOAuth({
        type: INTEGRATION_TYPES.HIORG_SERVER,
        encryptedAccessToken,
        encryptedRefreshToken,
        accessTokenExpiresAt,
        createdBy: oauthState.createdBy,
      });

      if (createResult.isFailure) {
        return Result.fail(createResult.error ?? 'Fehler beim Erstellen der Credentials');
      }

      const createdCredential = createResult.value;
      if (!createdCredential) {
        return Result.fail('Credentials konnten nicht erstellt werden');
      }
      credential = createdCredential;
    }

    // 8. Persist credential
    const saveResult = await this.credentialRepository.save(credential);
    if (saveResult.isFailure) {
      return Result.fail(saveResult.error ?? 'Fehler beim Speichern der Credentials');
    }

    this.logger.log(`OAuth2 tokens successfully saved for ${INTEGRATION_TYPES.HIORG_SERVER}`);
    return Result.ok(undefined);
  }
}
