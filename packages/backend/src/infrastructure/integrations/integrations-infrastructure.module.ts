/**
 * IntegrationsInfrastructureModule - Stellt Infrastructure-Layer für Integrationen bereit.
 *
 * Registriert:
 * - Repository-Implementierungen (Prisma)
 * - Port-Adapter (Encryption, HiOrg-Server API)
 * - Scheduled Tasks (OAuth2 State Cleanup)
 *
 * @module infrastructure/integrations
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { INTEGRATIONS, LOGGER } from '@infrastructure/di-tokens';
import { NestLoggerAdapter } from '@infrastructure/common/adapters/nest-logger.adapter';
import { AesEncryptionAdapter } from '@infrastructure/security/aes-encryption.adapter';
import { HiOrgServerAdapter } from './hiorg-server.adapter';
import { OAuth2Adapter } from './oauth2.adapter';
import { PrismaIntegrationCredentialRepository } from './repositories/prisma-integration-credential.repository';
import { PrismaOAuth2StateRepository } from './repositories/prisma-oauth2-state.repository';
import { HiOrgOAuthConfigAdapter } from '@infrastructure/config/hiorg-oauth-config.adapter';
import { OAuth2StateCleanupTask } from './tasks/oauth2-state-cleanup.task';
import { PrismaQualifikationMappingRepository } from './repositories/prisma-qualifikation-mapping.repository';

/**
 * Infrastructure Module für Integration-Features.
 *
 * Stellt Port-Implementierungen und Repositories für DI bereit.
 */
@Module({
  imports: [PrismaModule, ConfigModule, ScheduleModule.forRoot()],
  providers: [
    // Logger für Integrations (Audit Trail)
    {
      provide: LOGGER,
      useFactory: () => new NestLoggerAdapter('IntegrationsInfrastructure'),
    },
    // Encryption Port
    {
      provide: INTEGRATIONS.ENCRYPTION_PORT,
      useClass: AesEncryptionAdapter,
    },
    // HiOrg-Server API Port
    {
      provide: INTEGRATIONS.HIORG_SERVER_PORT,
      useClass: HiOrgServerAdapter,
    },
    // Credential Repository
    {
      provide: INTEGRATIONS.CREDENTIAL_REPOSITORY,
      useClass: PrismaIntegrationCredentialRepository,
    },
    // OAuth2 Port (PKCE Authorization Code Flow)
    {
      provide: INTEGRATIONS.OAUTH2_PORT,
      useClass: OAuth2Adapter,
    },
    // OAuth2 State Repository (für CSRF-Schutz während OAuth Flow)
    {
      provide: INTEGRATIONS.OAUTH2_STATE_REPOSITORY,
      useClass: PrismaOAuth2StateRepository,
    },
    // HiOrg OAuth Config Port (Client Credentials aus ENV)
    {
      provide: INTEGRATIONS.HIORG_OAUTH_CONFIG_PORT,
      useClass: HiOrgOAuthConfigAdapter,
    },
    // Qualifikation Mapping Repository (Story 7.2)
    {
      provide: INTEGRATIONS.QUALIFIKATION_MAPPING_REPOSITORY,
      useClass: PrismaQualifikationMappingRepository,
    },
    // Scheduled Tasks
    OAuth2StateCleanupTask,
  ],
  exports: [
    // Logger für Application Layer Handler
    LOGGER,
    // DI Tokens für Interface-basierte Injection
    INTEGRATIONS.ENCRYPTION_PORT,
    INTEGRATIONS.HIORG_SERVER_PORT,
    INTEGRATIONS.CREDENTIAL_REPOSITORY,
    INTEGRATIONS.OAUTH2_PORT,
    INTEGRATIONS.OAUTH2_STATE_REPOSITORY,
    INTEGRATIONS.HIORG_OAUTH_CONFIG_PORT,
    INTEGRATIONS.QUALIFIKATION_MAPPING_REPOSITORY,
  ],
})
export class IntegrationsInfrastructureModule {}
