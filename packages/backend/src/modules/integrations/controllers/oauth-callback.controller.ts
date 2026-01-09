/**
 * OAuthCallbackController - Verarbeitet OAuth2 Callbacks.
 *
 * Dieser Controller ist NICHT mit AdminGuard geschuetzt, da er
 * vom OAuth2 Provider aufgerufen wird (Redirect nach User Consent).
 *
 * @module modules/integrations/controllers
 */

import { Controller, Get, Query, Res, Inject, VERSION_NEUTRAL, InternalServerErrorException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiExcludeEndpoint, ApiSecurity } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ProcessOAuthCallbackHandler } from '@application/integrations/commands/process-oauth-callback/process-oauth-callback.handler';
import { ProcessOAuthCallbackCommand } from '@application/integrations/commands/process-oauth-callback/process-oauth-callback.command';
import { IntegrationError, INTEGRATION_ERROR_CODES } from '@domain/integrations';
import { ILogger } from '@domain/ports/i-logger.port';
import { LOGGER } from '@infrastructure/di-tokens';
import { SkipServerAccess } from '@/infrastructure/decorators/skip-server-access.decorator';
import { SkipSetupCheck } from '@/infrastructure/decorators/skip-setup-check.decorator';
import { RateLimit, RateLimitPresets } from '@/modules/common/decorators/rate-limit.decorator';

/**
 * Controller fuer OAuth2 Callbacks.
 *
 * **Guard Execution Reihenfolge (aus app.module.ts):**
 * 1. ThrottlerGuard (DoS Protection) - AKTIV
 * 2. SetupPendingGuard (Setup Check) - BYPASSED via @SkipSetupCheck
 * 3. ServerAccessGuard (Token Check) - BYPASSED via @SkipServerAccess
 *
 * **Decorator Reihenfolge:**
 * - @SkipSetupCheck muss VOR @Controller stehen (class-level metadata)
 * - @SkipServerAccess muss VOR @Controller stehen (class-level metadata)
 * - Reihenfolge zwischen den Skip-Decorators ist egal (keine Interaktion)
 *
 * **Sicherheitshinweis:**
 * - Kein Auth Guard, da vom OAuth2 Provider aufgerufen
 * - State-Parameter schuetzt vor CSRF (validiert in Handler)
 * - FRONTEND_URL Redirect Whitelist verhindert Open Redirect
 * - Rate Limiting erfolgt via globaler ThrottlerGuard
 * - Error Messages sind sanitized (keine Info-Leaks)
 * - Redirectet zu Frontend nach Verarbeitung
 */
@ApiTags('oauth-callbacks')
@SkipServerAccess() // OAuth Provider kann X-Server-Access-Token nicht senden
@SkipSetupCheck() // OAuth kann waehrend Setup-Phase aufgerufen werden
@Controller({ path: 'oauth', version: VERSION_NEUTRAL })
export class OAuthCallbackController {
  constructor(
    private readonly processCallbackHandler: ProcessOAuthCallbackHandler,
    private readonly config: ConfigService,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  /**
   * Validiert ob die Redirect-URL in der Whitelist erlaubter Hosts ist.
   *
   * Verhindert Open Redirect Angriffe durch Validierung der FRONTEND_URL
   * gegen eine konfigurierbare Whitelist (ALLOWED_FRONTEND_HOSTS).
   *
   * @param url - Die zu validierende Frontend URL
   * @returns true wenn URL erlaubt ist, sonst false
   */
  private validateRedirectUrl(url: string): boolean {
    const allowedHosts = this.config
      .get<string>('ALLOWED_FRONTEND_HOSTS', 'localhost:3090')
      .split(',')
      .map((h) => h.trim());

    try {
      const parsed = new URL(url);
      return allowedHosts.some((host) => {
        const [hostname, port] = host.split(':');
        return parsed.hostname === hostname && (!port || parsed.port === port);
      });
    } catch {
      return false;
    }
  }

  /**
   * Sanitized error messages um Information Disclosure zu vermeiden.
   *
   * Mappt interne Error-Codes auf generische user-facing Messages.
   * Verhindert dass Implementation-Details durch Error Messages leaken.
   *
   * @param error - Der interne Error String
   * @returns Sanitized user-friendly Error Message
   */
  private getSafeErrorMessage(error: string | undefined): string {
    const errorMap: Record<string, string> = {
      OAUTH_STATE_INVALID: 'Sitzung abgelaufen. Bitte erneut verbinden.',
      OAUTH_CODE_EXCHANGE_FAILED: 'Authentifizierung fehlgeschlagen.',
      OAUTH_NOT_CONFIGURED: 'Service vorübergehend nicht verfügbar.',
    };

    // Extract error code if present
    for (const [code, message] of Object.entries(errorMap)) {
      if (error?.includes(code)) {
        return message;
      }
    }

    // Generic fallback - NEVER expose raw errors
    return 'Verbindung fehlgeschlagen. Bitte versuchen Sie es erneut.';
  }

  /**
   * HiOrg-Server OAuth2 Callback.
   *
   * Wird von HiOrg nach User Consent aufgerufen.
   * Verarbeitet Authorization Code und redirectet zu Frontend.
   *
   * **Security:**
   * - Rate Limiting: 5 attempts per 15 minutes (prevents state enumeration)
   * - CSRF Protection: State parameter validated in handler
   * - Open Redirect Protection: FRONTEND_URL whitelist validation
   */
  @Get('hiorg/callback')
  @RateLimit(RateLimitPresets.auth()) // F2: 5 attempts per 15 minutes
  @ApiSecurity('oauth2-state', ['callback']) // F6: Document OAuth2 state security
  @ApiExcludeEndpoint() // Nicht in Swagger anzeigen
  @ApiOperation({
    summary: 'HiOrg OAuth2 Callback (Server-to-Server)',
    description: `
      SECURITY: This endpoint bypasses ServerAccessGuard and SetupPendingGuard.
      - @SkipServerAccess: OAuth provider cannot send X-Server-Access-Token
      - @SkipSetupCheck: OAuth flow can start during initial setup
      - CSRF Protection: State parameter validated in handler
      - Rate Limiting: 5 attempts per 15 minutes (prevents enumeration)
      - Open Redirect Protection: FRONTEND_URL whitelist validation
    `,
  })
  @ApiQuery({ name: 'code', required: true, description: 'Authorization Code' })
  @ApiQuery({ name: 'state', required: true, description: 'State fuer CSRF-Schutz' })
  async handleHiOrgCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() response: Response,
  ): Promise<void> {
    // Validate FRONTEND_URL against whitelist (F1: Open Redirect Prevention)
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3090');
    if (!this.validateRedirectUrl(frontendUrl)) {
      this.logger.error(`Invalid FRONTEND_URL: ${frontendUrl}`);
      throw new InternalServerErrorException('Invalid frontend URL configuration');
    }

    const successUrl = `${frontendUrl}/admin/integrations/hiorg?oauth=success`;
    const errorUrl = `${frontendUrl}/admin/integrations/hiorg?oauth=error`;

    // Handle OAuth error response (F3: Sanitized Error Messages)
    if (error) {
      this.logger.warn(`OAuth error from HiOrg: ${error} - ${errorDescription}`);
      const safeMessage = this.getSafeErrorMessage(errorDescription || error);
      response.redirect(`${errorUrl}&message=${encodeURIComponent(safeMessage)}`);
      return;
    }

    // Validate required params (F3: Sanitized Error Messages)
    if (!code || !state) {
      this.logger.warn('Missing code or state in OAuth callback');
      const safeMessage = this.getSafeErrorMessage('MISSING_PARAMS');
      response.redirect(`${errorUrl}&message=${encodeURIComponent(safeMessage)}`);
      return;
    }

    // Process callback
    const commandResult = ProcessOAuthCallbackCommand.create({ code, state });
    if (commandResult.isFailure) {
      const errorMessage = commandResult.error ?? 'Unbekannter Fehler';
      this.logger.error(`Invalid callback command: ${errorMessage}`);
      const safeMessage = this.getSafeErrorMessage(errorMessage);
      response.redirect(`${errorUrl}&message=${encodeURIComponent(safeMessage)}`);
      return;
    }

    const command = commandResult.value;
    if (!command) {
      this.logger.error('Command creation returned no value');
      const safeMessage = this.getSafeErrorMessage('INTERNAL_ERROR');
      response.redirect(`${errorUrl}&message=${encodeURIComponent(safeMessage)}`);
      return;
    }

    const result = await this.processCallbackHandler.execute(command);

    if (result.isFailure) {
      const resultError = result.error ?? 'Unbekannter Fehler';
      this.logger.error(`OAuth callback processing failed: ${resultError}`);

      // F3: Use sanitized error messages
      const safeMessage = this.getSafeErrorMessage(resultError);
      response.redirect(`${errorUrl}&message=${encodeURIComponent(safeMessage)}`);
      return;
    }

    this.logger.log('OAuth callback processed successfully');
    response.redirect(successUrl);
  }
}
