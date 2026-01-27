import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ILogger } from '@domain/ports/i-logger.port';
import { LOGGER } from '@infrastructure/di-tokens';
import { EventDeserializer } from '@infrastructure/outbox/event-deserializer';

/**
 * Events die absichtlich keinen Handler haben.
 *
 * Diese Events sind registriert (können serialisiert/deserialisiert werden),
 * haben aber bewusst keine @OnEvent Handler. Gründe können sein:
 * - Event ist für externe Systeme gedacht (z.B. Audit Log Export)
 * - Event ist für zukünftige Features vorbereitet
 * - Event wird nur für Replay/Debugging benötigt
 *
 * **WICHTIG:** Vor dem Hinzufügen eines Events hier, prüfen ob wirklich
 * kein Handler benötigt wird. Im Zweifel lieber einen Handler erstellen.
 */
const EVENTS_WITHOUT_REQUIRED_HANDLER: ReadonlySet<string> = new Set([
  // User Events - aktuell nur für Audit/Logging, keine aktive Verarbeitung
  'user.created',
  'user.deleted',
  'user.role_changed',
  'user.permission_granted',
  'user.permission_revoked',

  // ETB Events - werden intern im ETB-Aggregate verarbeitet, kein externer Handler nötig
  'etb.created',
  'etb.locked',
  'etb.eintrag_added',
  'etb.eintrag_updated',
  'etb.eintrag_deleted',

  // Stammdaten Events - aktuell nur für Audit/Logging
  'StammPersonCreated',
  'StammPersonUpdated',
  'StammFahrzeugCreated',
  'StammFahrzeugUpdated',
  'QualifikationCreated',
  'QualifikationUpdated',
  'FahrzeugtypCreated',
  'FahrzeugtypUpdated',
  'RollenDefinitionCreated',
  'RollenDefinitionUpdated',
  'FunkStatusConfigUpdated',
]);

/**
 * Validiert beim App-Start, dass alle registrierten Events einen Consumer haben.
 *
 * Dieses Service implementiert einen "Dead Letter Detection" Mechanismus:
 * Events die in der Outbox landen aber nie konsumiert werden, sind ein
 * stiller Fehler der schwer zu debuggen ist. Dieser Validator warnt
 * frühzeitig wenn ein Event ohne Handler registriert wurde.
 *
 * **Warum wichtig?**
 * - Events ohne Handler werden in der Outbox publiziert aber nie verarbeitet
 * - Das Outbox-System markiert sie als "PUBLISHED" obwohl nichts passiert
 * - Entwickler bemerken den Fehler erst wenn Features nicht funktionieren
 *
 * **Wie funktioniert es?**
 * 1. Beim App-Start (OnApplicationBootstrap) werden alle registrierten Events geholt
 * 2. Für jedes Event wird geprüft ob mindestens ein @OnEvent Handler existiert
 * 3. Events ohne Handler werden als WARNING geloggt (außer in Whitelist)
 *
 * **Whitelist:**
 * Manche Events haben absichtlich keinen Handler (z.B. für Audit Logs).
 * Diese werden in EVENTS_WITHOUT_REQUIRED_HANDLER definiert.
 *
 * @example
 * ```
 * [WARN] EventConsumerValidator - Events ohne Consumer gefunden:
 *   - user.locked (kein @OnEvent Handler registriert)
 *   - user.unlocked (kein @OnEvent Handler registriert)
 * Bitte Handler erstellen oder zur Whitelist hinzufügen.
 * ```
 */
@Injectable()
export class EventConsumerValidatorService implements OnApplicationBootstrap {
  constructor(
    @Inject(EventEmitter2) private readonly eventEmitter: EventEmitter2,
    private readonly eventDeserializer: EventDeserializer,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  /**
   * Wird beim App-Start aufgerufen, nachdem ALLE Module vollständig initialisiert sind.
   * Zu diesem Zeitpunkt sind alle @OnEvent Handler garantiert registriert.
   *
   * Warum onApplicationBootstrap statt onModuleInit?
   * - onModuleInit wird pro Modul aufgerufen (Reihenfolge unbestimmt)
   * - onApplicationBootstrap wird NACH allen onModuleInit Hooks aufgerufen
   * - Erst dann sind alle Handler im EventEmitter2 registriert
   */
  onApplicationBootstrap(): void {
    // Delay validation to end of event loop to ensure all @OnEvent handlers are registered
    setImmediate(() => this.validateEventConsumers());
  }

  /**
   * Prüft alle registrierten Events auf vorhandene Consumer.
   */
  private validateEventConsumers(): void {
    try {
      const registeredEvents = this.eventDeserializer.getSupportedEventTypes();
      const eventsWithoutConsumer: string[] = [];

      for (const eventName of registeredEvents) {
        // Whitelist-Events überspringen
        if (EVENTS_WITHOUT_REQUIRED_HANDLER.has(eventName)) {
          continue;
        }

        // Prüfen ob mindestens ein Listener registriert ist
        const listenerCount = this.eventEmitter.listenerCount(eventName);
        if (listenerCount === 0) {
          eventsWithoutConsumer.push(eventName);
        }
      }

      // Ergebnis loggen
      if (eventsWithoutConsumer.length > 0) {
        this.logger.warn(
          `Events ohne Consumer gefunden:\n${eventsWithoutConsumer.map((e) => `  - ${e} (kein @OnEvent Handler registriert)`).join('\n')}\nBitte Handler erstellen oder zur Whitelist (EVENTS_WITHOUT_REQUIRED_HANDLER) hinzufügen.`,
        );
      } else {
        this.logger.log('Alle registrierten Events haben mindestens einen Consumer.');
      }
    } catch (error) {
      this.logger.error('Event Consumer Validierung fehlgeschlagen - App startet trotzdem', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Gibt alle Events ohne Consumer zurück (für Tests).
   */
  getEventsWithoutConsumer(): string[] {
    const registeredEvents = this.eventDeserializer.getSupportedEventTypes();
    const eventsWithoutConsumer: string[] = [];

    for (const eventName of registeredEvents) {
      if (EVENTS_WITHOUT_REQUIRED_HANDLER.has(eventName)) {
        continue;
      }

      const listenerCount = this.eventEmitter.listenerCount(eventName);
      if (listenerCount === 0) {
        eventsWithoutConsumer.push(eventName);
      }
    }

    return eventsWithoutConsumer;
  }

  /**
   * Gibt alle registrierten Events zurück (für Tests/Debugging).
   */
  getRegisteredEvents(): string[] {
    return this.eventDeserializer.getSupportedEventTypes();
  }

  /**
   * Gibt die Whitelist-Events zurück (für Tests).
   */
  getWhitelistedEvents(): ReadonlySet<string> {
    return EVENTS_WITHOUT_REQUIRED_HANDLER;
  }
}
