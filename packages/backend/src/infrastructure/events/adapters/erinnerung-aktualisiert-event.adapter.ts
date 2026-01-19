/**
 * Infrastructure Event Adapter fuer ErinnerungAktualisiert Event Handling.
 *
 * Dieser Adapter verbindet NestJS EventEmitter Framework mit dem
 * framework-agnostischen Application Layer Event Handler.
 *
 * **Adapter Pattern:**
 * - Infrastructure Layer (dieser Adapter): @OnEvent Decorator, Framework-spezifisch
 * - Application Layer (ErinnerungAktualisiertEventHandler): Pure TypeScript, Framework-agnostisch
 * - Delegation: Adapter delegiert Event Handling an Application Layer via IEventHandler
 *
 * @module infrastructure/events/adapters
 * @see IEventHandler - Domain Port Interface
 * @see ErinnerungAktualisiertEventHandler - Application Layer Implementation
 * @see EVENT_HANDLER.ERINNERUNG_AKTUALISIERT_ETB - DI Token
 */
import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEventHandler } from '@domain/ports/i-event-handler.port';
// biome-ignore lint/style/useImportType: ILogger needed for DI at runtime
import { ILogger } from '@domain/ports/i-logger.port';
import { ErinnerungAktualisiertEvent } from '@domain/events/erinnerung-aktualisiert.event';
import { EVENT_HANDLER, LOGGER } from '@infrastructure/di-tokens';

/**
 * NestJS Event Adapter fuer ErinnerungAktualisiert ETB-Eintrag Creation.
 *
 * Empfaengt ErinnerungAktualisiertEvents via @OnEvent Decorator und delegiert
 * an den Application Layer Handler fuer framework-agnostische Verarbeitung.
 */
@Injectable()
export class ErinnerungAktualisiertEventAdapter {
  constructor(
    @Inject(EVENT_HANDLER.ERINNERUNG_AKTUALISIERT_ETB)
    private readonly handler: IEventHandler<ErinnerungAktualisiertEvent>,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  /**
   * Empfaengt ErinnerungAktualisiertEvent und delegiert an Application Handler.
   *
   * **Event Flow:**
   * 1. OutboxEventPublisher emittiert 'erinnerung.aktualisiert' Event
   * 2. NestJS EventEmitter ruft diese Methode auf (via @OnEvent)
   * 3. Methode delegiert an Application Handler via IEventHandler.handle()
   * 4. Application Handler erstellt ETB-Eintrag (Fire-and-Forget)
   *
   * @param event - ErinnerungAktualisiertEvent von OutboxEventPublisher
   * @returns Promise<void> - Keine Rueckgabe (delegiert an Handler)
   */
  @OnEvent(ErinnerungAktualisiertEvent.eventName())
  async onErinnerungAktualisiert(event: ErinnerungAktualisiertEvent): Promise<void> {
    this.logger.log(`Received ErinnerungAktualisiertEvent`, {
      eventId: event.eventId,
      einsatzId: event.einsatzId.toString(),
      erinnerungId: event.erinnerungId.toString(),
      titel: event.titel,
      aenderungen: event.aenderungen,
      eventName: ErinnerungAktualisiertEvent.eventName(),
    });

    // Delegiert an Application Handler (Fire-and-Forget Error Handling im Handler)
    await this.handler.handle(event);
  }
}
