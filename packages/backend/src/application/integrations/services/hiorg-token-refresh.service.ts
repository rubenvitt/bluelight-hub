/**
 * HiOrgTokenRefreshService - Automatischer Token-Refresh für HiOrg-Server OAuth2.
 *
 * Dieser Service kapselt die Logik für das automatische Refreshen von OAuth2 Tokens.
 * Er wird von allen Handlern verwendet, die auf die HiOrg-Server API zugreifen.
 *
 * **Ablauf:**
 * 1. Prüft ob Access Token abgelaufen ist
 * 2. Wenn abgelaufen und Refresh Token vorhanden: Token automatisch refreshen
 * 3. Neue Tokens verschlüsselt speichern
 * 4. Gültiges Access Token (entschlüsselt) zurückgeben
 *
 * **Fehlerbehandlung:**
 * - Kein Refresh Token vorhanden → User muss neu authentifizieren
 * - Refresh Token abgelaufen/ungültig → User muss neu authentifizieren
 * - Verschlüsselung fehlgeschlagen → Technischer Fehler
 *
 * @module application/integrations/services
 */

// biome-ignore lint/style/noRestrictedImports: Logger direkt nutzen für Infrastructure-nahen Service
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { IntegrationCredential, INTEGRATION_TYPES, INTEGRATION_ERROR_CODES, IntegrationError, type IIntegrationCredentialRepository } from '@domain/integrations';
import type { IEncryptionPort } from '@domain/ports/i-encryption.port';
import type { IOAuth2Port } from '@domain/ports/i-oauth2.port';
import type { IHiOrgOAuthConfigPort } from '@domain/ports/i-hiorg-oauth-config.port';
import { INTEGRATIONS } from '@/infrastructure/di-tokens';
import { HIORG_OAUTH_CONFIG } from '@/infrastructure/config/hiorg-oauth.config';

/**
 * Ergebnis des Token-Refresh-Service.
 */
export interface ValidTokenResult {
  /** Das entschlüsselte, gültige Access Token */
  accessToken: string;
  /** Die Credentials (ggf. mit aktualisierten Tokens) */
  credential: IntegrationCredential;
  /** Wurde das Token gerade refreshed? */
  wasRefreshed: boolean;
}

/**
 * Service für automatisches OAuth2 Token-Refresh.
 *
 * Dieser Service sollte von allen Handlern verwendet werden, die auf
 * die HiOrg-Server API zugreifen, anstatt manuell das Token zu prüfen.
 *
 * @example
 * ```typescript
 * const tokenResult = await this.tokenRefresh.getValidAccessToken();
 * if (tokenResult.isFailure) {
 *   return Result.fail(tokenResult.error!);
 * }
 * const { accessToken, credential, wasRefreshed } = tokenResult.value!;
 * // Jetzt mit accessToken API-Request durchführen
 * ```
 */
@Injectable()
export class HiOrgTokenRefreshService {
  private readonly logger = new Logger(HiOrgTokenRefreshService.name);

  constructor(
    @Inject(INTEGRATIONS.ENCRYPTION_PORT)
    private readonly encryption: IEncryptionPort,
    @Inject(INTEGRATIONS.CREDENTIAL_REPOSITORY)
    private readonly repository: IIntegrationCredentialRepository,
    @Inject(INTEGRATIONS.OAUTH2_PORT)
    private readonly oauth2: IOAuth2Port,
    @Inject(INTEGRATIONS.HIORG_OAUTH_CONFIG_PORT)
    private readonly oauthConfig: IHiOrgOAuthConfigPort,
  ) {}

  /**
   * Gibt ein gültiges Access Token zurück, ggf. nach automatischem Refresh.
   *
   * **Ablauf:**
   * 1. Credentials laden
   * 2. Prüfen ob OAuth2 Tokens vorhanden
   * 3. Wenn Access Token abgelaufen: Automatisch refreshen
   * 4. Gültiges Token (entschlüsselt) zurückgeben
   *
   * @returns Result mit ValidTokenResult bei Erfolg, Fehlercode bei Misserfolg
   */
  async getValidAccessToken(): Promise<Result<ValidTokenResult>> {
    // 1. Credentials laden
    const credentialResult = await this.repository.findByType(INTEGRATION_TYPES.HIORG_SERVER);
    if (credentialResult.isFailure) {
      // biome-ignore lint/style/noNonNullAssertion: Result Pattern - error existiert bei isFailure
      return Result.fail(credentialResult.error!);
    }

    const credential = credentialResult.value;
    if (!credential) {
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.CREDENTIALS_NOT_FOUND, 'Keine HiOrg-Server Credentials konfiguriert'));
    }

    // 2. OAuth2 Tokens prüfen
    if (!credential.hasOAuthTokens) {
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.CREDENTIALS_NOT_FOUND, 'Keine OAuth2-Verbindung vorhanden - bitte zuerst mit HiOrg-Server verbinden'));
    }

    // 3. Token-Refresh wenn abgelaufen
    let activeCredential = credential;
    let wasRefreshed = false;

    if (credential.isAccessTokenExpired) {
      this.logger.log('Access Token abgelaufen, versuche automatischen Refresh...');

      const refreshResult = await this.refreshToken(credential);
      if (refreshResult.isFailure) {
        // biome-ignore lint/style/noNonNullAssertion: Result Pattern - error existiert bei isFailure
        return Result.fail(refreshResult.error!);
      }

      // biome-ignore lint/style/noNonNullAssertion: Result Pattern - value existiert bei isSuccess
      activeCredential = refreshResult.value!;
      wasRefreshed = true;
      this.logger.log('Token erfolgreich refreshed');
    }

    // 4. Access Token entschlüsseln
    let accessToken: string;
    try {
      // biome-ignore lint/style/noNonNullAssertion: hasOAuthTokens wurde oben geprüft
      accessToken = this.encryption.decrypt(activeCredential.encryptedAccessToken!);
    } catch {
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.DECRYPTION_FAILED, 'OAuth2 Access-Token Entschlüsselung fehlgeschlagen'));
    }

    return Result.ok({
      accessToken,
      credential: activeCredential,
      wasRefreshed,
    });
  }

  /**
   * Führt Token-Refresh durch und speichert neue Tokens.
   *
   * @param credential - Aktuelle Credentials mit abgelaufenem Access Token
   * @returns Result mit aktualisierten Credentials
   */
  private async refreshToken(credential: IntegrationCredential): Promise<Result<IntegrationCredential>> {
    // Prüfen ob Refresh Token vorhanden
    if (!credential.hasRefreshToken) {
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.OAUTH_TOKEN_REFRESH_FAILED, 'Kein Refresh Token vorhanden - bitte erneut mit HiOrg-Server verbinden'));
    }

    // OAuth2 Config laden
    const clientCredentials = this.oauthConfig.getClientCredentials();
    if (!clientCredentials) {
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.OAUTH_NOT_CONFIGURED, 'OAuth2 Client Credentials nicht konfiguriert'));
    }

    // Refresh Token entschlüsseln
    let refreshToken: string;
    try {
      // biome-ignore lint/style/noNonNullAssertion: hasRefreshToken wurde oben geprüft
      refreshToken = this.encryption.decrypt(credential.encryptedRefreshToken!);
    } catch {
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.DECRYPTION_FAILED, 'Refresh Token Entschlüsselung fehlgeschlagen'));
    }

    // Token Refresh durchführen
    const refreshResult = await this.oauth2.refreshAccessToken({
      refreshToken,
      clientId: clientCredentials.clientId,
      clientSecret: clientCredentials.clientSecret,
      tokenUrl: HIORG_OAUTH_CONFIG.tokenUrl,
    });

    if (refreshResult.isFailure) {
      this.logger.warn(`Token Refresh fehlgeschlagen: ${refreshResult.error}`);
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.OAUTH_TOKEN_REFRESH_FAILED, 'Token Refresh fehlgeschlagen - bitte erneut mit HiOrg-Server verbinden'));
    }

    // biome-ignore lint/style/noNonNullAssertion: Result Pattern - value existiert bei isSuccess
    const tokens = refreshResult.value!;

    // Neue Tokens verschlüsseln
    const encryptedAccessToken = this.encryption.encrypt(tokens.accessToken);
    let encryptedRefreshToken: string | undefined;

    // Manche OAuth2 Provider geben einen neuen Refresh Token zurück, manche nicht
    if (tokens.refreshToken) {
      encryptedRefreshToken = this.encryption.encrypt(tokens.refreshToken);
    }

    // Ablaufzeit berechnen (expiresIn ist in Sekunden)
    const accessTokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    // Credentials aktualisieren
    const updatedCredential = credential.updateOAuthTokens({
      encryptedAccessToken,
      encryptedRefreshToken,
      accessTokenExpiresAt,
      updatedBy: 'system:token-refresh',
    });

    // Speichern
    const saveResult = await this.repository.save(updatedCredential);
    if (saveResult.isFailure) {
      // biome-ignore lint/style/noNonNullAssertion: Result Pattern - error existiert bei isFailure
      return Result.fail(saveResult.error!);
    }

    // biome-ignore lint/style/noNonNullAssertion: Result Pattern - value existiert bei isSuccess
    return Result.ok(saveResult.value!);
  }
}
