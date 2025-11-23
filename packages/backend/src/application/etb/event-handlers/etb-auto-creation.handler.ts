/**
 * Automatische ETB-Erstellung bei Einsatz-Erstellung.
 *
 * Dieser Event Handler implementiert das Fire-and-Forget Pattern:
 * Fehler werden geloggt aber NICHT propagiert, um die Einsatz-Erstellung
 * nicht zu blockieren. ETBs können bei Bedarf manuell nacherstellt werden.
 *
 * @module application/etb/event-handlers
 * @see EinsatzCreatedEvent - Trigger Event
 * @see CreateEtbHandler - Delegierter Command Handler
 */
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import type { EinsatzCreatedEvent } from '@domain/events/einsatz-created.event';
// NOTE: CreateEtbHandler needs value import (not type) for NestJS DI to work at runtime
import type { CreateEtbHandler } from '../commands/create-etb/create-etb.handler';
import { CreateEtbCommand } from '../commands/create-etb/create-etb.command';

/**
 * Event Handler für automatische ETB-Erstellung.
 *
 * Lauscht auf 'einsatz.created' Events und erstellt automatisch ein
 * zugehöriges Einsatztagebuch (ETB) für DRK-Compliance.
 *
 * **Fire-and-Forget Pattern:**
 * - Handler-Fehler werden geloggt, aber NICHT propagiert
 * - Einsatz-Erstellung wird NICHT blockiert bei ETB-Fehlern
 * - Idempotent: Duplicate Events werden graceful behandelt
 *
 * **Warum direkte Handler-Injection statt CommandBus:**
 * - Explizite Abhängigkeiten für bessere Testbarkeit
 * - Keine zusätzliche Indirektion über CQRS Bus
 * - Handler kann gemockt werden ohne TestingModule Setup
 */
@Injectable()
export class EtbAutoCreationHandler {
  private readonly logger = new Logger(EtbAutoCreationHandler.name);

  constructor(private readonly createEtbHandler: CreateEtbHandler) {}

  /**
   * Verarbeitet EinsatzCreatedEvent und erstellt automatisch ein ETB.
   *
   * @param event - Das empfangene EinsatzCreatedEvent
   * @returns Promise<void> - Keine Rückgabe (Fire-and-Forget)
   *
   * @example
   * ```typescript
   * // Event wird automatisch via EventEmitter2 dispatched:
   * await eventEmitter.emitAsync('einsatz.created', event);
   * // Handler wird automatisch aufgerufen
   * ```
   */
  @OnEvent('einsatz.created')
  async handle(event: EinsatzCreatedEvent): Promise<void> {
    const einsatzIdValue = event.einsatzId.value;

    this.logger.log(`Auto-creating ETB for Einsatz`, {
      eventId: event.eventId,
      einsatzId: einsatzIdValue,
    });

    try {
      // Command erstellen mit Validierung
      const commandResult = CreateEtbCommand.create(einsatzIdValue);

      if (commandResult.isFailure) {
        this.logger.error(`Failed to create CreateEtbCommand`, {
          eventId: event.eventId,
          einsatzId: einsatzIdValue,
          error: commandResult.error,
        });
        return; // Fire-and-Forget: Nicht propagieren
      }

      // Command ausführen via injiziertem Handler
      // biome-ignore lint/style/noNonNullAssertion: Safe - already checked isFailure above
      const result = await this.createEtbHandler.execute(commandResult.value!);

      if (result.isFailure) {
        // Prüfen ob es sich um ein erwartetes "bereits existiert" handelt
        const errorMessage = result.error ?? '';
        const isAlreadyExists = errorMessage.toLowerCase().includes('already exists') || errorMessage.toLowerCase().includes('bereits');

        if (isAlreadyExists) {
          // Idempotenz: ETB existiert bereits - das ist OK bei at-least-once delivery
          this.logger.warn(`ETB already exists for Einsatz ${einsatzIdValue}, skipping creation`, {
            eventId: event.eventId,
            einsatzId: einsatzIdValue,
          });
        } else {
          // Echter Fehler: Loggen mit vollem Kontext
          this.logger.error(`Failed to create ETB`, {
            eventId: event.eventId,
            einsatzId: einsatzIdValue,
            error: errorMessage,
          });
        }
        return; // Fire-and-Forget: Nicht propagieren
      }

      // Erfolg: ETB wurde erstellt
      // biome-ignore lint/style/noNonNullAssertion: Safe - already checked isFailure above
      const etbId = result.value!;
      this.logger.log(`ETB created successfully`, {
        eventId: event.eventId,
        einsatzId: einsatzIdValue,
        etbId: etbId.value,
      });
    } catch (error) {
      // Unerwarteter Fehler: Mit Stack Trace loggen
      this.logger.error(`Unexpected error during ETB auto-creation`, {
        eventId: event.eventId,
        einsatzId: einsatzIdValue,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Fire-and-Forget: NICHT re-thrown!
    }
  }
}
