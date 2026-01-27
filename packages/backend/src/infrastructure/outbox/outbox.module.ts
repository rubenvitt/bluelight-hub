import { Module } from '@nestjs/common';
// NOTE: ScheduleModule.forRoot() wird nur einmal in app.module.ts aufgerufen
import { EventSerializer } from './event-serializer';
import { EventDeserializer } from './event-deserializer';
import { PrismaOutboxRepository } from './prisma-outbox.repository';
import { OutboxEventPublisher, OUTBOX_PUBLISHER_CONFIG, DEFAULT_OUTBOX_PUBLISHER_CONFIG } from './outbox-event-publisher.service';
import { AlertModule } from '@/infrastructure/alert/alert.module';
import { EventInfrastructureModule } from '@/infrastructure/events/event-infrastructure.module';
import { LOGGER, OUTBOX_REPOSITORY } from '@infrastructure/di-tokens';
import { NestLoggerAdapter } from '../common/adapters/nest-logger.adapter';

/**
 * Outbox Infrastructure Module fuer Transactional Outbox Pattern.
 *
 * Dieses Module stellt die vollstaendige Infrastruktur fuer garantiertes
 * Event Publishing bereit (DRK Compliance: Kein Event-Verlust).
 *
 * **Komponenten:**
 * - EventSerializer: DomainEvent → JSON (fuer Outbox-Persistierung)
 * - EventDeserializer: JSON → DomainEvent (fuer Polling Worker)
 * - PrismaOutboxRepository: CRUD Operations auf outbox_events Tabelle
 * - OutboxEventPublisher: Polling Worker (CronJob alle 5 Sekunden)
 *
 * **Transactional Outbox Flow:**
 * 1. Handler ruft repository.save(aggregate) auf
 * 2. Repository persistiert Aggregate + Events in EINER Transaktion
 * 3. Events landen in outbox_events Tabelle (status=PENDING)
 * 4. Polling Worker (OutboxEventPublisher) pollt alle 5s
 * 5. Worker deserialisiert Events und published via EventEmitter
 * 6. Bei Erfolg: status=PUBLISHED, bei Fehler: retryCount++
 * 7. Nach MAX_RETRIES: status=FAILED + Alert an SUPER_ADMIN
 *
 * **Module Dependencies:**
 * - ScheduleModule: NestJS Cron Jobs fuer Polling Worker
 * - AlertModule: IAlertService fuer Fehler-Benachrichtigungen
 * - PrismaModule (global): PrismaService fuer DB-Operations
 *
 * **Configuration:**
 * Polling-Interval und Retry-Settings via OUTBOX_PUBLISHER_CONFIG:
 * ```typescript
 * {
 *   batchSize: 100,        // Events pro Zyklus
 *   maxRetries: 3,         // Max Retry-Versuche
 *   pollingEnabled: true,  // Polling aktiviert
 * }
 * ```
 *
 * @example
 * ```typescript
 * // In AppModule:
 * @Module({
 *   imports: [OutboxModule],
 * })
 * export class AppModule {}
 *
 * // Repository-Usage (automatisch via DI):
 * @Injectable()
 * export class PrismaEtbRepository {
 *   constructor(
 *     private readonly prisma: PrismaService,
 *     private readonly outboxRepository: PrismaOutboxRepository,
 *   ) {}
 *
 *   async save(aggregate: EinsatztagebuchAggregate): Promise<void> {
 *     await this.prisma.$transaction(async (tx) => {
 *       // ... persist aggregate ...
 *       await this.outboxRepository.save(aggregate.getDomainEvents(), tx);
 *     });
 *     aggregate.clearDomainEvents();
 *   }
 * }
 * ```
 *
 * Epic 4 Story 4.4 - Transactional Outbox Pattern Infrastructure
 */
@Module({
  imports: [AlertModule, EventInfrastructureModule],
  providers: [
    // Logger für Outbox Services
    {
      provide: LOGGER,
      useFactory: () => new NestLoggerAdapter('Outbox'),
    },

    // Serialization Services
    EventSerializer,
    EventDeserializer,

    // Repository - Concrete Implementation
    PrismaOutboxRepository,

    // Repository - DI Token Provider (für Application Layer Dependency Injection)
    {
      provide: OUTBOX_REPOSITORY,
      useClass: PrismaOutboxRepository,
    },

    // Polling Worker Configuration
    {
      provide: OUTBOX_PUBLISHER_CONFIG,
      useValue: DEFAULT_OUTBOX_PUBLISHER_CONFIG,
    },

    // Polling Worker Service
    OutboxEventPublisher,
  ],
  exports: [
    // Exportiere Repository DI Token fuer Application Layer
    OUTBOX_REPOSITORY,
    // Legacy: Export concrete class für Infrastructure Layer (wird deprecated)
    PrismaOutboxRepository,
    EventSerializer,
    EventDeserializer,
  ],
})
export class OutboxModule {}
