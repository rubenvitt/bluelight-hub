import { Module } from '@nestjs/common';
import { EtbEventAdapter, LagekarteEventAdapter } from './adapters';
import { EtbApplicationModule } from '@application/etb/etb-application.module';
import { LagekarteApplicationModule } from '@application/lagekarte/lagekarte-application.module';
import { LagekarteEventLoggerHandler } from './handlers/lagekarte-event-logger.handler';

/**
 * NestJS Module für Event Adapters (Framework-zu-Application Delegation).
 *
 * Dieses Modul registriert Event Adapters, die @OnEvent Decorator verwenden
 * und an framework-agnostische Application Layer Handler delegieren.
 *
 * **Clean Architecture Event Flow:**
 * 1. Domain Event wird via IEventPublisher publiziert
 * 2. EventEmitter2 triggert @OnEvent in Adapter (dieses Modul)
 * 3. Adapter injiziert Application Handler via Symbol Token
 * 4. Adapter ruft Handler.handle(event) auf
 *
 * **Dependency Flow (keine Zyklen!):**
 * ```
 * EventInfrastructureModule (IEventPublisher)
 *         ↑
 * Application Modules (publizieren Events)
 *         ↑
 * EventAdaptersModule (dieses Modul - importiert Application Modules)
 * ```
 *
 * **Warum Adapters statt direkte @OnEvent in Application Layer:**
 * - Application Layer bleibt framework-agnostisch (kein NestJS @OnEvent)
 * - Event Routing ist Infrastructure-Concern
 * - Einfachere Unit Tests für Application Handler (kein EventEmitter nötig)
 * - Ermöglicht Austausch der Event-Infrastruktur (z.B. zu Message Queue)
 *
 * **Registrierte Adapters:**
 * - EtbEventAdapter: Delegiert ETB-Events an EtbAutoCreationHandler
 * - LagekarteEventAdapter: Delegiert Lagekarte-Events an LagekarteAutoCreationHandler
 * - LagekarteEventLoggerHandler: Infrastructure-spezifisches Event Logging
 */
@Module({
  imports: [
    // Application Modules für Event Handler DI Tokens (einseitige Abhängigkeit!)
    EtbApplicationModule,
    LagekarteApplicationModule,
  ],
  providers: [
    // Event Adapters (delegate @OnEvent to Application Layer Handlers)
    EtbEventAdapter,
    LagekarteEventAdapter,
    // Event Logging Handler (Infrastructure-specific)
    LagekarteEventLoggerHandler,
  ],
})
export class EventAdaptersModule {}
