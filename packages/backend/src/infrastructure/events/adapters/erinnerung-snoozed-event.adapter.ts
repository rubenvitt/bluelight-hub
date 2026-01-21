/**
 * Infrastructure Event Adapter fuer ErinnerungSnoozed Event Handling.
 *
 * Dieser Adapter verbindet NestJS EventEmitter Framework mit dem
 * framework-agnostischen Application Layer Event Handler.
 *
 * **Adapter Pattern:**
 * - Infrastructure Layer (dieser Adapter): @OnEvent Decorator, Framework-spezifisch
 * - Application Layer (ErinnerungSnoozedEventHandler): Pure TypeScript, Framework-agnostisch
 * - Delegation: Adapter delegiert Event Handling an Application Layer via IEventHandler
 *
 * @module infrastructure/events/adapters
 * @see IEventHandler - Domain Port Interface
 * @see ErinnerungSnoozedEventHandler - Application Layer Implementation
 * @see EVENT_HANDLER.ERINNERUNG_SNOOZED_ETB - DI Token
 */
import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEventHandler } from '@domain/ports/i-event-handler.port';
// biome-ignore lint/style/useImportType: ILogger needed for DI at runtime
import { ILogger } from '@domain/ports/i-logger.port';
import { ErinnerungSnoozedEvent } from '@domain/events/erinnerung-snoozed.event';
import { EVENT_HANDLER, LOGGER } from '@infrastructure/di-tokens';

/**
 * NestJS Event Adapter fuer ErinnerungSnoozed ETB-Eintrag Creation.
 *
 * Empfaengt ErinnerungSnoozedEvents via @OnEvent Decorator und delegiert
 * an den Application Layer Handler fuer framework-agnostische Verarbeitung.
 *
 * **Story 2.1:** Automatischer ETB-Eintrag bei Erinnerung-Snooze.
 */
@Injectable()
export class ErinnerungSnoozedEventAdapter {
  constructor(
    @Inject(EVENT_HANDLER.ERINNERUNG_SNOOZED_ETB)
    private readonly handler: IEventHandler<ErinnerungSnoozedEvent>,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  /**
   * Empfaengt ErinnerungSnoozedEvent und delegiert an Application Handler.
   *
   * **Event Flow:**
   * 1. OutboxEventPublisher emittiert 'erinnerung.snoozed' Event
   * 2. NestJS EventEmitter ruft diese Methode auf (via @OnEvent)
   * 3. Methode delegiert an Application Handler via IEventHandler.handle()
   * 4. Application Handler erstellt ETB-Eintrag (Fire-and-Forget)
   *
   * @param event - ErinnerungSnoozedEvent von OutboxEventPublisher
   * @returns Promise<void> - Keine Rueckgabe (delegiert an Handler)
   */
  @OnEvent(ErinnerungSnoozedEvent.eventName())
  async onErinnerungSnoozed(event: ErinnerungSnoozedEvent): Promise<void> {
    this.logger.log(`Received ErinnerungSnoozedEvent`, {
      eventId: event.eventId,
      einsatzId: event.einsatzId.toString(),
      erinnerungId: event.erinnerungId.toString(),
      titel: event.titel,
      snoozedBy: event.snoozedBy.toString(),
      snoozedAt: event.snoozedAt.toISOString(),
      snoozedUntil: event.snoozedUntil.toISOString(),
      snoozeMinutes: event.snoozeMinutes,
      snoozeCount: event.snoozeCount,
      eventName: ErinnerungSnoozedEvent.eventName(),
    });

    // Delegiert an Application Handler (Fire-and-Forget Error Handling im Handler)
    await this.handler.handle(event);
  }
}
