import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { DomainEvent } from '@domain/common/domain-event';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';

/**
 * EventEmitter2 Adapter für IEventPublisher Port.
 *
 * Diese Klasse implementiert den IEventPublisher Port und delegiert
 * das Event Publishing an NestJS EventEmitter2. Events werden async
 * publiziert via emitAsync() für Handler die await benötigen.
 *
 * **Fire-and-Forget Pattern:**
 * Handler-Fehler werden geloggt aber nicht propagiert. Dies verhindert,
 * dass fehlgeschlagene Event Handler die Haupt-Transaktion beeinflussen.
 *
 * **Event Routing:**
 * Events werden via statische eventName() Methode geroutet:
 * - LagekarteCreatedEvent → 'lagekarte.created'
 * - PoiAddedEvent → 'lagekarte.poi_added'
 *
 * @example
 * ```typescript
 * // Registration in Module:
 * {
 *   provide: 'IEventPublisher',
 *   useClass: EventEmitterPublisher,
 * }
 * ```
 */
@Injectable()
export class EventEmitterPublisher implements IEventPublisher {
  private readonly logger = new Logger(EventEmitterPublisher.name);

  constructor(@Inject(EventEmitter2) private readonly eventEmitter: EventEmitter2) {}

  /**
   * Publiziert ein einzelnes Domain Event via EventEmitter2.
   *
   * Verwendet emitAsync() für async Handler-Support. Der Event Name
   * wird via statische eventName() Methode der Event-Klasse ermittelt.
   *
   * @param event - Das zu publizierende Domain Event
   */
  async publish(event: DomainEvent): Promise<void> {
    const eventName = (event.constructor as typeof DomainEvent).eventName();
    try {
      await this.eventEmitter.emitAsync(eventName, event);
      this.logger.debug(`Event '${eventName}' published`, {
        eventId: event.eventId,
        aggregateId: event.aggregateId,
      });
    } catch (error) {
      // Fire-and-Forget: Log but don't propagate handler errors
      this.logger.warn(`Event handler error for '${eventName}'`, {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Publiziert mehrere Domain Events sequentiell (FIFO).
   *
   * @param events - Array von Domain Events
   */
  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
