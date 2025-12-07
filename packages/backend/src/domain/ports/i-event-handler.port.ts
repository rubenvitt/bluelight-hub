/**
 * Event Handler Port - Hexagonal Architecture Port für Domain Event Handling.
 *
 * Dieses Interface definiert die Abstraktion für Event Handler im Domain/Application Layer.
 * Durch die Verwendung dieses Interfaces können Event Handler framework-agnostisch
 * implementiert werden (keine @OnEvent Decorator-Abhängigkeit).
 *
 * **Warum dieser Port:**
 * - Framework-Unabhängigkeit: Application Layer nutzt nur TypeScript Interfaces
 * - Dependency Inversion: Infrastructure adaptiert Domain-Events zu Framework-Events
 * - Testbarkeit: Handler können ohne NestJS TestingModule getestet werden
 * - Clean Architecture: Keine NestJS-spezifischen Decorators in Application Layer
 *
 * **Adapter Pattern:**
 * 1. Application Layer implementiert IEventHandler<TEvent>
 * 2. Infrastructure Layer erstellt Adapter mit @OnEvent Decorator
 * 3. Adapter delegiert an Application Layer Handler via DI
 *
 * @example
 * ```typescript
 * // Application Layer (clean):
 * @Injectable()
 * export class EtbAutoCreationHandler implements IEventHandler<EinsatzCreatedEvent> {
 *   async handle(event: EinsatzCreatedEvent): Promise<void> {
 *     // Pure business logic
 *   }
 * }
 *
 * // Infrastructure Layer (adapter):
 * @Injectable()
 * export class EtbEventAdapter {
 *   constructor(
 *     @Inject(DI_TOKENS.EVENT_HANDLERS.ETB_AUTO_CREATION)
 *     private readonly handler: IEventHandler<EinsatzCreatedEvent>
 *   ) {}
 *
 *   @OnEvent(EinsatzCreatedEvent.eventName())
 *   async onEinsatzCreated(event: EinsatzCreatedEvent): Promise<void> {
 *     await this.handler.handle(event);
 *   }
 * }
 * ```
 *
 * @module domain/ports
 * @see IEventPublisher - Port für Event Publishing
 */

/**
 * Interface für Domain Event Handler.
 *
 * Event Handler sind zustandslos und verarbeiten genau einen Event-Typ.
 * Sie können fehlschlagen (throw) oder Errors loggen (Fire-and-Forget).
 *
 * @typeParam TEvent - Der Domain Event Type (z.B. EinsatzCreatedEvent)
 */
export interface IEventHandler<TEvent> {
  /**
   * Verarbeitet einen Domain Event.
   *
   * Diese Methode wird vom Infrastructure Adapter aufgerufen, wenn ein
   * entsprechender Event über den EventBus publiziert wurde.
   *
   * **Error Handling:**
   * - Fire-and-Forget: Errors loggen, aber nicht re-thrown
   * - Critical: Errors re-thrown für Retry-Mechanismus
   *
   * @param event - Der zu verarbeitende Domain Event
   * @returns Promise<void> - Keine Rückgabe
   * @throws Nur bei kritischen Fehlern, die Retry erfordern
   *
   * @example
   * ```typescript
   * // Fire-and-Forget (typisch):
   * async handle(event: EinsatzCreatedEvent): Promise<void> {
   *   try {
   *     // Business Logic
   *   } catch (error) {
   *     this.logger.error('Failed to handle event', error);
   *     // NICHT re-thrown!
   *   }
   * }
   *
   * // Mit Retry (selten):
   * async handle(event: EinsatzCreatedEvent): Promise<void> {
   *   // Business Logic
   *   // Errors werden re-thrown für EventBus Retry
   * }
   * ```
   */
  handle(event: TEvent): Promise<void>;
}
