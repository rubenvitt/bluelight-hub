import { Inject, Injectable, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
// biome-ignore lint/style/useImportType: ILogger needed for DI at runtime
import { ILogger } from '@domain/ports/i-logger.port';
import { ErinnerungAusgeloestEvent } from '@domain/events/erinnerung-ausgeloest.event';
import { LOGGER } from '@infrastructure/di-tokens';
// biome-ignore lint/style/useImportType: ErinnerungGateway needed for DI at runtime
import { ErinnerungGateway } from '@/modules/erinnerung/gateways/erinnerung.gateway';

/**
 * WebSocket Event Adapter fuer ErinnerungAusgeloest Domain Events.
 *
 * **Story 1.5 AC4: WebSocket Event fuer Team-Sync**
 * - Empfaengt ErinnerungAusgeloestEvent via @OnEvent (parallel zum ETB-Adapter)
 * - Konvertiert Domain Event in WebSocket Event
 * - Emittiert `erinnerung.triggered` via ErinnerungGateway
 *
 * **Fire-and-Forget Pattern:**
 * - Fehler werden geloggt, nicht propagiert
 * - WebSocket-Emission darf Trigger-Flow nicht blockieren
 */
@Injectable()
export class ErinnerungWebSocketEventAdapter {
  constructor(
    @Optional() private readonly gateway: ErinnerungGateway | undefined,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  /**
   * Empfaengt ErinnerungAusgeloestEvent und emittiert WebSocket Event.
   *
   * **Event Flow:**
   * 1. OutboxEventPublisher emittiert 'erinnerung.ausgeloest' Event
   * 2. NestJS EventEmitter ruft diese Methode auf (via @OnEvent)
   * 3. Diese Methode emittiert WebSocket Event via ErinnerungGateway
   *
   * @param event - Das empfangene Domain Event
   */
  @OnEvent(ErinnerungAusgeloestEvent.eventName())
  async onErinnerungAusgeloest(event: ErinnerungAusgeloestEvent): Promise<void> {
    this.logger.log(`Processing ErinnerungAusgeloest for WebSocket: erinnerungId=${event.erinnerungId}, einsatzId=${event.einsatzId}`, 'ErinnerungWebSocketEventAdapter');

    // Graceful Degradation: Wenn Gateway nicht verfuegbar, nur loggen
    if (!this.gateway) {
      this.logger.error(
        'ErinnerungGateway not available - WebSocket event will not be emitted. Check module configuration and ensure ErinnerungGateway is properly registered.',
        'ErinnerungWebSocketEventAdapter',
      );
      return;
    }

    // H1 Fix: Race Condition Prevention - Delay to ensure DB commit is completed
    // Wartet 50ms damit die DB Transaction garantiert committed ist bevor WebSocket emittiert wird
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      // WebSocket Event emittieren
      this.gateway.emitErinnerungTriggered({
        erinnerungId: event.erinnerungId.toString(),
        einsatzId: event.einsatzId.toString(),
        titel: event.titel,
        timestamp: event.ausgeloestAm.toISOString(),
      });

      this.logger.log(`WebSocket event emitted for ErinnerungAusgeloest: erinnerungId=${event.erinnerungId}`, 'ErinnerungWebSocketEventAdapter');
    } catch (error) {
      // Fire-and-Forget: Fehler loggen, aber nicht propagieren
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to emit WebSocket event for ErinnerungAusgeloest: erinnerungId=${event.erinnerungId}, error=${errorMessage}`, 'ErinnerungWebSocketEventAdapter');
    }
  }
}
