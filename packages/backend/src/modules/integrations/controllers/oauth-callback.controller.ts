/**
 * OAuthCallbackController - Verarbeitet OAuth2 Callbacks.
 *
 * Dieser Controller ist NICHT mit AdminGuard geschuetzt, da er
 * vom OAuth2 Provider aufgerufen wird (Redirect nach User Consent).
 *
 * @module modules/integrations/controllers
 */

import { Controller, Get, Query, Res, Inject, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiExcludeEndpoint } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ProcessOAuthCallbackHandler } from '@application/integrations/commands/process-oauth-callback/process-oauth-callback.handler';
import { ProcessOAuthCallbackCommand } from '@application/integrations/commands/process-oauth-callback/process-oauth-callback.command';
import { IntegrationError, INTEGRATION_ERROR_CODES } from '@domain/integrations';
import type { ILogger } from '@domain/ports/i-logger.port';
import { LOGGER } from '@infrastructure/di-tokens';

/**
 * Controller fuer OAuth2 Callbacks.
 *
 * **Sicherheitshinweis:**
 * - Kein Auth Guard, da vom OAuth2 Provider aufgerufen
 * - State-Parameter schuetzt vor CSRF
 * - Redirectet zu Frontend nach Verarbeitung
 */
@ApiTags('oauth-callbacks')
@Controller({ path: 'oauth', version: VERSION_NEUTRAL })
export class OAuthCallbackController {
  constructor(
    private readonly processCallbackHandler: ProcessOAuthCallbackHandler,
    private readonly config: ConfigService,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  /**
   * HiOrg-Server OAuth2 Callback.
   *
   * Wird von HiOrg nach User Consent aufgerufen.
   * Verarbeitet Authorization Code und redirectet zu Frontend.
   */
  @Get('hiorg/callback')
  @ApiExcludeEndpoint() // Nicht in Swagger anzeigen
  @ApiOperation({ summary: 'HiOrg OAuth2 Callback (intern)' })
  @ApiQuery({ name: 'code', required: true, description: 'Authorization Code' })
  @ApiQuery({ name: 'state', required: true, description: 'State fuer CSRF-Schutz' })
  async handleHiOrgCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() response: Response,
  ): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3090');
    const successUrl = `${frontendUrl}/admin/integrations/hiorg?oauth=success`;
    const errorUrl = `${frontendUrl}/admin/integrations/hiorg?oauth=error`;

    // Handle OAuth error response
    if (error) {
      this.logger.warn(`OAuth error from HiOrg: ${error} - ${errorDescription}`);
      response.redirect(`${errorUrl}&message=${encodeURIComponent(errorDescription || error)}`);
      return;
    }

    // Validate required params
    if (!code || !state) {
      this.logger.warn('Missing code or state in OAuth callback');
      response.redirect(`${errorUrl}&message=${encodeURIComponent('Fehlende Parameter')}`);
      return;
    }

    // Process callback
    const commandResult = ProcessOAuthCallbackCommand.create({ code, state });
    if (commandResult.isFailure) {
      const errorMessage = commandResult.error ?? 'Unbekannter Fehler';
      this.logger.error(`Invalid callback command: ${errorMessage}`);
      response.redirect(`${errorUrl}&message=${encodeURIComponent(errorMessage)}`);
      return;
    }

    const command = commandResult.value;
    if (!command) {
      this.logger.error('Command creation returned no value');
      response.redirect(`${errorUrl}&message=${encodeURIComponent('Interner Fehler')}`);
      return;
    }

    const result = await this.processCallbackHandler.execute(command);

    if (result.isFailure) {
      const resultError = result.error ?? 'Unbekannter Fehler';
      this.logger.error(`OAuth callback processing failed: ${resultError}`);

      // Extract user-friendly message
      let message = 'Verbindung fehlgeschlagen';
      if (IntegrationError.hasCode(resultError, INTEGRATION_ERROR_CODES.OAUTH_STATE_INVALID)) {
        message = 'Sitzung abgelaufen. Bitte erneut verbinden.';
      } else if (IntegrationError.hasCode(resultError, INTEGRATION_ERROR_CODES.OAUTH_CODE_EXCHANGE_FAILED)) {
        message = 'Authentifizierung fehlgeschlagen.';
      }

      response.redirect(`${errorUrl}&message=${encodeURIComponent(message)}`);
      return;
    }

    this.logger.log('OAuth callback processed successfully');
    response.redirect(successUrl);
  }
}
