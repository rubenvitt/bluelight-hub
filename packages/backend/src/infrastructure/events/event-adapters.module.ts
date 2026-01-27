import { Module } from '@nestjs/common';
import {
  EtbEventAdapter,
  LagekarteEventAdapter,
  FahrzeugErfasstEventAdapter,
  FmsStatusGeaendertEventAdapter,
  EinsatzPersonHinzugefuegtEventAdapter,
  PersonFahrzeugZuweisungEventAdapter,
  RolleBesetztEventAdapter,
  RolleFreigegebenEventAdapter,
  ErinnerungAktualisiertEventAdapter,
  ErinnerungGeloeschtEventAdapter,
  ErinnerungAusgeloestEventAdapter,
  ErinnerungAcknowledgedEventAdapter,
  ErinnerungSnoozedEventAdapter,
  ErinnerungRetriggeredEventAdapter,
  ErinnerungErledigtEventAdapter,
} from './adapters';
import { EtbApplicationModule } from '@application/etb/etb-application.module';
import { LagekarteApplicationModule } from '@application/lagekarte/lagekarte-application.module';
import { LagekarteEventLoggerHandler } from './handlers/lagekarte-event-logger.handler';
import { EinsatzEventLoggerHandler } from './handlers/einsatz-event-logger.handler';
import { EventConsumerValidatorService } from './event-consumer-validator.service';
import { LOGGER } from '@infrastructure/di-tokens';
import { NestLoggerAdapter } from '@infrastructure/common/adapters/nest-logger.adapter';
import { ErinnerungModule } from '@/modules/erinnerung/erinnerung.module';
import { OutboxModule } from '@infrastructure/outbox/outbox.module';

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
 * **WICHTIG - Dependency Ordering:**
 * Dieses Modul MUSS NACH allen Application Modules initialisiert werden,
 * da es deren Event Handler injiziert. NestJS garantiert dies durch die
 * Module-Import-Reihenfolge in AppModule:
 * 1. EtbApplicationModule (exportiert Handler)
 * 2. LagekarteApplicationModule (exportiert Handler)
 * 3. EventAdaptersModule (importiert obige Module → injiziert Handler)
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
 * - FahrzeugErfasstEventAdapter: Delegiert FahrzeugErfasst-Events an Handler
 * - FmsStatusGeaendertEventAdapter: Delegiert FmsStatusGeaendert-Events an ETB Handler
 * - EinsatzPersonHinzugefuegtEventAdapter: Delegiert EinsatzPersonHinzugefuegt-Events an ETB Handler
 * - PersonFahrzeugZuweisungEventAdapter: Delegiert Person-Fahrzeug-Zuweisung/Entfernung-Events an ETB Handler (Story 4-3)
 * - RolleBesetztEventAdapter: Delegiert RolleBesetzt-Events an ETB Handler (Story 5-1)
 * - RolleFreigegebenEventAdapter: Delegiert RolleFreigegeben-Events an ETB Handler (Story 5-1)
 * - LagekarteEventLoggerHandler: Infrastructure-spezifisches Event Logging
 * - EinsatzEventLoggerHandler: Infrastructure-spezifisches Event Logging für Einsatz-Events
 */
@Module({
  imports: [
    // Application Modules für Event Handler DI Tokens (einseitige Abhängigkeit!)
    EtbApplicationModule,
    LagekarteApplicationModule,
    // Erinnerung Module für WebSocket Gateway (Story 1.5 AC4)
    ErinnerungModule,
    // OutboxModule für EventDeserializer (Event Consumer Validation)
    OutboxModule,
  ],
  providers: [
    // Logger für Event Adapters (Infrastructure Logging)
    {
      provide: LOGGER,
      useFactory: () => new NestLoggerAdapter('EventAdapters'),
    },
    // Event Adapters (delegate @OnEvent to Application Layer Handlers)
    EtbEventAdapter,
    LagekarteEventAdapter,
    FahrzeugErfasstEventAdapter,
    FmsStatusGeaendertEventAdapter,
    EinsatzPersonHinzugefuegtEventAdapter,
    PersonFahrzeugZuweisungEventAdapter, // Story 4-3: Person-Fahrzeug-Zuweisung/Entfernung
    RolleBesetztEventAdapter, // Story 5-1: RolleBesetzt ETB-Eintrag
    RolleFreigegebenEventAdapter, // Story 5-1: RolleFreigegeben ETB-Eintrag
    ErinnerungAktualisiertEventAdapter, // Story 1.3 AC5: ErinnerungAktualisiert ETB-Eintrag
    ErinnerungGeloeschtEventAdapter, // Story 1.4 AC5: ErinnerungGeloescht ETB-Eintrag
    ErinnerungAusgeloestEventAdapter, // Story 1.5 AC5: ErinnerungAusgeloest ETB-Eintrag
    ErinnerungAcknowledgedEventAdapter, // Story 1.6 AC5: ErinnerungAcknowledged ETB-Eintrag
    ErinnerungSnoozedEventAdapter, // Story 2.1: ErinnerungSnoozed ETB-Eintrag
    ErinnerungRetriggeredEventAdapter, // Story 2.2 AC2: ErinnerungRetriggered ETB-Eintrag
    ErinnerungErledigtEventAdapter, // Story 2.5 AC4: ErinnerungErledigt ETB-Eintrag
    // Event Logging Handler (Infrastructure-specific)
    LagekarteEventLoggerHandler,
    EinsatzEventLoggerHandler,
    // Event Consumer Validation - prüft beim Start ob alle Events Handler haben
    EventConsumerValidatorService,
  ],
})
export class EventAdaptersModule {}
