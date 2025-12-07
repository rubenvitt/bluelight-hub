import { AddEintragHandler, CreateEtbHandler, DeleteEintragHandler, LockEtbHandler, UpdateEintragHandler } from '@application/etb/commands';
import { EVENT_HANDLER } from '@infrastructure/di-tokens';
import { EtbInfrastructureModule } from '@infrastructure/etb/etb-infrastructure.module';
import { EventInfrastructureModule } from '@infrastructure/events/event-infrastructure.module';
import { LagekarteInfrastructureModule } from '@infrastructure/lagekarte-infrastructure.module';
import { Module } from '@nestjs/common';
import { EtbAutoCreationHandler } from './event-handlers';
import { EtbQueryMapper } from './mappers';
import { GetEintraegeQueryHandler, GetEtbHistoryQueryHandler, GetEtbQueryHandler, GetTextbausteineHandler } from './queries';

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
 * - Event Handlers: Reaktion auf Domain Events (framework-agnostisch via IEventHandler)
 * - Mappers: Domain ↔ DTO Transformation
 *
 * **Clean Architecture Event Handling:**
 * Event Handlers werden via Symbol Token registriert (EVENT_HANDLER.ETB_AUTO_CREATION).
 * Infrastructure Event Adapters delegieren an diese Handlers (siehe LagekarteEventsModule).
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
    // Event Infrastructure (IEventPublisher) - keine zirkuläre Abhängigkeit mehr
    EventInfrastructureModule,
    // Repository Infrastructure (IEtbRepository)
    EtbInfrastructureModule,
    // Repository Infrastructure (IEinsatzRepository) - für Einsatz-Existenz-Prüfung in CreateEtbHandler
    LagekarteInfrastructureModule,
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
    GetTextbausteineHandler,

    // Event Handlers (Story 3.6) - Registered via Symbol Token for Clean Architecture
    {
      provide: EVENT_HANDLER.ETB_AUTO_CREATION,
      useClass: EtbAutoCreationHandler,
    },

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
    GetTextbausteineHandler,

    // Event Handlers (exported via Symbol Token for Infrastructure Adapters)
    EVENT_HANDLER.ETB_AUTO_CREATION,

    // Mappers (Story 3.3)
    EtbQueryMapper,
  ],
})
export class EtbApplicationModule {}
