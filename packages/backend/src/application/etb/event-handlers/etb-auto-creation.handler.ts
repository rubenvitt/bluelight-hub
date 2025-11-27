/**
 * Automatische ETB-Erstellung bei Einsatz-Erstellung.
 *
 * Dieser Event Handler implementiert das Fire-and-Forget Pattern:
 * Fehler werden geloggt aber NICHT propagiert, um die Einsatz-Erstellung
 * nicht zu blockieren. ETBs können bei Bedarf manuell nacherstellt werden.
 *
 * @module application/etb/event-handlers
 * @see EinsatzErstelltEvent - Trigger Event (Service Layer)
 * @see CreateEtbHandler - Delegierter Command Handler
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import type { EinsatzErstelltEvent } from '@/einsatz/events/einsatz-erstellt.event';
import { CreateEtbHandler } from '../commands/create-etb/create-etb.handler';
import { CreateEtbCommand } from '../commands/create-etb/create-etb.command';

/**
 * Event Handler für automatische ETB-Erstellung.
 *
 * Lauscht auf 'einsatz.erstellt' Events und erstellt automatisch ein
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
 *
 * **Hinweis:** Verwendet Service-Layer Event 'einsatz.erstellt' statt
 * Domain Event 'einsatz.created', da der EinsatzService noch nicht
 * auf DDD migriert ist und EinsatzErstelltEvent emittiert.
 */
@Injectable()
export class EtbAutoCreationHandler {
  private readonly logger = new Logger(EtbAutoCreationHandler.name);

  constructor(@Inject(CreateEtbHandler) private readonly createEtbHandler: CreateEtbHandler) {}

  /**
   * Verarbeitet EinsatzErstelltEvent und erstellt automatisch ein ETB.
   *
   * @param event - Das empfangene EinsatzErstelltEvent (Service Layer Event)
   * @returns Promise<void> - Keine Rückgabe (Fire-and-Forget)
   *
   * @example
   * ```typescript
   * // Event wird automatisch via EventEmitter2 dispatched:
   * eventEmitter.emit('einsatz.erstellt', event);
   * // Handler wird automatisch aufgerufen
   * ```
   */
  @OnEvent('einsatz.erstellt')
  async handle(event: EinsatzErstelltEvent): Promise<void> {
    const einsatzIdValue = event.einsatzId;

    this.logger.log(`Auto-creating ETB for Einsatz`, {
      einsatzId: einsatzIdValue,
      timestamp: event.timestamp,
    });

    try {
      // Command erstellen mit Validierung
      const commandResult = CreateEtbCommand.create(einsatzIdValue);

      if (commandResult.isFailure) {
        this.logger.error(`Failed to create CreateEtbCommand`, {
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
            einsatzId: einsatzIdValue,
          });
        } else {
          // Echter Fehler: Loggen mit vollem Kontext
          this.logger.error(`Failed to create ETB`, {
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
        einsatzId: einsatzIdValue,
        etbId: etbId.value,
      });
    } catch (error) {
      // Unerwarteter Fehler: Mit Stack Trace loggen
      this.logger.error(`Unexpected error during ETB auto-creation`, {
        einsatzId: einsatzIdValue,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Fire-and-Forget: NICHT re-thrown!
    }
  }
}
