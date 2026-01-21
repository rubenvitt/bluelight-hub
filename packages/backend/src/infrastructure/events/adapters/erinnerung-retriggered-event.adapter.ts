/**
 * Infrastructure Event Adapter fuer ErinnerungRetriggered Event Handling.
 *
 * Dieser Adapter verbindet NestJS EventEmitter Framework mit dem
 * framework-agnostischen Application Layer Event Handler.
 *
 * **Adapter Pattern:**
 * - Infrastructure Layer (dieser Adapter): @OnEvent Decorator, Framework-spezifisch
 * - Application Layer (ErinnerungRetriggeredEventHandler): Pure TypeScript, Framework-agnostisch
 * - Delegation: Adapter delegiert Event Handling an Application Layer via IEventHandler
 *
 * @module infrastructure/events/adapters
 * @see IEventHandler - Domain Port Interface
 * @see ErinnerungRetriggeredEventHandler - Application Layer Implementation
 * @see EVENT_HANDLER.ERINNERUNG_RETRIGGERED_ETB - DI Token
 */
import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEventHandler } from '@domain/ports/i-event-handler.port';
// biome-ignore lint/style/useImportType: ILogger needed for DI at runtime
import { ILogger } from '@domain/ports/i-logger.port';
import { ErinnerungRetriggeredEvent } from '@domain/events/erinnerung-retriggered.event';
import { EVENT_HANDLER, LOGGER } from '@infrastructure/di-tokens';

/**
 * NestJS Event Adapter fuer ErinnerungRetriggered ETB-Eintrag Creation.
 *
 * Empfaengt ErinnerungRetriggeredEvents via @OnEvent Decorator und delegiert
 * an den Application Layer Handler fuer framework-agnostische Verarbeitung.
 *
 * **Story 2.2 AC2:** Automatischer ETB-Eintrag bei erneuter Erinnerung-Ausloesung nach Snooze.
 */
@Injectable()
export class ErinnerungRetriggeredEventAdapter {
  constructor(
    @Inject(EVENT_HANDLER.ERINNERUNG_RETRIGGERED_ETB)
    private readonly handler: IEventHandler<ErinnerungRetriggeredEvent>,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  /**
   * Empfaengt ErinnerungRetriggeredEvent und delegiert an Application Handler.
   *
   * **Event Flow:**
   * 1. OutboxEventPublisher emittiert 'erinnerung.retriggered' Event
   * 2. NestJS EventEmitter ruft diese Methode auf (via @OnEvent)
   * 3. Methode delegiert an Application Handler via IEventHandler.handle()
   * 4. Application Handler erstellt ETB-Eintrag (Fire-and-Forget)
   *
   * @param event - ErinnerungRetriggeredEvent von OutboxEventPublisher
   * @returns Promise<void> - Keine Rueckgabe (delegiert an Handler)
   */
  @OnEvent(ErinnerungRetriggeredEvent.eventName())
  async onErinnerungRetriggered(event: ErinnerungRetriggeredEvent): Promise<void> {
    this.logger.log(`Received ErinnerungRetriggeredEvent`, {
      eventId: event.eventId,
      einsatzId: event.einsatzId.toString(),
      erinnerungId: event.erinnerungId.toString(),
      titel: event.titel,
      retriggeredAm: event.retriggeredAm.toISOString(),
      snoozeCount: event.snoozeCount,
      previousSnoozedAt: event.previousSnoozedAt?.toISOString() ?? null,
      eventName: ErinnerungRetriggeredEvent.eventName(),
    });

    // Delegiert an Application Handler (Fire-and-Forget Error Handling im Handler)
    await this.handler.handle(event);
  }
}
