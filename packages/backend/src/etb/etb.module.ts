import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EtbApplicationModule } from '@/application/etb/etb-application.module';
import { EtbInfrastructureModule } from '@/infrastructure/etb/etb-infrastructure.module';
import { EtbCqrsController } from '@/modules/etb/controllers/etb-cqrs.controller';
import { EtbController } from './etb.controller';
import { EtbService } from './etb.service';
import { EtbRepository } from './etb.repository';

/**
 * EtbModule - Einsatztagebuch Feature Module.
 *
 * Dieses Modul vereint Legacy-Controller (EtbController) und neuen CQRS-Controller
 * (EtbCqrsController) für eine schrittweise Migration. Nach Abschluss der Migration
 * kann EtbController entfernt werden (Epic 5).
 *
 * **Handler Injection Pattern (statt CqrsModule):**
 * Controller injiziert Handler direkt via DI, da Handler als @Injectable() registriert sind.
 * Dies vereinfacht das Setup und vermeidet die Notwendigkeit für @CommandHandler/@QueryHandler Dekoratoren.
 *
 * **Warum beide Controller:**
 * Der alte Controller bleibt während der Migrationsphase aktiv, um
 * Rollback-Sicherheit zu gewährleisten. Frontend kann schrittweise auf
 * neue /api/alpha/etb/ Endpoints migrieren.
 */
@Module({
  imports: [
    PrismaModule,
    EtbApplicationModule, // Registers all ETB Command/Query Handlers
    EtbInfrastructureModule, // Provides IEtbRepository for Controller
  ],
  controllers: [
    EtbController, // Legacy controller (to be removed in Epic 5)
    EtbCqrsController, // New CQRS controller (Story 3.7)
  ],
  providers: [EtbService, EtbRepository],
  exports: [EtbService],
})
export class EtbModule {}
