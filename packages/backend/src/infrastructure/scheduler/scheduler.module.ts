import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ErinnerungEskalationsScheduler } from './erinnerung-eskalations.scheduler';
import { ERINNERUNG_REPOSITORY, LOGGER } from '@infrastructure/di-tokens';
import { NestLoggerAdapter } from '@infrastructure/common/adapters/nest-logger.adapter';
import { PrismaErinnerungRepository } from '@infrastructure/repositories/prisma-erinnerung.repository';
import { PrismaModule } from '@infrastructure/database/prisma.module';

/**
 * Modul für alle Scheduler/Cron-Jobs.
 *
 * **WICHTIG:** Dieses Modul wird NUR EINMAL in app.module.ts importiert,
 * um mehrfache Cron-Job-Registrierung zu vermeiden.
 *
 * Der Scheduler war vorher im ErinnerungModule, das mehrfach im
 * Dependency-Graph vorkommt (direkt in app.module + via EventAdaptersModule).
 * Das führte dazu, dass der Cron-Job mehrfach getriggert wurde.
 *
 * **Dependency:** Die Query-Handler (GetErinnerungKonfigurationHandler) werden
 * vom ErinnerungModule registriert und sind via QueryBus erreichbar.
 */
@Module({
  imports: [PrismaModule, CqrsModule],
  providers: [
    {
      provide: LOGGER,
      useFactory: () => new NestLoggerAdapter('InfrastructureCommon'),
    },
    {
      provide: ERINNERUNG_REPOSITORY,
      useClass: PrismaErinnerungRepository,
    },
    ErinnerungEskalationsScheduler,
  ],
})
export class SchedulerModule {}
