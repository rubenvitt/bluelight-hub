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
  ErinnerungEskaliertEventAdapter,
  ErinnerungIntensiviertEventAdapter,
  FuehrungsrhythmusAktiviertEventAdapter,
  NotizErstelltEventAdapter,
  NotizAktualisiertEventAdapter,
  NotizGeloeschtEventAdapter,
  BefehlEventAdapter,
  BefehlErstelltEtbEventAdapter,
  BefehlQuittiertEtbEventAdapter,
  BefehlStatusGeaendertEtbEventAdapter,
  BefehlZugestelltEtbEventAdapter,
  RolleGeaendertEtbEventAdapter,
  RolleGeaendertWebsocketEventAdapter,
  BefehlAnonymisiertEtbEventAdapter,
  BefehlGeloeschtEtbEventAdapter,
  AufbewahrungsKonfigurationGeaendertEtbEventAdapter,
  SystemWarnungWebSocketEventAdapter,
  SystemWarnungEtbEventAdapter,
  EinsatzCompletedEtbEventAdapter,
  GefahrenmatrixAktualisiertEtbEventAdapter,
  GefahrenmatrixAktualisiertBroadcastAdapter,
  EinheitErstelltEtbEventAdapter,
  EinheitStatusGeaendertEtbEventAdapter,
  PersonZuEinheitZugewiesenEtbEventAdapter,
  PersonVonEinheitEntferntEtbEventAdapter,
  FahrzeugEinheitZugewiesenEtbEventAdapter,
  LagekarteStateGeaendertWebsocketEventAdapter,
  ZeichenEventAdapter,
  FunkkanalEventAdapter,
  GefahrenzoneEventAdapter,
  EtbFunkspruchBroadcastAdapter,
  NotfallFunkspruchAlertEventAdapter,
  AlarmierungEventAdapter,
  AlarmierungErstelltEtbEventAdapter,
  AlarmierungEmpfaengerHinzugefuegtEtbEventAdapter,
  AlarmierungZeitpunktKorrigiertEtbEventAdapter,
  AlarmierungAbgeschlossenEtbEventAdapter,
  FmsAlarmierungZeitpunktAdapter,
  EigenschutzGefaehrdungsbeurteilungErstelltEventAdapter,
  EigenschutzGefaehrdungsbeurteilungAktualisiertEventAdapter,
  EigenschutzSicherheitsregelAusgerufenEventAdapter,
  EigenschutzSicherheitsregelQuittiertEventAdapter,
  EigenschutzPsaProfilGeaendertEventAdapter,
  EigenschutzQuittungAbgegebenEventAdapter,
  EigenschutzLueckeGemeldetEventAdapter,
  EigenschutzQuittungUeberfaelligEventAdapter,
  EigenschutzKonfliktErkanntEventAdapter,
  EigenschutzKonfliktAufgeloestEventAdapter,
  EigenschutzSicherungspostenEingerichtetEventAdapter,
  EigenschutzSicherungspostenAktualisiertEventAdapter,
  EigenschutzVorfallGemeldetEventAdapter,
  EigenschutzVorfallGeschlossenEventAdapter,
  EigenschutzVorfallExportiertEventAdapter,
  EigenschutzGefaehrdungsbeurteilungErstelltEtbEventAdapter,
  EigenschutzGefaehrdungsbeurteilungAktualisiertEtbEventAdapter,
  EigenschutzSicherheitsregelAusgerufenEtbEventAdapter,
  EigenschutzSicherheitsregelQuittiertEtbEventAdapter,
  EigenschutzPsaProfilGeaendertEtbEventAdapter,
  EigenschutzQuittungAbgegebenEtbEventAdapter,
  EigenschutzLueckeGemeldetEtbEventAdapter,
  EigenschutzQuittungUeberfaelligEtbEventAdapter,
  EigenschutzSicherungspostenEingerichtetEtbEventAdapter,
  EigenschutzSicherungspostenAktualisiertEtbEventAdapter,
  EigenschutzVorfallGemeldetEtbEventAdapter,
  EigenschutzVorfallExportiertEtbEventAdapter,
  EigenschutzKonfliktErkanntEtbEventAdapter,
  EigenschutzKonfliktAufgeloestEtbEventAdapter,
  // TODO: Fix Story 8.1 - Handler für Kategorie-Events fehlen
  // KategorieErstelltEventAdapter,
  // KategorieGeloeschtEventAdapter,
} from './adapters';
import { EtbApplicationModule } from '@application/etb/etb-application.module';
import { FunkkanalApplicationModule } from '@application/funkkanal/funkkanal-application.module';
import { AlarmierungApplicationModule } from '@application/alarmierung/alarmierung-application.module';
import { LagekarteApplicationModule } from '@application/lagekarte/lagekarte-application.module';
import { LagekarteEventLoggerHandler } from './handlers/lagekarte-event-logger.handler';
import { EinsatzEventLoggerHandler } from './handlers/einsatz-event-logger.handler';
import { PatientEventLoggerHandler } from './handlers/patient-event-logger.handler';
import { EventConsumerValidatorService } from './event-consumer-validator.service';
import { LOGGER } from '@infrastructure/di-tokens';
import { NestLoggerAdapter } from '@infrastructure/common/adapters/nest-logger.adapter';
import { ErinnerungModule } from '@/modules/erinnerung/erinnerung.module';
import { BefehlModule } from '@/modules/befehl/befehl.module';
import { LagekarteModule } from '@/modules/lagekarte/lagekarte.module';
import { OutboxModule } from '@infrastructure/outbox/outbox.module';
import { ResilienceModule } from '@infrastructure/resilience/resilience.module';
import { WebsocketModule } from '@infrastructure/websocket/websocket.module';

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
    FunkkanalApplicationModule, // Issue #407: NotfallFunkspruchAlertHandler
    AlarmierungApplicationModule, // Issue #408: Alarmierung-Event-Handler (FMS-Auto-Population)
    // Erinnerung Module für WebSocket Gateway (Story 1.5 AC4)
    ErinnerungModule,
    // Befehl Module für WebSocket Gateway (Story 1.3 AC5)
    BefehlModule,
    // Lagekarte Module für WebSocket Gateway (Issue #638)
    LagekarteModule,
    // OutboxModule für EventDeserializer (Event Consumer Validation)
    OutboxModule,
    // ResilienceModule für Circuit Breaker (Story 4.3: ETB Event Adapters)
    ResilienceModule,
    // WebsocketModule stellt EINSATZ_EVENT_PUBLISHER bereit (Issue #407, Task 18)
    WebsocketModule,
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
    ErinnerungEskaliertEventAdapter, // Story 5.0 AC2: ErinnerungEskaliert ETB-Eintrag
    ErinnerungIntensiviertEventAdapter, // Story 5.0 AC2: ErinnerungIntensiviert ETB-Eintrag
    FuehrungsrhythmusAktiviertEventAdapter, // Story 6.7: FuehrungsrhythmusAktiviert ETB-Eintrag
    NotizErstelltEventAdapter, // Story 7.1: NotizErstellt ETB-Eintrag
    NotizAktualisiertEventAdapter, // Story 7.3: NotizAktualisiert ETB-Eintrag
    NotizGeloeschtEventAdapter, // Story 7.4: NotizGeloescht ETB-Eintrag
    BefehlEventAdapter, // Story 1.3: WebSocket Event Adapter fuer Befehl Domain Events
    BefehlErstelltEtbEventAdapter, // Story 4.3: BefehlErstellt ETB-Eintrag
    BefehlQuittiertEtbEventAdapter, // Story 4.3: BefehlQuittiert ETB-Eintrag
    BefehlStatusGeaendertEtbEventAdapter, // BefehlStatusGeaendert ETB-Eintrag
    BefehlZugestelltEtbEventAdapter, // BefehlZugestellt ETB-Eintrag
    RolleGeaendertEtbEventAdapter, // Story 5.4 AC4: RolleGeaendert ETB-Eintrag
    RolleGeaendertWebsocketEventAdapter, // Story 5.4 AC3: RolleGeaendert WebSocket-Broadcast
    BefehlAnonymisiertEtbEventAdapter, // Story 5.5 AC2: BefehlAnonymisiert ETB-Eintrag
    BefehlGeloeschtEtbEventAdapter, // Story 5.5 AC3: BefehlGeloescht ETB-Eintrag
    AufbewahrungsKonfigurationGeaendertEtbEventAdapter, // Story 5.5 AC1: Konfig-Änderung Audit-Log
    SystemWarnungWebSocketEventAdapter, // Story 5.6 AC3: SystemWarnung WebSocket-Broadcast
    SystemWarnungEtbEventAdapter, // Story 5.6 AC3: SystemWarnung Audit-Log
    EinsatzCompletedEtbEventAdapter, // Issue #581: ETB automatisch sperren bei Einsatz-Abschluss
    GefahrenmatrixAktualisiertEtbEventAdapter, // Issue #414: GefahrenmatrixAktualisiert ETB-Eintrag
    GefahrenmatrixAktualisiertBroadcastAdapter, // Issue #627 G4: GefahrenmatrixAktualisiert WebSocket-Broadcast (Split-View + AKUT-Toast)
    EinheitErstelltEtbEventAdapter, // Issue #411: EinheitErstellt ETB-Eintrag
    EinheitStatusGeaendertEtbEventAdapter, // Issue #411: EinheitStatusGeaendert ETB-Eintrag
    PersonZuEinheitZugewiesenEtbEventAdapter, // Issue #411: PersonZuEinheitZugewiesen ETB-Eintrag
    PersonVonEinheitEntferntEtbEventAdapter, // Issue #411: PersonVonEinheitEntfernt ETB-Eintrag
    FahrzeugEinheitZugewiesenEtbEventAdapter, // Issue #411: FahrzeugEinheitZugewiesen ETB-Eintrag
    LagekarteStateGeaendertWebsocketEventAdapter, // Issue #638: LagekarteStateGeaendert WebSocket-Broadcast
    ZeichenEventAdapter, // Issue #636: Taktische Zeichen WebSocket-Broadcast
    FunkkanalEventAdapter, // Issue #407: Funkkanal-Events WebSocket-Broadcast
    GefahrenzoneEventAdapter, // Issue #627: Gefahrenzone-Events WebSocket-Broadcast
    EtbFunkspruchBroadcastAdapter, // Issue #407: Funkspruch-ETB-Einträge WebSocket-Broadcast
    NotfallFunkspruchAlertEventAdapter, // Issue #407: Notfall-Funkspruch Alert-Publisher
    AlarmierungEventAdapter, // Issue #408: Alarmierung-Events WebSocket-Broadcast
    AlarmierungErstelltEtbEventAdapter, // Issue #408: AlarmierungErstellt → ETB-Eintrag
    AlarmierungEmpfaengerHinzugefuegtEtbEventAdapter, // Issue #408: AlarmierungEmpfaengerHinzugefuegt → ETB-Eintrag
    AlarmierungZeitpunktKorrigiertEtbEventAdapter, // Issue #408: AlarmierungZeitpunktKorrigiert → ETB-Eintrag
    AlarmierungAbgeschlossenEtbEventAdapter, // Issue #408: AlarmierungAbgeschlossen → ETB-Eintrag
    FmsAlarmierungZeitpunktAdapter, // Issue #408: FMS-Status → Alarmierung Auto-Population
    EigenschutzGefaehrdungsbeurteilungErstelltEventAdapter, // Story 2.1: GefaehrdungsbeurteilungErstellt Log-Adapter (4-Stellen-Registry)
    EigenschutzGefaehrdungsbeurteilungAktualisiertEventAdapter, // Story 2.2: GefaehrdungsbeurteilungAktualisiert Log-Adapter (4-Stellen-Registry)
    EigenschutzSicherheitsregelAusgerufenEventAdapter, // Story 2.6: SicherheitsregelAusgerufen Log-Adapter (4-Stellen-Registry)
    EigenschutzSicherheitsregelQuittiertEventAdapter, // Story 2.7: SicherheitsregelQuittiert Log+Broadcast-Adapter (4-Stellen-Registry)
    EigenschutzPsaProfilGeaendertEventAdapter, // Story 3.1: PsaProfilGeaendert Log+Broadcast-Adapter (4-Stellen-Registry)
    EigenschutzQuittungAbgegebenEventAdapter, // Story 3.4: QuittungAbgegeben Log+Broadcast-Adapter (4-Stellen-Registry)
    EigenschutzLueckeGemeldetEventAdapter, // Story 3.6: LueckeGemeldet Log+Broadcast-Adapter (4-Stellen-Registry)
    EigenschutzQuittungUeberfaelligEventAdapter, // Story 3.7: QuittungUeberfaellig Log+Broadcast-Adapter (4-Stellen-Registry)
    EigenschutzKonfliktErkanntEventAdapter, // Story 3.9: KonfliktErkannt Log+Broadcast-Adapter (4-Stellen-Registry)
    EigenschutzKonfliktAufgeloestEventAdapter, // Story 3.10: KonfliktAufgeloest Log+Broadcast-Adapter (4-Stellen-Registry)
    EigenschutzSicherungspostenEingerichtetEventAdapter, // Story 4.1: SicherungspostenEingerichtet Log-Adapter (4-Stellen-Registry)
    EigenschutzSicherungspostenAktualisiertEventAdapter, // Story 4.1: SicherungspostenAktualisiert Log-Adapter (4-Stellen-Registry)
    EigenschutzVorfallGemeldetEventAdapter, // Story 5.1: VorfallGemeldet Log-Adapter (4-Stellen-Registry)
    EigenschutzVorfallGeschlossenEventAdapter, // Issue #415: VorfallGeschlossen Log-Adapter (4-Stellen-Registry)
    EigenschutzVorfallExportiertEventAdapter, // Story 5.6: VorfallExportiert Log-Adapter (4-Stellen-Registry)
    EigenschutzGefaehrdungsbeurteilungErstelltEtbEventAdapter, // Issue 415: GefaehrdungsbeurteilungErstellt → ETB
    EigenschutzGefaehrdungsbeurteilungAktualisiertEtbEventAdapter, // Issue 415: GefaehrdungsbeurteilungAktualisiert → ETB
    EigenschutzSicherheitsregelAusgerufenEtbEventAdapter, // Issue 415: SicherheitsregelAusgerufen → ETB
    EigenschutzSicherheitsregelQuittiertEtbEventAdapter, // Issue 415: SicherheitsregelQuittiert → ETB
    EigenschutzPsaProfilGeaendertEtbEventAdapter, // Issue 415: PsaProfilGeaendert → ETB
    EigenschutzQuittungAbgegebenEtbEventAdapter, // Issue 415: QuittungAbgegeben → ETB
    EigenschutzLueckeGemeldetEtbEventAdapter, // Issue 415: LueckeGemeldet → ETB
    EigenschutzQuittungUeberfaelligEtbEventAdapter, // Issue 415: QuittungUeberfaellig → ETB
    EigenschutzSicherungspostenEingerichtetEtbEventAdapter, // Issue 415: SicherungspostenEingerichtet → ETB
    EigenschutzSicherungspostenAktualisiertEtbEventAdapter, // Issue 415: SicherungspostenAktualisiert → ETB
    EigenschutzVorfallGemeldetEtbEventAdapter, // Issue 415: VorfallGemeldet → ETB
    EigenschutzVorfallExportiertEtbEventAdapter, // Issue 415: VorfallExportiert → ETB
    EigenschutzKonfliktErkanntEtbEventAdapter, // Issue 415: KonfliktErkannt → ETB
    EigenschutzKonfliktAufgeloestEtbEventAdapter, // Issue 415: KonfliktAufgeloest → ETB
    // TODO: Fix Story 8.1 - Handler für Kategorie-Events fehlen
    // KategorieErstelltEventAdapter, // Story 8.1: KategorieErstellt ETB-Eintrag
    // KategorieGeloeschtEventAdapter, // Story 8.1: KategorieGeloescht ETB-Eintrag
    // Event Logging Handler (Infrastructure-specific)
    LagekarteEventLoggerHandler,
    EinsatzEventLoggerHandler,
    PatientEventLoggerHandler, // Story 1.2: PatientErfasst Audit-Logger (WS-Broadcast folgt in Story 3.1)
    // Event Consumer Validation - prüft beim Start ob alle Events Handler haben
    EventConsumerValidatorService,
  ],
})
export class EventAdaptersModule {}
