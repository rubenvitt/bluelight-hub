import { Module } from '@nestjs/common';
import { EVENT_HANDLER } from '@infrastructure/di-tokens';
import { CreateLagekarteCommandHandler } from './commands/create-lagekarte.handler';
import { AddPoiCommandHandler } from './commands/add-poi.handler';
import { RemovePoiCommandHandler } from './commands/remove-poi.handler';
import { UpdatePoiPositionCommandHandler } from './commands/update-poi-position.handler';
import { GetLagekarteQueryHandler } from './queries/get-lagekarte.handler';
import { GetPoisQueryHandler } from './queries/get-pois.handler';
import { GetLagekarteExistsQueryHandler } from './queries/get-lagekarte-exists.handler';
import { LagekarteMapper } from './mappers/lagekarte.mapper';
import { PoiMapper } from './mappers/poi.mapper';
import { EventInfrastructureModule } from '@infrastructure/events/event-infrastructure.module';
import { LagekarteInfrastructureModule } from '@infrastructure/lagekarte-infrastructure.module';
import { LagekarteAutoCreationHandler } from './event-handlers';

/**
 * NestJS-Modul für Application Layer - Lagekarte Bounded Context.
 *
 * Dieses Modul registriert alle Command-Handler, Query-Handler, Event-Handler
 * und Mapper und macht sie über Dependency Injection verfügbar. Ermöglicht
 * Controller (Infrastructure Layer) die Handler zu nutzen, ohne direkt zu
 * importieren (Loose Coupling).
 *
 * **CQRS Pattern:**
 * - Command Handlers: State Mutation (Create, Update, Delete)
 * - Query Handlers: State Reading (Get, List, Exists)
 * - Event Handlers: Reaktion auf Domain Events (framework-agnostisch via IEventHandler)
 * - Mappers: Domain ↔ DTO Transformation
 *
 * **Clean Architecture Event Handling:**
 * Event Handlers werden via Symbol Token registriert (EVENT_HANDLER.LAGEKARTE_AUTO_CREATION).
 * Infrastructure Event Adapters delegieren an diese Handlers (siehe LagekarteEventsModule).
 *
 * **Warum separate Module pro Bounded Context:**
 * - Klare Modul-Grenzen entsprechend DDD
 * - Selektives Testen möglich (nur Lagekarte-Context)
 * - Einfachere Migration zu Microservices
 * - Dependency Injection Scope pro Context
 */
@Module({
  imports: [
    // Event Infrastructure (IEventPublisher) - keine zirkuläre Abhängigkeit mehr
    EventInfrastructureModule,
    // Repository Infrastructure (ILagekarteRepository, IEinsatzRepository)
    LagekarteInfrastructureModule,
  ],
  providers: [
    // Command Handlers (State Mutation)
    CreateLagekarteCommandHandler,
    AddPoiCommandHandler,
    RemovePoiCommandHandler,
    UpdatePoiPositionCommandHandler,

    // Query Handlers (State Reading)
    GetLagekarteQueryHandler,
    GetPoisQueryHandler,
    GetLagekarteExistsQueryHandler,

    // Event Handlers (Automatic Creation) - Registered via Symbol Token for Clean Architecture
    {
      provide: EVENT_HANDLER.LAGEKARTE_AUTO_CREATION,
      useClass: LagekarteAutoCreationHandler,
    },

    // Mappers (Domain ↔ DTO)
    LagekarteMapper,
    PoiMapper,
  ],
  exports: [
    // Export handlers for use in Infrastructure Layer (Controllers)
    // Command Handlers
    CreateLagekarteCommandHandler,
    AddPoiCommandHandler,
    RemovePoiCommandHandler,
    UpdatePoiPositionCommandHandler,

    // Query Handlers
    GetLagekarteQueryHandler,
    GetPoisQueryHandler,
    GetLagekarteExistsQueryHandler,

    // Event Handlers (exported via Symbol Token for Infrastructure Adapters)
    EVENT_HANDLER.LAGEKARTE_AUTO_CREATION,
  ],
})
export class LagekarteApplicationModule {}
