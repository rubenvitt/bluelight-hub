import { Module } from '@nestjs/common';
import { CreateLagekarteCommandHandler } from './commands/create-lagekarte.handler';
import { AddPoiCommandHandler } from './commands/add-poi.handler';
import { RemovePoiCommandHandler } from './commands/remove-poi.handler';
import { UpdatePoiPositionCommandHandler } from './commands/update-poi-position.handler';

/**
 * NestJS-Modul für Application Layer - Lagekarte Bounded Context.
 *
 * Dieses Modul registriert alle Command-Handler und macht sie über
 * Dependency Injection verfügbar. Ermöglicht Controller (Infrastructure Layer)
 * die Handler zu nutzen, ohne direkt zu importieren (Loose Coupling).
 *
 * Warum separate Module pro Bounded Context: Klare Modul-Grenzen,
 * selektives Testen möglich, einfachere Migration zu Microservices.
 */
@Module({
  providers: [
    // Command Handlers
    CreateLagekarteCommandHandler,
    AddPoiCommandHandler,
    RemovePoiCommandHandler,
    UpdatePoiPositionCommandHandler,
  ],
  exports: [
    // Export handlers for use in Infrastructure Layer (Controllers)
    CreateLagekarteCommandHandler,
    AddPoiCommandHandler,
    RemovePoiCommandHandler,
    UpdatePoiPositionCommandHandler,
  ],
})
export class LagekarteApplicationModule {}
