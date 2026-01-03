/**
 * IntegrationsModule - NestJS Module für Integration-Features.
 *
 * Registriert Controller und importiert benötigte Module.
 *
 * @module modules/integrations
 */

import { Module } from '@nestjs/common';
import { LOGGER } from '@infrastructure/di-tokens';
import { NestLoggerAdapter } from '@infrastructure/common/adapters/nest-logger.adapter';
import { AuthModule } from '@/modules/auth/auth.module';
import { IntegrationsApplicationModule } from '@application/integrations/integrations-application.module';
import { AdminHiOrgIntegrationController } from './controllers/admin-hiorg-integration.controller';
import { OAuthCallbackController } from './controllers/oauth-callback.controller';

/**
 * NestJS Module für Integrationen (HiOrg-Server, etc.).
 */
@Module({
  imports: [
    // Auth Module für Guards und CurrentUser Decorator
    AuthModule,
    // Application Layer mit Command/Query Handlers
    IntegrationsApplicationModule,
  ],
  controllers: [AdminHiOrgIntegrationController, OAuthCallbackController],
  providers: [
    // Logger für Integrations Controller
    {
      provide: LOGGER,
      useFactory: () => new NestLoggerAdapter('Integrations'),
    },
  ],
})
export class IntegrationsModule {}
