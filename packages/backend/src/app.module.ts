import { HttpExceptionFilter } from '@/infrastructure/http/filters/http-exception.filter';
import { DomainExceptionFilter } from '@/infrastructure/http/filters/domain-exception.filter';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
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
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 10, // 10 requests per minute globally
      },
    ]),
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
  ],
  controllers: [AppController],
  providers: [
    Logger,
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
