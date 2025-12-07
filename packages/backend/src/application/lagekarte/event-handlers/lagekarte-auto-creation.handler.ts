/**
 * Automatische Lagekarte-Erstellung bei Einsatz-Erstellung.
 *
 * Dieser Event Handler implementiert das Fire-and-Forget Pattern:
 * Fehler werden geloggt aber NICHT propagiert, um die Einsatz-Erstellung
 * nicht zu blockieren. Lagekarten können bei Bedarf manuell nacherstellt werden.
 *
 * **Clean Architecture:**
 * Dieser Handler ist framework-agnostisch und nutzt kein @OnEvent Decorator.
 * Der Infrastructure Layer Event Adapter delegiert an diese Implementation.
 *
 * @module application/lagekarte/event-handlers
 * @see EinsatzCreatedEvent - Trigger Event (Domain Event via Outbox)
 * @see CreateLagekarteCommandHandler - Delegierter Command Handler
 * @see LagekarteEventAdapter - Infrastructure Adapter mit @OnEvent Decorator
 */
import { Injectable, Logger } from '@nestjs/common';
import type { IEventHandler } from '@domain/ports/i-event-handler.port';
import type { EinsatzCreatedEvent } from '@domain/events/einsatz-created.event';
// biome-ignore lint/style/useImportType: CreateLagekarteCommandHandler needed for DI at runtime
import { CreateLagekarteCommandHandler } from '../commands/create-lagekarte.handler';
import { CreateLagekarteCommand } from '../commands/create-lagekarte.command';

/**
 * Event Handler für automatische Lagekarte-Erstellung.
 *
 * Verarbeitet EinsatzCreatedEvents und erstellt automatisch eine zugehörige
 * Lagekarte für jeden neuen Einsatz.
 *
 * **Framework-Agnostisch:**
 * Diese Klasse ist eine reine TypeScript Klasse ohne Framework-Decorators
 * (@OnEvent). Der Infrastructure Layer Event Adapter übernimmt die Integration
 * mit NestJS EventEmitter.
 *
 * **Fire-and-Forget Pattern:**
 * - Handler-Fehler werden geloggt, aber NICHT propagiert
 * - Einsatz-Erstellung wird NICHT blockiert bei Lagekarte-Fehlern
 * - Idempotent: Duplicate Events werden graceful behandelt
 *
 * **Warum direkte Handler-Injection statt CommandBus:**
 * - Explizite Abhängigkeiten für bessere Testbarkeit
 * - Keine zusätzliche Indirektion über CQRS Bus
 * - Handler kann gemockt werden ohne TestingModule Setup
 *
 * **Event Flow (Transactional Outbox Pattern):**
 * 1. CreateEinsatzHandler erstellt Einsatz Aggregate
 * 2. EinsatzCreatedEvent wird atomar in Outbox persistiert
 * 3. OutboxEventPublisher pollt und publiziert Event
 * 4. Infrastructure Adapter empfängt Event via @OnEvent
 * 5. Adapter delegiert an diesen Handler via IEventHandler.handle()
 */
@Injectable()
export class LagekarteAutoCreationHandler implements IEventHandler<EinsatzCreatedEvent> {
  private readonly logger = new Logger(LagekarteAutoCreationHandler.name);

  constructor(private readonly createLagekarteHandler: CreateLagekarteCommandHandler) {}

  /**
   * Verarbeitet EinsatzCreatedEvent und erstellt automatisch eine Lagekarte.
   *
   * Diese Methode wird vom Infrastructure Event Adapter aufgerufen, wenn ein
   * EinsatzCreatedEvent über den EventBus publiziert wurde.
   *
   * @param event - Das empfangene EinsatzCreatedEvent (Domain Event via Outbox)
   * @returns Promise<void> - Keine Rückgabe (Fire-and-Forget)
   *
   * @example
   * ```typescript
   * // Event Flow:
   * // 1. Einsatz wird erstellt → Event in Outbox
   * // 2. OutboxEventPublisher pollt → emitiert 'einsatz.created'
   * // 3. Infrastructure Adapter empfängt via @OnEvent
   * // 4. Adapter ruft handler.handle(event) auf
   * ```
   */
  async handle(event: EinsatzCreatedEvent): Promise<void> {
    // EinsatzId vom Domain Event (Value Object → primitive String)
    const einsatzIdValue = event.einsatzId.value;

    this.logger.log(`Auto-creating Lagekarte for Einsatz`, {
      einsatzId: einsatzIdValue,
      occurredAt: event.occurredAt,
    });

    try {
      // Command erstellen mit Validierung (ohne initialPoi - leere Lagekarte)
      const commandResult = CreateLagekarteCommand.create(einsatzIdValue);

      if (commandResult.isFailure) {
        this.logger.error(`Failed to create CreateLagekarteCommand`, {
          einsatzId: einsatzIdValue,
          error: commandResult.error,
        });
        return; // Fire-and-Forget: Nicht propagieren
      }

      // Command ausführen via injiziertem Handler
      // biome-ignore lint/style/noNonNullAssertion: Safe - already checked isFailure above
      const result = await this.createLagekarteHandler.execute(commandResult.value!);

      if (result.isFailure) {
        // Prüfen ob es sich um ein erwartetes "bereits existiert" handelt
        const errorMessage = result.error ?? '';
        const isAlreadyExists = errorMessage.toLowerCase().includes('already exists') || errorMessage.toLowerCase().includes('bereits');

        if (isAlreadyExists) {
          // Idempotenz: Lagekarte existiert bereits - das ist OK bei at-least-once delivery
          this.logger.warn(`Lagekarte already exists for Einsatz ${einsatzIdValue}, skipping creation`, {
            einsatzId: einsatzIdValue,
          });
        } else {
          // Echter Fehler: Loggen mit vollem Kontext
          this.logger.error(`Failed to create Lagekarte`, {
            einsatzId: einsatzIdValue,
            error: errorMessage,
          });
        }
        return; // Fire-and-Forget: Nicht propagieren
      }

      // Erfolg: Lagekarte wurde erstellt
      // biome-ignore lint/style/noNonNullAssertion: Safe - already checked isFailure above
      const lagekarteId = result.value!;
      this.logger.log(`Lagekarte created successfully`, {
        einsatzId: einsatzIdValue,
        lagekarteId: lagekarteId.value,
      });
    } catch (error) {
      // Unerwarteter Fehler: Mit Stack Trace loggen
      this.logger.error(`Unexpected error during Lagekarte auto-creation`, {
        einsatzId: einsatzIdValue,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Fire-and-Forget: NICHT re-thrown!
    }
  }
}
