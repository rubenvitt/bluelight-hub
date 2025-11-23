import { Module } from '@nestjs/common';
import { LagekarteEventsModule } from '@infrastructure/events/lagekarte-events.module';
import { CreateEtbHandler } from './commands/create-etb/create-etb.handler';
import { AddEintragHandler } from './commands/add-eintrag/add-eintrag.handler';
import { UpdateEintragHandler } from './commands/update-eintrag/update-eintrag.handler';
import { DeleteEintragHandler } from './commands/delete-eintrag/delete-eintrag.handler';
import { LockEtbHandler } from './commands/lock-etb/lock-etb.handler';
import { GetEtbQueryHandler, GetEtbHistoryQueryHandler, GetEintraegeQueryHandler } from './queries';
import { EtbQueryMapper } from './mappers';
import { EtbAutoCreationHandler } from './event-handlers';

/**
 * NestJS-Modul für Application Layer - ETB (Einsatztagebuch) Bounded Context.
 *
 * Dieses Modul registriert alle Command-Handler, Query-Handler, Event-Handler
 * und Mapper und macht sie über Dependency Injection verfügbar. Ermöglicht
 * Controller (Infrastructure Layer) die Handler zu nutzen, ohne direkt zu
 * importieren (Loose Coupling).
 *
 * **CQRS Pattern:**
 * - Command Handlers: State Mutation (Create ETB, Add/Update/Delete Eintrag, Lock ETB)
 * - Query Handlers: State Reading (Get ETB, Get History, Get Eintraege)
 * - Event Handlers: Reaktion auf Domain Events (z.B. automatische ETB-Erstellung)
 * - Mappers: Domain ↔ DTO Transformation
 *
 * **Warum separate Module pro Bounded Context:**
 * - Klare Modul-Grenzen entsprechend DDD
 * - Selektives Testen möglich (nur ETB-Context)
 * - Einfachere Migration zu Microservices
 * - Dependency Injection Scope pro Context
 *
 * @example
 * ```typescript
 * // In Module imports:
 * @Module({
 *   imports: [EtbApplicationModule, EtbInfrastructureModule],
 * })
 * export class EtbModule {}
 * ```
 */
@Module({
  imports: [
    // Event Infrastructure (IEventPublisher)
    // Verwendet LagekarteEventsModule bis dediziertes EtbEventsModule erstellt wird (Story 3.6)
    LagekarteEventsModule,
  ],
  providers: [
    // Command Handlers (Story 3.1 + 3.2)
    CreateEtbHandler,
    AddEintragHandler,
    UpdateEintragHandler,
    DeleteEintragHandler,
    LockEtbHandler,

    // Query Handlers (Story 3.3)
    GetEtbQueryHandler,
    GetEtbHistoryQueryHandler,
    GetEintraegeQueryHandler,

    // Event Handlers (Story 3.6)
    EtbAutoCreationHandler,

    // Mappers (Story 3.3)
    EtbQueryMapper,
  ],
  exports: [
    // Export handlers for use in Infrastructure Layer (Controllers)
    // Command Handlers
    CreateEtbHandler,
    AddEintragHandler,
    UpdateEintragHandler,
    DeleteEintragHandler,
    LockEtbHandler,

    // Query Handlers (Story 3.3)
    GetEtbQueryHandler,
    GetEtbHistoryQueryHandler,
    GetEintraegeQueryHandler,

    // Mappers (Story 3.3)
    EtbQueryMapper,
  ],
})
export class EtbApplicationModule {}
