import { Module } from '@nestjs/common';
import { PrismaModule } from '@/infrastructure/database/prisma.module';
import { EventInfrastructureModule } from '@infrastructure/events/event-infrastructure.module';
import { LagekarteInfrastructureModule } from '@infrastructure/lagekarte-infrastructure.module';
import { EtbInfrastructureModule } from '@infrastructure/etb/etb-infrastructure.module';
import { OutboxModule } from '@infrastructure/outbox/outbox.module';
import { LOGGER } from '@infrastructure/di-tokens';
import { NestLoggerAdapter } from '@infrastructure/common/adapters/nest-logger.adapter';
import { EinsatzCompletenessService } from '@domain/services/einsatz-completeness.service';
import { EinsatzArchivalPolicy } from '@domain/services/einsatz-archival.policy';
import {
  CreateEinsatzHandler,
  UpdateEinsatzHandler,
  DeleteEinsatzHandler,
  StartEinsatzHandler,
  CompleteEinsatzHandler,
  ArchiveEinsatzHandler,
  UpdateEinsatzStatusHandler,
  ArchiveOldEinsaetzeHandler,
} from './commands';
import {
  GetActiveEinsaetzeQueryHandler,
  GetEinsatzByIdQueryHandler,
  GetEinsatzByNummerQueryHandler,
  GetEinsatzDetailsQueryHandler,
  GetActiveEinsaetzeWithCountsQueryHandler,
  GetStatusCountsQueryHandler,
  GetEinsatzCompletenessQueryHandler,
  GetAllEinsaetzeQueryHandler,
  GetPreviousEinsatzIdQueryHandler,
  GetNextEinsatzIdQueryHandler,
  GetEinsatzTeilnehmerHandler,
} from './queries';

/**
 * NestJS-Modul für Application Layer - Einsatz Bounded Context.
 *
 * Dieses Modul registriert alle Command-Handler für Einsatz CRUD-Operationen
 * und macht sie über Dependency Injection verfügbar. Ermöglicht Controller
 * (Infrastructure Layer) die Handler zu nutzen, ohne direkt zu importieren
 * (Loose Coupling via Hexagonale Architektur).
 *
 * **CQRS Pattern (Story 4-1, 4-3):**
 * - Command Handlers: State Mutation (Create, Update, Delete)
 * - Query Handlers: State Reading (GetActiveEinsaetze, GetById, GetByNummer)
 *
 * **NO-DELETE Policy (DRK-Compliance):**
 * DeleteEinsatzHandler gibt IMMER einen Fehler zurück.
 * Einsätze können nicht gelöscht werden (10-Jahre-Aufbewahrungspflicht).
 * Verwende stattdessen ArchiveEinsatzCommand (Story 4-2).
 *
 * **Warum separate Module pro Bounded Context:**
 * - Klare Modul-Grenzen entsprechend DDD
 * - Selektives Testen möglich (nur Einsatz-Context)
 * - Einfachere Migration zu Microservices
 * - Dependency Injection Scope pro Context
 *
 * @example
 * ```typescript
 * // In Controller:
 * constructor(private readonly createHandler: CreateEinsatzHandler) {}
 *
 * @Post()
 * async create(@Body() dto: CreateEinsatzDto) {
 *   const command = CreateEinsatzCommand.create(dto.alarmstichwort, dto.userId);
 *   return this.createHandler.execute(command.value);
 * }
 * ```
 */
@Module({
  imports: [
    // Database Connection
    PrismaModule,
    // Event Infrastructure (IEventPublisher) - keine zirkuläre Abhängigkeit mehr
    EventInfrastructureModule,
    // Repository Infrastructure (IEinsatzRepository, ILagekarteRepository)
    LagekarteInfrastructureModule,
    // Repository Infrastructure (IEtbRepository) - für Cross-Aggregate Queries (Story 4-3b)
    EtbInfrastructureModule,
    // Outbox Infrastructure (PrismaOutboxRepository) - für Transactional Outbox Pattern
    OutboxModule,
  ],
  providers: [
    // Logger für Einsatz Handlers
    {
      provide: LOGGER,
      useFactory: () => new NestLoggerAdapter('Einsatz'),
    },
    // Domain Services (Story 4-2)
    // NICHT in exports: Nur intern von Handlers verwendet (CompleteEinsatzHandler, ArchiveEinsatzHandler)
    EinsatzCompletenessService,
    EinsatzArchivalPolicy,
    // Command Handlers (Story 4-1)
    CreateEinsatzHandler,
    UpdateEinsatzHandler,
    DeleteEinsatzHandler,
    // Command Handlers (Story 4-2: Status Transitions)
    StartEinsatzHandler,
    CompleteEinsatzHandler,
    ArchiveEinsatzHandler,
    UpdateEinsatzStatusHandler,
    // Command Handlers (Story 5-6: Bulk Archive)
    ArchiveOldEinsaetzeHandler,
    // Query Handlers (Story 4-3: Read Operations)
    GetActiveEinsaetzeQueryHandler,
    GetEinsatzByIdQueryHandler,
    GetEinsatzByNummerQueryHandler,
    // Query Handlers (Story 4-3b: Combined Cross-Aggregate Queries)
    GetEinsatzDetailsQueryHandler,
    GetActiveEinsaetzeWithCountsQueryHandler,
    // Query Handlers (Story 4-8: Additional Queries for Controller)
    GetStatusCountsQueryHandler,
    GetEinsatzCompletenessQueryHandler,
    GetAllEinsaetzeQueryHandler,
    GetPreviousEinsatzIdQueryHandler,
    GetNextEinsatzIdQueryHandler,
    // Story 3.3: Teilnehmer Query Handler
    GetEinsatzTeilnehmerHandler,
  ],
  exports: [
    // Export handlers for use in Infrastructure Layer (Controllers)
    CreateEinsatzHandler,
    UpdateEinsatzHandler,
    DeleteEinsatzHandler,
    // Story 4-2: Status Transition Handlers
    StartEinsatzHandler,
    CompleteEinsatzHandler,
    ArchiveEinsatzHandler,
    UpdateEinsatzStatusHandler,
    // Story 5-6: Bulk Archive Handler
    ArchiveOldEinsaetzeHandler,
    // Story 4-3: Query Handlers
    GetActiveEinsaetzeQueryHandler,
    GetEinsatzByIdQueryHandler,
    GetEinsatzByNummerQueryHandler,
    // Story 4-3b: Combined Cross-Aggregate Query Handlers
    GetEinsatzDetailsQueryHandler,
    GetActiveEinsaetzeWithCountsQueryHandler,
    // Story 4-8: Additional Query Handlers
    GetStatusCountsQueryHandler,
    GetEinsatzCompletenessQueryHandler,
    GetAllEinsaetzeQueryHandler,
    GetPreviousEinsatzIdQueryHandler,
    GetNextEinsatzIdQueryHandler,
    // Story 3.3: Teilnehmer Query Handler
    GetEinsatzTeilnehmerHandler,
  ],
})
export class EinsatzApplicationModule {}
