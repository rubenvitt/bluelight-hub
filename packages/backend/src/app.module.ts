import { HttpExceptionFilter } from '@/infrastructure/http/filters/http-exception.filter';
import { DomainExceptionFilter } from '@/infrastructure/http/filters/domain-exception.filter';
import { LOGGER } from '@/infrastructure/di-tokens';
import { NestLoggerAdapter } from '@/infrastructure/common/adapters/nest-logger.adapter';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { AppController } from './app.controller';
import { AuthModule } from './modules/auth/auth.module';
import { InfrastructureCommonModule } from './infrastructure/common.module';
import { EinsatzModule } from './modules/einsatz/einsatz.module';
import { EtbModule } from './modules/etb/etb.module';
import { HealthModule } from './infrastructure/health/health.module';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { UserManagementModule } from './modules/user-management';
import { LagekarteModule } from './modules/lagekarte/lagekarte.module';
import { LagekarteInfrastructureModule } from './infrastructure/lagekarte-infrastructure.module';
import { EinsatzInfrastructureModule } from './infrastructure/einsatz/einsatz-infrastructure.module';
import { UserInfrastructureModule } from './infrastructure/user';
import { AuthInfrastructureModule } from './infrastructure/auth';
import { OutboxModule } from './infrastructure/outbox/outbox.module';
import { EventAdaptersModule } from './infrastructure/events/event-adapters.module';
import { KraefteModule } from './modules/kraefte/kraefte.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ServerAccessTokenInfrastructureModule } from './infrastructure/server-access-token';
import { ServerAccessGuard } from './infrastructure/guards/server-access.guard';
import { SetupPendingGuard } from './infrastructure/guards/setup-pending.guard';
import { AdminModule } from './modules/admin/admin.module';
import { PasswordModule } from './infrastructure/password/password.module';
import { EinsatzTeilnehmerModule } from './modules/einsatz-teilnehmer/einsatz-teilnehmer.module';
import { ErinnerungModule } from './modules/erinnerung/erinnerung.module';

/**
 * Haupt-Anwendungsmodul der Bluelight Hub Backend-Anwendung
 *
 * Dieses Modul orchestriert alle Anwendungsmodule und konfiguriert
 * globale Einstellungen und Guards. Es stellt die zentrale
 * Einstiegsstelle für die NestJS-Anwendung dar.
 *
 * Features:
 * - Globale Umgebungskonfiguration
 * - Aufgabenplanung mit ScheduleModule
 * - Event-basierte Kommunikation
 * - JWT-basierte Authentifizierung als globaler Guard
 * - Datenbankanbindung über Prisma
 *
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot({
      // Event-basierte Kommunikation zwischen Modulen
      wildcard: false,
      delimiter: '.',
      maxListeners: 10,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const windowMs = Number(configService.get('RATE_LIMITER_WINDOW_MS', 60000));
        const maxRequests = Number(configService.get('RATE_LIMITER_MAX_REQUESTS', 100));
        const ttl = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60000;
        const limit = Number.isFinite(maxRequests) && maxRequests > 0 ? maxRequests : 100;

        return [
          {
            ttl,
            limit,
          },
        ];
      },
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), process.env.UPLOADS_PATH || 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: {
        index: false,
        fallthrough: false,
      },
    }),
    PrismaModule,
    HealthModule,
    InfrastructureCommonModule,
    AuthModule,
    UserManagementModule,
    EinsatzModule,
    EtbModule,
    LagekarteModule,
    LagekarteInfrastructureModule,
    EinsatzInfrastructureModule, // Einsatz Repository Infrastructure (Story 4-5)
    UserInfrastructureModule, // User Repository Infrastructure (Story 4-7, Task 5)
    AuthInfrastructureModule, // JWT Auth Service Infrastructure (Story 4-7, Task 5)
    OutboxModule, // Transactional Outbox Pattern (Story 4-4)
    EventAdaptersModule, // Event Adapters (delegiert @OnEvent an Application Layer Handler)
    KraefteModule, // Kräftemanagement: Qualifikationen, Rollen, Fahrzeugtypen (Story 1-1)
    IntegrationsModule, // HiOrg-Server Integration (Story 7-1)
    ServerAccessTokenInfrastructureModule, // Server-Access-Token Guard & Repository (Story 1-1a)
    AdminModule, // Admin Setup & Management (Story 1.3)
    PasswordModule, // HIBP Password Breach Check (NIST SP 800-63B-4)
    EinsatzTeilnehmerModule, // Einsatz-Teilnehmer Management (Story 115)
    ErinnerungModule, // Erinnerungen/Wecker für Einsätze (Story 1.1)
  ],
  controllers: [AppController],
  providers: [
    Logger,
    // Logger für globale Filter (DomainExceptionFilter, HttpExceptionFilter)
    {
      provide: LOGGER,
      useFactory: () => new NestLoggerAdapter('AppModule'),
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // 1. Rate Limiting (DoS Protection)
    },
    {
      provide: APP_GUARD,
      useClass: SetupPendingGuard, // 2. Setup Check (Story 1.2) - muss vor ServerAccessGuard kommen!
    },
    {
      provide: APP_GUARD,
      useClass: ServerAccessGuard, // 3. Server-Access-Token Check (Story 1-1a)
    },
    {
      provide: APP_FILTER,
      useClass: DomainExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
