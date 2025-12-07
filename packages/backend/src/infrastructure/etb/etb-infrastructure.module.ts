import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { PrismaEtbRepository } from './repositories/prisma-etb.repository';
import { PrismaOutboxRepository } from '@/infrastructure/outbox/prisma-outbox.repository';
import { EventSerializer } from '@/infrastructure/outbox/event-serializer';
import { ETB_REPOSITORY, OUTBOX_REPOSITORY } from '@infrastructure/di-tokens';

/**
 * NestJS Module für ETB Infrastructure Layer.
 *
 * Dieses Modul registriert die Infrastructure-Implementierungen
 * der Domain Repository Ports (Hexagonal Architecture Pattern).
 *
 * **Dependency Injection Strategy:**
 * - IEtbRepository wird als Symbol Token bereitgestellt (ETB_REPOSITORY)
 * - PrismaEtbRepository ist die konkrete Repository-Implementierung
 * - Application Layer kann das Interface injizieren via @Inject(ETB_REPOSITORY)
 *
 * **Warum Symbol Token statt String Token:**
 * - Type Safety: TypeScript kann Symbol Types validieren
 * - Keine Namenskollisionen: Jedes Symbol ist einzigartig
 * - Bessere IDE-Unterstützung: Autocomplete und Refactoring
 * - Konsistent mit modernen DI Best Practices
 *
 * **Module Dependencies:**
 * - PrismaModule: Stellt PrismaService für Repository zur Verfügung
 * - EventSerializer: Serialisiert Domain Events für Outbox Pattern (Story 4-4)
 * - PrismaOutboxRepository: Persistiert Events in outbox_events Tabelle (Story 4-4)
 *
 * **Transactional Outbox Pattern (Story 4-4):**
 * - PrismaEtbRepository nutzt PrismaOutboxRepository für atomare Event-Persistierung
 * - Events werden mit Aggregate in einer Transaktion committed
 * - Garantiert: Keine Event-Loss durch Transaction Rollback
 *
 * @example
 * ```typescript
 * // In Application Layer Command Handler:
 * @Injectable()
 * export class CreateEtbCommandHandler {
 *   constructor(
 *     @Inject(ETB_REPOSITORY)
 *     private readonly etbRepository: IEtbRepository
 *   ) {}
 * }
 * ```
 */
@Module({
  imports: [PrismaModule],
  providers: [
    // Outbox Infrastructure (Story 4-4)
    EventSerializer,
    PrismaOutboxRepository,
    {
      provide: OUTBOX_REPOSITORY,
      useClass: PrismaOutboxRepository,
    },

    // Repository Implementation bound to Interface Token
    {
      provide: ETB_REPOSITORY,
      useClass: PrismaEtbRepository,
    },
  ],
  exports: [
    // Export Interface Token for Application Layer injection
    ETB_REPOSITORY,
    OUTBOX_REPOSITORY,
  ],
})
export class EtbInfrastructureModule {}
