/**
 * OAuth2Adapter - Implementierung des IOAuth2Port.
 *
 * Unterstützt OAuth2 Authorization Code Flow mit PKCE (RFC 7636).
 * PKCE (Proof Key for Code Exchange) schützt vor Authorization Code
 * Interception Attacks, insbesondere bei öffentlichen Clients.
 *
 * **Sicherheitsaspekte:**
 * - Code Verifier: Kryptografisch sichere Zufallszeichenkette (43-128 Zeichen)
 * - Code Challenge: SHA-256 Hash des Code Verifiers (Base64URL-codiert)
 * - State: CSRF-Schutz durch kryptografisch sichere Zufallszeichenkette
 *
 * @module infrastructure/integrations
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Result } from '@domain/common/result';
import type { IOAuth2Port, OAuth2TokenResponse, OAuth2AuthorizationUrlResponse } from '@domain/ports/i-oauth2.port';
import { IntegrationError, INTEGRATION_ERROR_CODES } from '@domain/integrations';

/**
 * OAuth2 Adapter für Authorization Code Flow mit PKCE.
 *
 * Implementiert den IOAuth2Port gemäß Clean Architecture Prinzipien.
 * Verwendet standardkonforme HTTP-Requests nach RFC 6749 (OAuth 2.0)
 * und RFC 7636 (PKCE).
 */
@Injectable()
export class OAuth2Adapter implements IOAuth2Port {
  private readonly logger = new Logger(OAuth2Adapter.name);

  /**
   * Generiert Authorization URL mit PKCE Code Challenge.
   *
   * Erstellt eine vollständige Authorization URL mit allen erforderlichen
   * Parametern für den Authorization Code Flow mit PKCE. Der State und
   * Code Verifier müssen serverseitig gespeichert werden, um beim Callback
   * validiert bzw. beim Token Exchange verwendet werden zu können.
   *
   * @param options - Konfiguration für die Authorization URL
   * @returns Authorization URL Response mit State und Code Verifier
   */
  generateAuthorizationUrl(options: { authorizationUrl: string; clientId: string; redirectUri: string; scopes: string[] }): OAuth2AuthorizationUrlResponse {
    // State generieren (32 bytes = 64 hex chars) für CSRF-Schutz
    const state = randomBytes(32).toString('hex');

    // PKCE Code Verifier generieren (43-128 chars, Base64URL-codiert)
    const codeVerifier = this.generateCodeVerifier();

    // PKCE Code Challenge erstellen (SHA-256 Hash des Verifiers, Base64URL)
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    // Authorization URL zusammenbauen
    const url = new URL(options.authorizationUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', options.clientId);
    url.searchParams.set('redirect_uri', options.redirectUri);
    url.searchParams.set('scope', options.scopes.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    this.logger.debug(`Authorization URL generiert für Client: ${options.clientId}`);

    return {
      authorizationUrl: url.toString(),
      state,
      codeVerifier,
    };
  }

  /**
   * Tauscht Authorization Code gegen Access + Refresh Token.
   *
   * Nach erfolgreicher User-Authentifizierung beim Authorization Server
   * wird der Authorization Code gegen Tokens eingetauscht. Der Code Verifier
   * beweist, dass derselbe Client den Flow initiiert hat (PKCE).
   *
   * @param options - Parameter für den Token Exchange
   * @returns Result mit Token Response oder Fehlercode
   */
  async exchangeCodeForTokens(options: { code: string; codeVerifier: string; redirectUri: string; clientId: string; clientSecret: string; tokenUrl: string }): Promise<Result<OAuth2TokenResponse>> {
    try {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: options.code,
        redirect_uri: options.redirectUri,
        client_id: options.clientId,
        client_secret: options.clientSecret,
        code_verifier: options.codeVerifier,
      });

      this.logger.debug(`Token Exchange für Client: ${options.clientId}`);

      const response = await fetch(options.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Token Exchange fehlgeschlagen: ${response.status} - ${errorBody}`);
        return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.OAUTH_CODE_EXCHANGE_FAILED, `Token Exchange fehlgeschlagen: HTTP ${response.status}`));
      }

      const data = await response.json();

      this.logger.log(`Token Exchange erfolgreich für Client: ${options.clientId}`);

      return Result.ok({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope,
      });
    } catch (error) {
      this.logger.error('Token Exchange Fehler', error);
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.OAUTH_CODE_EXCHANGE_FAILED, error instanceof Error ? error.message : 'Token Exchange fehlgeschlagen'));
    }
  }

  /**
   * Refresht Access Token mittels Refresh Token.
   *
   * Wenn ein Access Token abgelaufen ist, kann mit dem Refresh Token
   * ein neuer Access Token angefordert werden. Nicht alle OAuth2 Provider
   * geben einen neuen Refresh Token zurück - in diesem Fall sollte der
   * alte Refresh Token weiter verwendet werden.
   *
   * @param options - Parameter für den Token Refresh
   * @returns Result mit Token Response oder Fehlercode
   */
  async refreshAccessToken(options: { refreshToken: string; clientId: string; clientSecret: string; tokenUrl: string }): Promise<Result<OAuth2TokenResponse>> {
    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: options.refreshToken,
        client_id: options.clientId,
        client_secret: options.clientSecret,
      });

      this.logger.debug(`Token Refresh für Client: ${options.clientId}`);

      const response = await fetch(options.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(`Token Refresh fehlgeschlagen: ${response.status} - ${errorBody}`);
        return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.OAUTH_TOKEN_REFRESH_FAILED, `Token Refresh fehlgeschlagen: HTTP ${response.status}`));
      }

      const data = await response.json();

      this.logger.log(`Token Refresh erfolgreich für Client: ${options.clientId}`);

      return Result.ok({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope,
      });
    } catch (error) {
      this.logger.error('Token Refresh Fehler', error);
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.OAUTH_TOKEN_REFRESH_FAILED, error instanceof Error ? error.message : 'Token Refresh fehlgeschlagen'));
    }
  }

  /**
   * Generiert PKCE Code Verifier.
   *
   * Der Code Verifier ist eine kryptografisch sichere Zufallszeichenkette
   * mit 43-128 Zeichen (Base64URL-codiert). Er wird bei generateAuthorizationUrl()
   * generiert und muss bis zum Token Exchange sicher gespeichert werden.
   *
   * @returns Base64URL-codierter Code Verifier (43 Zeichen bei 32 bytes)
   */
  private generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Generiert PKCE Code Challenge aus Code Verifier.
   *
   * Die Code Challenge ist der SHA-256 Hash des Code Verifiers,
   * Base64URL-codiert (S256 Methode gemäß RFC 7636).
   *
   * @param verifier - Der Code Verifier
   * @returns Base64URL-codierte Code Challenge
   */
  private generateCodeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
  }
}
