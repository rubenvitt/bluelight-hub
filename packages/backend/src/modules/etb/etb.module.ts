import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { EtbApplicationModule } from '@/application/etb/etb-application.module';
import { EtbInfrastructureModule } from '@/infrastructure/etb/etb-infrastructure.module';
import { EtbCqrsController } from './controllers/etb-cqrs.controller';

/**
 * EtbModule - Einsatztagebuch Feature Module (Hexagonal Architecture).
 *
 * **Architektur (Story 5-1):**
 * - Controller nutzt ausschließlich CQRS Handler (CommandBus/QueryBus Pattern)
 * - Alle Business-Logik in Application Layer (EtbApplicationModule)
 * - Infrastructure via EtbInfrastructureModule (IEtbRepository)
 *
 * **Handler Injection Pattern (statt CqrsModule):**
 * Controller injiziert Handler direkt via DI, da Handler als @Injectable() registriert sind.
 * Dies vereinfacht das Setup und vermeidet die Notwendigkeit für @CommandHandler/@QueryHandler Dekoratoren.
 */
@Module({
  imports: [
    PrismaModule,
    EtbApplicationModule, // Registers all ETB Command/Query Handlers
    EtbInfrastructureModule, // Provides IEtbRepository for Controller
  ],
  controllers: [EtbCqrsController],
  providers: [],
  exports: [],
})
export class EtbModule {}
