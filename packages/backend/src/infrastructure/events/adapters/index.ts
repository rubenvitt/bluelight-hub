/**
 * Infrastructure Event Adapters - Barrel Export.
 *
 * Diese Adapters verbinden NestJS EventEmitter Framework mit
 * framework-agnostischen Application Layer Event Handlers.
 *
 * **Adapter Pattern:**
 * - Adapters verwenden @OnEvent Decorator (Framework-spezifisch)
 * - Delegieren an Application Handlers via IEventHandler (Framework-agnostisch)
 * - Ermöglichen Clean Architecture im Application Layer
 *
 * @module infrastructure/events/adapters
 */

export * from './etb-event.adapter';
export * from './lagekarte-event.adapter';
