import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { InfrastructureCommonModule } from '@infrastructure/common.module';
import { OutboxModule } from '@infrastructure/outbox/outbox.module';
import { UserInfrastructureModule } from '@infrastructure/user/user-infrastructure.module';
import { ERINNERUNG_REPOSITORY } from '@infrastructure/di-tokens';
import { PrismaErinnerungRepository } from '@infrastructure/repositories/prisma-erinnerung.repository';
import { CreateErinnerungHandler } from '@/application/erinnerung/commands/create-erinnerung/create-erinnerung.handler';
import { UpdateErinnerungHandler } from '@/application/erinnerung/commands/update-erinnerung/update-erinnerung.handler';
import { DeleteErinnerungHandler } from '@/application/erinnerung/commands/delete-erinnerung/delete-erinnerung.handler';
import { TriggerErinnerungHandler } from '@/application/erinnerung/commands/trigger-erinnerung/trigger-erinnerung.handler';
import { AcknowledgeErinnerungHandler } from '@/application/erinnerung/commands/acknowledge-erinnerung/acknowledge-erinnerung.handler';
import { SnoozeErinnerungHandler } from '@/application/erinnerung/commands/snooze-erinnerung/snooze-erinnerung.handler';
import { MarkErledigtErinnerungHandler } from '@/application/erinnerung/commands/mark-erledigt-erinnerung/mark-erledigt-erinnerung.handler';
import { AssignErinnerungHandler } from '@/application/erinnerung/commands/assign-erinnerung/assign-erinnerung.handler';
import { GetErinnerungenByEinsatzHandler } from '@/application/erinnerung/queries/get-erinnerungen-by-einsatz/get-erinnerungen-by-einsatz.handler';
import { GetErinnerungKonfigurationHandler } from '@application/erinnerung-konfiguration/queries/get-erinnerung-konfiguration.query';
import { UpdateEskalationsTimeoutHandler } from '@application/erinnerung-konfiguration/commands/update-eskalations-timeout.command';
import { ErinnerungKonfigurationController } from './controllers/erinnerung-konfiguration.controller';
import { IErinnerungKonfigurationRepository } from '@domain/erinnerung-konfiguration/repositories/erinnerung-konfiguration.repository.interface';
import { PrismaErinnerungKonfigurationRepository } from '@infrastructure/repositories/prisma-erinnerung-konfiguration.repository';
import { ErinnerungController } from './controllers/erinnerung.controller';
import { ErinnerungGateway } from './gateways/erinnerung.gateway';
import { WsJwtAuthGuard } from './guards/ws-jwt-auth.guard';
import { ErinnerungResponseFactory } from '@/application/erinnerung/dto/erinnerung-response.factory';
import { EskaliereErinnerungHandler } from '@/application/erinnerung/commands/eskaliere-erinnerung/eskaliere-erinnerung.handler';
import { ErinnerungWebSocketEventAdapter } from '@infrastructure/events/adapters/erinnerung-websocket-event.adapter';

@Module({
  imports: [
    PrismaModule,
    InfrastructureCommonModule,
    OutboxModule,
    UserInfrastructureModule,
    CqrsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [ErinnerungController, ErinnerungKonfigurationController],
  providers: [
    // Repository
    {
      provide: ERINNERUNG_REPOSITORY,
      useClass: PrismaErinnerungRepository,
    },
    {
      provide: IErinnerungKonfigurationRepository,
      useClass: PrismaErinnerungKonfigurationRepository,
    },
    // Handlers
    CreateErinnerungHandler,
    UpdateErinnerungHandler,
    DeleteErinnerungHandler,
    TriggerErinnerungHandler,
    AcknowledgeErinnerungHandler,
    SnoozeErinnerungHandler,
    MarkErledigtErinnerungHandler,
    AssignErinnerungHandler,
    GetErinnerungenByEinsatzHandler,
    // Configuration Handlers (Story 4.3)
    GetErinnerungKonfigurationHandler,
    UpdateEskalationsTimeoutHandler,
    // Escalation (Story 4.1)
    EskaliereErinnerungHandler,
    // WebSocket (Story 1.5 AC4 + Security C1, C2, C3)
    ErinnerungGateway,
    WsJwtAuthGuard,
    ErinnerungWebSocketEventAdapter,
    // Utilities
    ErinnerungResponseFactory,
  ],
  exports: [
    ERINNERUNG_REPOSITORY,
    CreateErinnerungHandler,
    UpdateErinnerungHandler,
    DeleteErinnerungHandler,
    TriggerErinnerungHandler,
    AcknowledgeErinnerungHandler,
    SnoozeErinnerungHandler,
    MarkErledigtErinnerungHandler,
    AssignErinnerungHandler,
    GetErinnerungenByEinsatzHandler,
    ErinnerungGateway, // Export for WebSocket Event Adapter
    ErinnerungResponseFactory,
  ],
})
export class ErinnerungModule {}
