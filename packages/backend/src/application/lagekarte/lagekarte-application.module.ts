import { Module } from '@nestjs/common';
import { CreateLagekarteCommandHandler } from './commands/create-lagekarte.handler';
import { AddPoiCommandHandler } from './commands/add-poi.handler';
import { RemovePoiCommandHandler } from './commands/remove-poi.handler';
import { UpdatePoiPositionCommandHandler } from './commands/update-poi-position.handler';
import { GetLagekarteQueryHandler } from './queries/get-lagekarte.handler';
import { GetPoisQueryHandler } from './queries/get-pois.handler';
import { GetLagekarteExistsQueryHandler } from './queries/get-lagekarte-exists.handler';
import { LagekarteMapper } from './mappers/lagekarte.mapper';
import { PoiMapper } from './mappers/poi.mapper';

/**
 * NestJS-Modul für Application Layer - Lagekarte Bounded Context.
 *
 * Dieses Modul registriert alle Command-Handler, Query-Handler und Mapper
 * und macht sie über Dependency Injection verfügbar. Ermöglicht Controller
 * (Infrastructure Layer) die Handler zu nutzen, ohne direkt zu importieren
 * (Loose Coupling).
 *
 * **CQRS Pattern:**
 * - Command Handlers: State Mutation (Create, Update, Delete)
 * - Query Handlers: State Reading (Get, List, Exists)
 * - Mappers: Domain ↔ DTO Transformation
 *
 * **Warum separate Module pro Bounded Context:**
 * - Klare Modul-Grenzen entsprechend DDD
 * - Selektives Testen möglich (nur Lagekarte-Context)
 * - Einfachere Migration zu Microservices
 * - Dependency Injection Scope pro Context
 */
@Module({
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
  ],
})
export class LagekarteApplicationModule {}
