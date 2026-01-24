import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '@infrastructure/database/prisma.module';
import { InfrastructureCommonModule } from '@infrastructure/common.module';
import { OutboxModule } from '@infrastructure/outbox/outbox.module';
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
import { ErinnerungController } from './controllers/erinnerung.controller';
import { ErinnerungGateway } from './gateways/erinnerung.gateway';
import { WsJwtAuthGuard } from './guards/ws-jwt-auth.guard';

/**
 * Module für Erinnerungen/Wecker innerhalb von Einsätzen.
 *
 * **Story 1.1: Erinnerung mit Quick-Create anlegen**
 * - Erstellen von Erinnerungen mit Titel und Zeitpunkt
 * - Zeit-Presets (5, 10, 15, 30, 60 Min)
 * - Abrufen aller Erinnerungen eines Einsatzes
 *
 * **Security (C1, C2, C3):**
 * - JwtModule für WebSocket-Token-Validation
 * - WsJwtAuthGuard für Gateway-Authentication
 * - Input Validation via DTOs
 *
 * **Architektur:**
 * - Controller: HTTP-Adapter für REST API
 * - Gateway: WebSocket-Adapter für Real-time Events
 * - Handlers: CQRS Command/Query Handler
 * - Repository: Prisma Implementation injiziert via DI Token
 */
@Module({
  imports: [
    PrismaModule,
    InfrastructureCommonModule,
    OutboxModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [ErinnerungController],
  providers: [
    // Repository
    {
      provide: ERINNERUNG_REPOSITORY,
      useClass: PrismaErinnerungRepository,
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
    // WebSocket (Story 1.5 AC4 + Security C1, C2, C3)
    ErinnerungGateway,
    WsJwtAuthGuard,
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
  ],
})
export class ErinnerungModule {}
