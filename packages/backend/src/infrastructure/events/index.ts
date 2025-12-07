/**
 * Infrastructure Events Layer.
 *
 * Diese Barrel-Datei exportiert Event-Publishing Implementierungen
 * für die Hexagonale Architektur. Der EventEmitterPublisher implementiert
 * das IEventPublisher Port Interface aus der Domain-Schicht.
 *
 * **Module-Struktur (Clean Architecture):**
 * - EventInfrastructureModule: Nur IEventPublisher (für Application Layer)
 * - EventAdaptersModule: Event Adapters (importiert Application Module einseitig)
 *
 * **Dependency Flow (keine zirkulären Abhängigkeiten!):**
 * ```
 * EventInfrastructureModule (IEventPublisher)
 *         ↑
 * Application Modules (publizieren Events)
 *         ↑
 * EventAdaptersModule (delegiert @OnEvent an Application Handler)
 * ```
 */

export { EventEmitterPublisher } from './event-emitter-publisher';
export { EventInfrastructureModule } from './event-infrastructure.module';
export { EventAdaptersModule } from './event-adapters.module';
