/**
 * Infrastructure Events Layer.
 *
 * Diese Barrel-Datei exportiert Event-Publishing Implementierungen
 * für die Hexagonale Architektur. Der EventEmitterPublisher implementiert
 * das IEventPublisher Port Interface aus der Domain-Schicht.
 */

export { EventEmitterPublisher } from './event-emitter-publisher';
export { LagekarteEventsModule } from './lagekarte-events.module';
