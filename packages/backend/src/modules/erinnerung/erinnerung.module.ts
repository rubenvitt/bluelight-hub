import { Module } from '@nestjs/common';
// biome-ignore lint/style/useImportType: JwtModule needed for NestJS Module imports at runtime (AC1)
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
 * **Architektur:**
 * - Controller: HTTP-Adapter für REST API
 * - Handlers: CQRS Command/Query Handler
 * - Repository: Prisma Implementation injiziert via DI Token
 */
@Module({
  imports: [PrismaModule, InfrastructureCommonModule, OutboxModule],
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
    GetErinnerungenByEinsatzHandler,
    // WebSocket Gateway (Story 1.5 AC4)
    ErinnerungGateway,
  ],
  exports: [
    ERINNERUNG_REPOSITORY,
    CreateErinnerungHandler,
    UpdateErinnerungHandler,
    DeleteErinnerungHandler,
    TriggerErinnerungHandler,
    GetErinnerungenByEinsatzHandler,
    ErinnerungGateway, // Export for WebSocket Event Adapter
  ],
})
export class ErinnerungModule {}
