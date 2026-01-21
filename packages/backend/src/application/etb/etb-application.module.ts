import { AddEintragHandler, CreateEtbHandler, DeleteEintragHandler, LockEtbHandler, UpdateEintragHandler } from '@application/etb/commands';
import { EVENT_HANDLER, LOGGER } from '@infrastructure/di-tokens';
import { NestLoggerAdapter } from '@infrastructure/common/adapters';
import { EtbInfrastructureModule } from '@infrastructure/etb/etb-infrastructure.module';
import { EventInfrastructureModule } from '@infrastructure/events/event-infrastructure.module';
import { LagekarteInfrastructureModule } from '@infrastructure/lagekarte-infrastructure.module';
import { Module } from '@nestjs/common';
import {
  EtbAutoCreationHandler,
  FahrzeugErfasstEventHandler,
  FmsStatusGeaendertEventHandler,
  EinsatzPersonHinzugefuegtEventHandler,
  PersonFahrzeugZuweisungHandler,
  RolleBesetztEventHandler,
  RolleFreigegebenEventHandler,
  ErinnerungAktualisiertEventHandler,
  ErinnerungGeloeschtEventHandler,
  ErinnerungAusgeloestEventHandler,
  ErinnerungAcknowledgedEventHandler,
  ErinnerungSnoozedEventHandler,
  ErinnerungRetriggeredEventHandler,
} from './event-handlers';
import { EtbQueryMapper } from './mappers';
import { GetEintraegeQueryHandler, GetEtbHistoryQueryHandler, GetEtbQueryHandler, GetTextbausteineHandler } from './queries';

/**
 * ETB Application Module - Event-Driven Architecture
 *
 * Event Flow:
 * 1. Domain Event wird emittiert (z.B. FmsStatusGeaendertEvent)
 * 2. Infrastructure Adapter empfängt Event (@OnEvent decorator)
 * 3. Adapter delegiert an Application Handler
 * 4. Handler erstellt ETB-Eintrag (Fire-and-Forget Pattern)
 */

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
    // Infrastructure Adapters (Cross-cutting concerns)
    {
      provide: LOGGER,
      useFactory: () => new NestLoggerAdapter('ETB'),
    },

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
    // FahrzeugErfasst Event Handler (Story 3-1) - ETB-Eintrag bei Fahrzeug-Erfassung
    {
      provide: EVENT_HANDLER.FAHRZEUG_ERFASST_ETB,
      useClass: FahrzeugErfasstEventHandler,
    },
    // FmsStatusGeaendert Event Handler (Story 3-3) - ETB-Eintrag bei Status-Änderung
    {
      provide: EVENT_HANDLER.FMS_STATUS_GEAENDERT_ETB,
      useClass: FmsStatusGeaendertEventHandler,
    },
    // EinsatzPersonHinzugefuegt Event Handler (Story 4-1) - ETB-Eintrag bei Personen-Registrierung
    {
      provide: EVENT_HANDLER.EINSATZ_PERSON_HINZUGEFUEGT_ETB,
      useClass: EinsatzPersonHinzugefuegtEventHandler,
    },
    // PersonZuFahrzeugZugewiesen Event Handler (Story 4-3) - ETB-Eintrag bei Fahrzeug-Zuweisung
    {
      provide: EVENT_HANDLER.PERSON_ZU_FAHRZEUG_ZUGEWIESEN_ETB,
      useClass: PersonFahrzeugZuweisungHandler,
    },
    // PersonVonFahrzeugEntfernt Event Handler (Story 4-3) - ETB-Eintrag bei Fahrzeug-Entfernung
    {
      provide: EVENT_HANDLER.PERSON_VON_FAHRZEUG_ENTFERNT_ETB,
      useClass: PersonFahrzeugZuweisungHandler,
    },
    // RolleBesetzt Event Handler (Story 5-1) - ETB-Eintrag bei Rollenbesetzung
    {
      provide: EVENT_HANDLER.ROLLE_BESETZT_ETB,
      useClass: RolleBesetztEventHandler,
    },
    // RolleFreigegeben Event Handler (Story 5-1) - ETB-Eintrag bei Rollenfreigabe
    {
      provide: EVENT_HANDLER.ROLLE_FREIGEGEBEN_ETB,
      useClass: RolleFreigegebenEventHandler,
    },
    // ErinnerungAktualisiert Event Handler (Story 1.3 AC5) - ETB-Eintrag bei Erinnerung-Update
    {
      provide: EVENT_HANDLER.ERINNERUNG_AKTUALISIERT_ETB,
      useClass: ErinnerungAktualisiertEventHandler,
    },
    // ErinnerungGeloescht Event Handler (Story 1.4 AC5) - ETB-Eintrag bei Erinnerung-Loeschung
    {
      provide: EVENT_HANDLER.ERINNERUNG_GELOESCHT_ETB,
      useClass: ErinnerungGeloeschtEventHandler,
    },
    // ErinnerungAusgeloest Event Handler (Story 1.5 AC5) - ETB-Eintrag bei Erinnerung-Ausloesung
    {
      provide: EVENT_HANDLER.ERINNERUNG_AUSGELOEST_ETB,
      useClass: ErinnerungAusgeloestEventHandler,
    },
    // ErinnerungAcknowledged Event Handler (Story 1.6 AC5) - ETB-Eintrag bei Erinnerung-Bestaetigung
    {
      provide: EVENT_HANDLER.ERINNERUNG_ACKNOWLEDGED_ETB,
      useClass: ErinnerungAcknowledgedEventHandler,
    },
    // ErinnerungSnoozed Event Handler (Story 2.1) - ETB-Eintrag bei Erinnerung-Snooze
    {
      provide: EVENT_HANDLER.ERINNERUNG_SNOOZED_ETB,
      useClass: ErinnerungSnoozedEventHandler,
    },
    // ErinnerungRetriggered Event Handler (Story 2.2 AC2) - ETB-Eintrag bei erneuter Ausloesung nach Snooze
    {
      provide: EVENT_HANDLER.ERINNERUNG_RETRIGGERED_ETB,
      useClass: ErinnerungRetriggeredEventHandler,
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
    EVENT_HANDLER.FAHRZEUG_ERFASST_ETB,
    EVENT_HANDLER.FMS_STATUS_GEAENDERT_ETB,
    EVENT_HANDLER.EINSATZ_PERSON_HINZUGEFUEGT_ETB,
    EVENT_HANDLER.PERSON_ZU_FAHRZEUG_ZUGEWIESEN_ETB,
    EVENT_HANDLER.PERSON_VON_FAHRZEUG_ENTFERNT_ETB,
    EVENT_HANDLER.ROLLE_BESETZT_ETB,
    EVENT_HANDLER.ROLLE_FREIGEGEBEN_ETB,
    EVENT_HANDLER.ERINNERUNG_AKTUALISIERT_ETB,
    EVENT_HANDLER.ERINNERUNG_GELOESCHT_ETB,
    EVENT_HANDLER.ERINNERUNG_AUSGELOEST_ETB,
    EVENT_HANDLER.ERINNERUNG_ACKNOWLEDGED_ETB,
    EVENT_HANDLER.ERINNERUNG_SNOOZED_ETB,
    EVENT_HANDLER.ERINNERUNG_RETRIGGERED_ETB,

    // Mappers (Story 3.3)
    EtbQueryMapper,
  ],
})
export class EtbApplicationModule {}
