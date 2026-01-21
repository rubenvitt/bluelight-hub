/**
 * Infrastructure Event Adapter fuer ErinnerungErledigt Event Handling.
 *
 * Dieser Adapter verbindet NestJS EventEmitter Framework mit dem
 * framework-agnostischen Application Layer Event Handler.
 *
 * **Adapter Pattern:**
 * - Infrastructure Layer (dieser Adapter): @OnEvent Decorator, Framework-spezifisch
 * - Application Layer (ErinnerungErledigtEventHandler): Pure TypeScript, Framework-agnostisch
 * - Delegation: Adapter delegiert Event Handling an Application Layer via IEventHandler
 *
 * @module infrastructure/events/adapters
 * @see IEventHandler - Domain Port Interface
 * @see ErinnerungErledigtEventHandler - Application Layer Implementation
 * @see EVENT_HANDLER.ERINNERUNG_ERLEDIGT_ETB - DI Token
 */
import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEventHandler } from '@domain/ports/i-event-handler.port';
// biome-ignore lint/style/useImportType: ILogger needed for DI at runtime
import { ILogger } from '@domain/ports/i-logger.port';
import { ErinnerungErledigtEvent } from '@domain/events/erinnerung-erledigt.event';
import { EVENT_HANDLER, LOGGER } from '@infrastructure/di-tokens';

/**
 * NestJS Event Adapter fuer ErinnerungErledigt ETB-Eintrag Creation.
 *
 * Empfaengt ErinnerungErledigtEvents via @OnEvent Decorator und delegiert
 * an den Application Layer Handler fuer framework-agnostische Verarbeitung.
 *
 * **Story 2.5 AC4:** Automatischer ETB-Eintrag bei Erinnerung-Erledigung.
 */
@Injectable()
export class ErinnerungErledigtEventAdapter {
  constructor(
    @Inject(EVENT_HANDLER.ERINNERUNG_ERLEDIGT_ETB)
    private readonly handler: IEventHandler<ErinnerungErledigtEvent>,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  /**
   * Empfaengt ErinnerungErledigtEvent und delegiert an Application Handler.
   *
   * **Event Flow:**
   * 1. OutboxEventPublisher emittiert 'erinnerung.erledigt' Event
   * 2. NestJS EventEmitter ruft diese Methode auf (via @OnEvent)
   * 3. Methode delegiert an Application Handler via IEventHandler.handle()
   * 4. Application Handler erstellt ETB-Eintrag (Fire-and-Forget)
   *
   * @param event - ErinnerungErledigtEvent von OutboxEventPublisher
   * @returns Promise<void> - Keine Rueckgabe (delegiert an Handler)
   */
  @OnEvent(ErinnerungErledigtEvent.eventName())
  async onErinnerungErledigt(event: ErinnerungErledigtEvent): Promise<void> {
    this.logger.log(`Received ErinnerungErledigtEvent`, {
      eventId: event.eventId,
      einsatzId: event.einsatzId.toString(),
      erinnerungId: event.erinnerungId.toString(),
      titel: event.titel,
      erledigtBy: event.erledigtBy.toString(),
      erledigtAm: event.erledigtAm.toISOString(),
      erledigungsNotiz: event.erledigungsNotiz ?? null,
      eventName: ErinnerungErledigtEvent.eventName(),
    });

    // Delegiert an Application Handler (Fire-and-Forget Error Handling im Handler)
    await this.handler.handle(event);
  }
}
