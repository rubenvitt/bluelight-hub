/**
 * Infrastructure Event Adapter fuer ErinnerungAusgeloest Event Handling.
 *
 * Dieser Adapter verbindet NestJS EventEmitter Framework mit dem
 * framework-agnostischen Application Layer Event Handler.
 *
 * **Adapter Pattern:**
 * - Infrastructure Layer (dieser Adapter): @OnEvent Decorator, Framework-spezifisch
 * - Application Layer (ErinnerungAusgeloestEventHandler): Pure TypeScript, Framework-agnostisch
 * - Delegation: Adapter delegiert Event Handling an Application Layer via IEventHandler
 *
 * @module infrastructure/events/adapters
 * @see IEventHandler - Domain Port Interface
 * @see ErinnerungAusgeloestEventHandler - Application Layer Implementation
 * @see EVENT_HANDLER.ERINNERUNG_AUSGELOEST_ETB - DI Token
 */
import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEventHandler } from '@domain/ports/i-event-handler.port';
// biome-ignore lint/style/useImportType: ILogger needed for DI at runtime
import { ILogger } from '@domain/ports/i-logger.port';
import { ErinnerungAusgeloestEvent } from '@domain/events/erinnerung-ausgeloest.event';
import { EVENT_HANDLER, LOGGER } from '@infrastructure/di-tokens';

/**
 * NestJS Event Adapter fuer ErinnerungAusgeloest ETB-Eintrag Creation.
 *
 * Empfaengt ErinnerungAusgeloestEvents via @OnEvent Decorator und delegiert
 * an den Application Layer Handler fuer framework-agnostische Verarbeitung.
 *
 * **Story 1.5 AC5:** Automatischer ETB-Eintrag bei Erinnerung-Ausloesung.
 */
@Injectable()
export class ErinnerungAusgeloestEventAdapter {
  constructor(
    @Inject(EVENT_HANDLER.ERINNERUNG_AUSGELOEST_ETB)
    private readonly handler: IEventHandler<ErinnerungAusgeloestEvent>,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  /**
   * Empfaengt ErinnerungAusgeloestEvent und delegiert an Application Handler.
   *
   * **Event Flow:**
   * 1. OutboxEventPublisher emittiert 'erinnerung.ausgeloest' Event
   * 2. NestJS EventEmitter ruft diese Methode auf (via @OnEvent)
   * 3. Methode delegiert an Application Handler via IEventHandler.handle()
   * 4. Application Handler erstellt ETB-Eintrag (Fire-and-Forget)
   *
   * @param event - ErinnerungAusgeloestEvent von OutboxEventPublisher
   * @returns Promise<void> - Keine Rueckgabe (delegiert an Handler)
   */
  @OnEvent(ErinnerungAusgeloestEvent.eventName())
  async onErinnerungAusgeloest(event: ErinnerungAusgeloestEvent): Promise<void> {
    this.logger.log(`Received ErinnerungAusgeloestEvent`, {
      eventId: event.eventId,
      einsatzId: event.einsatzId.toString(),
      erinnerungId: event.erinnerungId.toString(),
      titel: event.titel,
      erstelltVon: event.erstelltVon.toString(),
      ausgeloestAm: event.ausgeloestAm.toISOString(),
      eventName: ErinnerungAusgeloestEvent.eventName(),
    });

    // Delegiert an Application Handler (Fire-and-Forget Error Handling im Handler)
    await this.handler.handle(event);
  }
}
