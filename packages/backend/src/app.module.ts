import { HttpExceptionFilter } from '@/infrastructure/http/filters/http-exception.filter';
import { DomainExceptionFilter } from '@/infrastructure/http/filters/domain-exception.filter';
import { LOGGER } from '@/infrastructure/di-tokens';
import { NestLoggerAdapter } from '@/infrastructure/common/adapters/nest-logger.adapter';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { resolve } from 'node:path';
import { AppController } from './app.controller';
import { AuthModule } from './modules/auth/auth.module';
import { InfrastructureCommonModule } from '@infrastructure/common.module';
import { EinsatzModule } from './modules/einsatz/einsatz.module';
import { EtbModule } from './modules/etb/etb.module';
import { PatientenModule } from './modules/patienten/patienten.module';
import { FunkkanalModule } from './modules/funkkanal/funkkanal.module';
import { AlarmierungModule } from './modules/alarmierung/alarmierung.module';
import { HealthModule } from '@infrastructure/health/health.module';
import { PrismaModule } from '@infrastructure/database';
import { UserManagementModule } from './modules/user-management';
import { LagekarteModule } from './modules/lagekarte/lagekarte.module';
import { LagekarteInfrastructureModule } from '@infrastructure/lagekarte-infrastructure.module';
import { EinsatzInfrastructureModule } from '@/infrastructure';
import { UserInfrastructureModule } from '@/infrastructure';
import { AuthInfrastructureModule } from '@/infrastructure';
import { OutboxModule } from '@infrastructure/outbox';
import { EventAdaptersModule } from '@infrastructure/events';
import { KraefteModule } from './modules/kraefte/kraefte.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ServerAccessTokenInfrastructureModule } from '@infrastructure/server-access-token';
import { ServerAccessGuard } from '@infrastructure/guards/server-access.guard';
import { SetupPendingGuard } from '@infrastructure/guards/setup-pending.guard';
import { AdminModule } from './modules/admin/admin.module';
import { PasswordModule } from '@infrastructure/password/password.module';
import { EinsatzTeilnehmerModule } from './modules/einsatz-teilnehmer/einsatz-teilnehmer.module';
import { ErinnerungModule } from './modules/erinnerung/erinnerung.module';
import { ErinnerungsvorlageModule } from './modules/erinnerungsvorlage/erinnerungsvorlage.module';
import { FuehrungsrhythmusTemplateModule } from './modules/fuehrungsrhythmus-template/fuehrungsrhythmus-template.module';
import { NotizModule } from './modules/notiz/notiz.module';
import { KategorieModule } from './modules/kategorie/kategorie.module';
import { BefehlModule } from './modules/befehl/befehl.module';
import { AufbewahrungModule } from './modules/aufbewahrung/aufbewahrung.module';
import { SchedulerModule } from '@infrastructure/scheduler/scheduler.module';
import { EigenschutzSchedulerModule } from '@infrastructure/eigenschutz/scheduler/eigenschutz-scheduler.module';
import { MetricsModule } from '@infrastructure/metrics/metrics.module';
import { MetricsInterceptor } from '@infrastructure/metrics/metrics.interceptor';
import { DeprecationInterceptor } from './modules/common/interceptors/deprecation.interceptor';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { GeoModule } from './modules/geo/geo.module';
import { EinsatzBeitrittModule } from './modules/einsatz-beitritt/einsatz-beitritt.module';
import { GefahrModule } from './modules/gefahr/gefahr.module';
import { TaktischeZeichenModule } from './modules/taktische-zeichen/taktische-zeichen.module';
import { FunkkanalInfrastructureModule } from '@infrastructure/funkkanal/funkkanal-infrastructure.module';
import { AlarmierungInfrastructureModule } from '@infrastructure/alarmierung/alarmierung-infrastructure.module';
import { WebsocketModule } from '@infrastructure/websocket/websocket.module';
import { PushNotificationsModule } from './modules/push-notifications/push-notifications.module';
import { EigenschutzModule } from './modules/eigenschutz/eigenschutz.module';

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
    ScheduleModule.forRoot(),
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
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          rootPath: resolve(process.cwd(), configService.get<string>('UPLOADS_PATH', 'uploads')),
          serveRoot: '/uploads',
          serveStaticOptions: {
            index: false,
            fallthrough: false,
          },
        },
      ],
    }),
    PrismaModule,
    HealthModule,
    InfrastructureCommonModule,
    AuthModule,
    UserManagementModule,
    EinsatzModule,
    EtbModule,
    PatientenModule, // Story 1.2: Patient-Erfassung im Einsatz (Issue #417)
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
    ErinnerungsvorlageModule, // Erinnerungsvorlagen (Story 6.1)
    FuehrungsrhythmusTemplateModule, // Fuehrungsrhythmus-Templates (Story 6.6)
    NotizModule, // Notizen im Einsatz-Kontext (Story 7.1)
    KategorieModule, // Kategorien (Story 8.1)
    BefehlModule, // Befehle/Führungsbefehle (Story 1.2)
    AufbewahrungModule, // DSGVO-Aufbewahrungsmanagement (Story 5.5)
    SchedulerModule, // Cron-Jobs (nur einmal importiert, um mehrfache Registrierung zu vermeiden)
    MetricsModule, // Prometheus Metrics (Story 5.6)
    MonitoringModule, // System-Monitoring WebSocket Gateway (Story 5.6)
    GeoModule, // PLZ-Lookup via zippopotam.us (Issue #525)
    EinsatzBeitrittModule, // Einsatz-Beitrittsanfragen (Issue #98)
    GefahrModule, // Gefahrenmatrix (Issue #414)
    TaktischeZeichenModule, // Taktische Zeichen (DV 102) #636
    FunkkanalInfrastructureModule, // Funkkanal Infrastructure (Issue #407, Wave 2)
    FunkkanalModule, // Funkkanal HTTP Layer (Issue #407, Wave 2 / Phase 7)
    AlarmierungInfrastructureModule, // Alarmierung Infrastructure (Issue #408, Wave 1)
    AlarmierungModule, // Alarmierung HTTP Layer (Issue #408, Wave 1 / Task 5)
    WebsocketModule, // Einsatz-Events WebSocket-Gateway + Publisher (Issue #407, Task 18)
    PushNotificationsModule, // Plattform Push-Notifications (Story 1.1, ADR-011)
    EigenschutzModule, // Eigenschutz-Feature-Slice: Health-Endpoint + Guard-Kette (Story 1.6)
    EigenschutzSchedulerModule, // Eigenschutz-Cron-Jobs (Story 3.7 — PSA-Quittung-Reprompt nach 5 min)
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
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor, // Prometheus HTTP Request Duration (Story 5.6)
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: DeprecationInterceptor, // RFC 8594 Deprecation Headers (Story 5.7)
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
