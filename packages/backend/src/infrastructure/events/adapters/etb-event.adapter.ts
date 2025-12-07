/**
 * Infrastructure Event Adapter für ETB Event Handling.
 *
 * Dieser Adapter verbindet NestJS EventEmitter Framework mit dem
 * framework-agnostischen Application Layer Event Handler.
 *
 * **Adapter Pattern:**
 * - Infrastructure Layer (dieser Adapter): @OnEvent Decorator, Framework-spezifisch
 * - Application Layer (EtbAutoCreationHandler): Pure TypeScript, Framework-agnostisch
 * - Delegation: Adapter delegiert Event Handling an Application Layer via IEventHandler
 *
 * **Warum diese Trennung:**
 * - Clean Architecture: Application Layer hat keine Framework-Abhängigkeiten
 * - Testbarkeit: Application Handler kann ohne NestJS TestingModule getestet werden
 * - Dependency Inversion: Application hängt von Interface (IEventHandler) ab
 * - Framework-Austauschbarkeit: Bei Framework-Wechsel nur Adapter ändern
 *
 * @module infrastructure/events/adapters
 * @see IEventHandler - Domain Port Interface
 * @see EtbAutoCreationHandler - Application Layer Implementation
 * @see EVENT_HANDLER.ETB_AUTO_CREATION - DI Token
 */
import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { IEventHandler } from '@domain/ports/i-event-handler.port';
import { EinsatzCreatedEvent } from '@domain/events/einsatz-created.event';
import { EVENT_HANDLER } from '@infrastructure/di-tokens';

/**
 * NestJS Event Adapter für ETB Auto-Creation.
 *
 * Empfängt EinsatzCreatedEvents via @OnEvent Decorator und delegiert
 * an den Application Layer Handler für framework-agnostische Verarbeitung.
 *
 * **Dependency Injection:**
 * Der Application Handler wird via Symbol Token injiziert (nicht direkte Klasse),
 * um die Entkopplung zu maximieren und Testbarkeit zu verbessern.
 *
 * @example
 * ```typescript
 * // Module Registration:
 * @Module({
 *   providers: [
 *     {
 *       provide: EVENT_HANDLER.ETB_AUTO_CREATION,
 *       useClass: EtbAutoCreationHandler,
 *     },
 *     EtbEventAdapter,
 *   ],
 * })
 * export class LagekarteEventsModule {}
 * ```
 */
@Injectable()
export class EtbEventAdapter {
  constructor(
    @Inject(EVENT_HANDLER.ETB_AUTO_CREATION)
    private readonly handler: IEventHandler<EinsatzCreatedEvent>,
  ) {}

  /**
   * Empfängt EinsatzCreatedEvent und delegiert an Application Handler.
   *
   * Diese Methode ist der einzige Framework-Einstiegspunkt. Die eigentliche
   * Business Logic befindet sich im Application Layer Handler.
   *
   * **Event Flow:**
   * 1. OutboxEventPublisher emittiert 'einsatz.created' Event
   * 2. NestJS EventEmitter ruft diese Methode auf (via @OnEvent)
   * 3. Methode delegiert an Application Handler via IEventHandler.handle()
   * 4. Application Handler führt Business Logic aus (Fire-and-Forget)
   *
   * @param event - EinsatzCreatedEvent von OutboxEventPublisher
   * @returns Promise<void> - Keine Rückgabe (delegiert an Handler)
   */
  @OnEvent(EinsatzCreatedEvent.eventName())
  async onEinsatzCreated(event: EinsatzCreatedEvent): Promise<void> {
    await this.handler.handle(event);
  }
}
