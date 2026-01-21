/**
 * Infrastructure Event Adapter fuer ErinnerungAcknowledged Event Handling.
 *
 * Dieser Adapter verbindet NestJS EventEmitter Framework mit dem
 * framework-agnostischen Application Layer Event Handler.
 *
 * **Adapter Pattern:**
 * - Infrastructure Layer (dieser Adapter): @OnEvent Decorator, Framework-spezifisch
 * - Application Layer (ErinnerungAcknowledgedEventHandler): Pure TypeScript, Framework-agnostisch
 * - Delegation: Adapter delegiert Event Handling an Application Layer via IEventHandler
 *
 * @module infrastructure/events/adapters
 * @see IEventHandler - Domain Port Interface
 * @see ErinnerungAcknowledgedEventHandler - Application Layer Implementation
 * @see EVENT_HANDLER.ERINNERUNG_ACKNOWLEDGED_ETB - DI Token
 */
import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEventHandler } from '@domain/ports/i-event-handler.port';
// biome-ignore lint/style/useImportType: ILogger needed for DI at runtime
import { ILogger } from '@domain/ports/i-logger.port';
import { ErinnerungAcknowledgedEvent } from '@domain/events/erinnerung-acknowledged.event';
import { EVENT_HANDLER, LOGGER } from '@infrastructure/di-tokens';

/**
 * NestJS Event Adapter fuer ErinnerungAcknowledged ETB-Eintrag Creation.
 *
 * Empfaengt ErinnerungAcknowledgedEvents via @OnEvent Decorator und delegiert
 * an den Application Layer Handler fuer framework-agnostische Verarbeitung.
 *
 * **Story 1.6 AC5:** Automatischer ETB-Eintrag bei Erinnerung-Bestaetigung.
 */
@Injectable()
export class ErinnerungAcknowledgedEventAdapter {
  constructor(
    @Inject(EVENT_HANDLER.ERINNERUNG_ACKNOWLEDGED_ETB)
    private readonly handler: IEventHandler<ErinnerungAcknowledgedEvent>,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  /**
   * Empfaengt ErinnerungAcknowledgedEvent und delegiert an Application Handler.
   *
   * **Event Flow:**
   * 1. OutboxEventPublisher emittiert 'erinnerung.acknowledged' Event
   * 2. NestJS EventEmitter ruft diese Methode auf (via @OnEvent)
   * 3. Methode delegiert an Application Handler via IEventHandler.handle()
   * 4. Application Handler erstellt ETB-Eintrag (Fire-and-Forget)
   *
   * @param event - ErinnerungAcknowledgedEvent von OutboxEventPublisher
   * @returns Promise<void> - Keine Rueckgabe (delegiert an Handler)
   */
  @OnEvent(ErinnerungAcknowledgedEvent.eventName())
  async onErinnerungAcknowledged(event: ErinnerungAcknowledgedEvent): Promise<void> {
    this.logger.log(`Received ErinnerungAcknowledgedEvent`, {
      eventId: event.eventId,
      einsatzId: event.einsatzId.toString(),
      erinnerungId: event.erinnerungId.toString(),
      titel: event.titel,
      acknowledgedBy: event.acknowledgedBy.toString(),
      acknowledgedAm: event.acknowledgedAm.toISOString(),
      eventName: ErinnerungAcknowledgedEvent.eventName(),
    });

    // Delegiert an Application Handler (Fire-and-Forget Error Handling im Handler)
    await this.handler.handle(event);
  }
}
