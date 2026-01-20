/**
 * Infrastructure Event Adapter fuer ErinnerungGeloescht Event Handling.
 *
 * Dieser Adapter verbindet NestJS EventEmitter Framework mit dem
 * framework-agnostischen Application Layer Event Handler.
 *
 * **Adapter Pattern:**
 * - Infrastructure Layer (dieser Adapter): @OnEvent Decorator, Framework-spezifisch
 * - Application Layer (ErinnerungGeloeschtEventHandler): Pure TypeScript, Framework-agnostisch
 * - Delegation: Adapter delegiert Event Handling an Application Layer via IEventHandler
 *
 * @module infrastructure/events/adapters
 * @see IEventHandler - Domain Port Interface
 * @see ErinnerungGeloeschtEventHandler - Application Layer Implementation
 * @see EVENT_HANDLER.ERINNERUNG_GELOESCHT_ETB - DI Token
 */
import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEventHandler } from '@domain/ports/i-event-handler.port';
// biome-ignore lint/style/useImportType: ILogger needed for DI at runtime
import { ILogger } from '@domain/ports/i-logger.port';
import { ErinnerungGeloeschtEvent } from '@domain/events/erinnerung-geloescht.event';
import { EVENT_HANDLER, LOGGER } from '@infrastructure/di-tokens';

/**
 * NestJS Event Adapter fuer ErinnerungGeloescht ETB-Eintrag Creation.
 *
 * Empfaengt ErinnerungGeloeschtEvents via @OnEvent Decorator und delegiert
 * an den Application Layer Handler fuer framework-agnostische Verarbeitung.
 *
 * **Story 1.4 AC5:** Automatischer ETB-Eintrag bei Erinnerung-Loeschung.
 */
@Injectable()
export class ErinnerungGeloeschtEventAdapter {
  constructor(
    @Inject(EVENT_HANDLER.ERINNERUNG_GELOESCHT_ETB)
    private readonly handler: IEventHandler<ErinnerungGeloeschtEvent>,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  /**
   * Empfaengt ErinnerungGeloeschtEvent und delegiert an Application Handler.
   *
   * **Event Flow:**
   * 1. OutboxEventPublisher emittiert 'erinnerung.geloescht' Event
   * 2. NestJS EventEmitter ruft diese Methode auf (via @OnEvent)
   * 3. Methode delegiert an Application Handler via IEventHandler.handle()
   * 4. Application Handler erstellt ETB-Eintrag (Fire-and-Forget)
   *
   * @param event - ErinnerungGeloeschtEvent von OutboxEventPublisher
   * @returns Promise<void> - Keine Rueckgabe (delegiert an Handler)
   */
  @OnEvent(ErinnerungGeloeschtEvent.eventName())
  async onErinnerungGeloescht(event: ErinnerungGeloeschtEvent): Promise<void> {
    this.logger.log(`Received ErinnerungGeloeschtEvent`, {
      eventId: event.eventId,
      einsatzId: event.einsatzId.toString(),
      erinnerungId: event.erinnerungId.toString(),
      titel: event.titel,
      geloeschtVon: event.geloeschtVon.toString(),
      eventName: ErinnerungGeloeschtEvent.eventName(),
    });

    // Delegiert an Application Handler (Fire-and-Forget Error Handling im Handler)
    await this.handler.handle(event);
  }
}
