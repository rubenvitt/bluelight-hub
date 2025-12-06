import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { PrismaEinsatzRepository } from './repositories/prisma-einsatz.repository';
import { PrismaOutboxRepository } from '@/infrastructure/outbox/prisma-outbox.repository';
import { EventSerializer } from '@/infrastructure/outbox/event-serializer';
import { EINSATZ_REPOSITORY, OUTBOX_REPOSITORY } from '@infrastructure/di-tokens';

/**
 * NestJS Module für Einsatz Infrastructure Layer.
 *
 * Dieses Modul registriert die Infrastructure-Implementierungen
 * der Domain Repository Ports (Hexagonal Architecture Pattern).
 *
 * **Dependency Injection Strategy:**
 * - IEinsatzRepository wird als String Token bereitgestellt
 * - PrismaEinsatzRepository ist die konkrete Repository-Implementierung
 * - Application Layer kann das Interface injizieren via @Inject('IEinsatzRepository')
 *
 * **Warum String Token statt Class Token:**
 * - Domain Layer kennt NUR das Interface (IEinsatzRepository)
 * - Domain Layer kann NICHT auf Infrastructure Class referenzieren
 * - String Token entkoppelt Domain von Infrastructure
 * - Ermöglicht austauschbare Implementierungen (Prisma, In-Memory für Tests)
 *
 * **Module Dependencies:**
 * - PrismaModule: Stellt PrismaService für Repository zur Verfügung
 * - EventSerializer: Serialisiert Domain Events für Outbox Pattern
 * - PrismaOutboxRepository: Persistiert Events in outbox_events Tabelle (Transactional Outbox)
 *
 * **Transactional Outbox Pattern:**
 * - PrismaEinsatzRepository nutzt PrismaOutboxRepository für atomare Event-Persistierung
 * - Events werden mit Aggregate in einer Transaktion committed
 * - Garantiert: Keine Event-Loss durch Transaction Rollback
 *
 * @example
 * ```typescript
 * // In Application Layer Command Handler:
 * @Injectable()
 * export class CreateEinsatzCommandHandler {
 *   constructor(
 *     @Inject('IEinsatzRepository')
 *     private readonly einsatzRepository: IEinsatzRepository
 *   ) {}
 * }
 * ```
 */
@Module({
  imports: [PrismaModule],
  providers: [
    // Outbox Infrastructure (Transactional Outbox Pattern)
    EventSerializer,
    PrismaOutboxRepository,
    {
      provide: OUTBOX_REPOSITORY,
      useClass: PrismaOutboxRepository,
    },

    // Repository Implementation bound to Interface Token
    {
      provide: EINSATZ_REPOSITORY,
      useClass: PrismaEinsatzRepository,
    },
  ],
  exports: [
    // Export Interface Token for Application Layer injection
    EINSATZ_REPOSITORY,
    OUTBOX_REPOSITORY,
  ],
})
export class EinsatzInfrastructureModule {}
