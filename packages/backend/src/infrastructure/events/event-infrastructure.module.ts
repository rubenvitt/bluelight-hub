import { Module } from '@nestjs/common';
import { EventEmitterPublisher } from './event-emitter-publisher';
import { EVENT_PUBLISHER } from '@infrastructure/di-tokens';

/**
 * NestJS Module für Event Publishing Infrastructure.
 *
 * Dieses Modul stellt NUR den IEventPublisher bereit - keine Event Handlers
 * oder Adapters. Es hat KEINE Abhängigkeiten zu Application Modules.
 *
 * **Voraussetzung:**
 * EventEmitterModule.forRoot() muss in AppModule importiert sein.
 * Dieses Modul importiert es NICHT selbst, um doppelte Initialisierung zu vermeiden.
 *
 * **Clean Architecture:**
 * - Dieses Modul wird von Application Modules importiert
 * - Application Modules können Events publishen ohne zirkuläre Abhängigkeiten
 * - Event Adapters (in EventAdaptersModule) importieren Application Modules einseitig
 *
 * **Dependency Flow:**
 * ```
 * EventInfrastructureModule (dieses Modul)
 *         ↑
 * Application Modules (importieren für IEventPublisher)
 *         ↑
 * EventAdaptersModule (importiert Application Modules für Handler)
 * ```
 *
 * **Warum separate Module:**
 * Verhindert zirkuläre Abhängigkeiten:
 * - VORHER: AppModule → EventsModule → AppModule (Zyklus!)
 * - NACHHER: AppModule → EventInfrastructureModule (kein Zyklus)
 *            EventAdaptersModule → AppModule (einseitig)
 */
@Module({
  providers: [
    {
      provide: EVENT_PUBLISHER,
      useClass: EventEmitterPublisher,
    },
  ],
  exports: [EVENT_PUBLISHER],
})
export class EventInfrastructureModule {}
