import type { DomainEvent } from '@domain/common/domain-event';

/**
 * Port Interface für Event Publishing (Hexagonale Architektur).
 *
 * Diese Abstraktion ermöglicht die Entkopplung der Domain-Schicht von
 * der konkreten Event-Infrastruktur (z.B. NestJS EventEmitter2).
 * Command Handler nutzen dieses Interface, um Domain Events zu publishen,
 * ohne die konkrete Implementierung zu kennen.
 *
 * **Dependency Inversion:**
 * - Domain Layer definiert das Interface (WAS)
 * - Infrastructure Layer implementiert (WIE)
 * - Command Handler injizieren via @Inject('IEventPublisher')
 *
 * **Fire-and-Forget Pattern:**
 * - Events werden async publiziert
 * - Handler-Fehler werden geloggt, aber nicht propagiert
 * - Transaktionale Konsistenz: Events NUR nach erfolgreicher Persistenz publishen
 *
 * @example
 * ```typescript
 * // In Command Handler:
 * constructor(
 *   @Inject('IEventPublisher') private readonly eventPublisher: IEventPublisher
 * ) {}
 *
 * async execute(command: CreateLagekarteCommand): Promise<Result<LagekarteId>> {
 *   // ... business logic
 *   await this.repository.save(aggregate);
 *   await this.eventPublisher.publishAll(aggregate.getDomainEvents());
 *   aggregate.clearDomainEvents();
 * }
 * ```
 */
export interface IEventPublisher {
  /**
   * Publiziert ein einzelnes Domain Event an alle registrierten Handler.
   *
   * Events werden async via emitAsync() verarbeitet, damit Handler
   * await verwenden können. Handler-Fehler werden geloggt aber nicht
   * propagiert (Fire-and-Forget).
   *
   * @param event - Das zu publizierende Domain Event
   */
  publish(event: DomainEvent): Promise<void>;

  /**
   * Publiziert mehrere Domain Events in FIFO-Reihenfolge.
   *
   * Events werden sequentiell publiziert (nicht parallel), um die
   * korrekte Reihenfolge zu garantieren. Dies ist wichtig für Event
   * Handler die auf vorherige Events reagieren.
   *
   * **Typischer Use Case:**
   * Nach repository.save() werden alle gesammelten Events des
   * Aggregates publiziert: LagekarteCreatedEvent, dann PoiAddedEvent.
   *
   * @param events - Array von Domain Events (in Reihenfolge)
   */
  publishAll(events: DomainEvent[]): Promise<void>;
}
