import type { DomainEvent } from '@domain/common/domain-event';
import type { EntityId } from '@domain/common/entity-id';

/**
 * Abstract Base Class für DDD Aggregate Roots mit event accumulation und identity equality.
 * Aggregate Roots sind transactional boundaries im Domain Model und verwalten Domain Events.
 *
 * Charakteristika:
 * - Identity Equality: Zwei Aggregates sind gleich wenn ihre IDs gleich sind (unabhängig von State)
 * - Event Accumulation: Domain Events werden in-memory gesammelt bis zur Persistierung
 * - Transactional Boundary: Ein Aggregate = eine Transaktion (konsistente State Changes)
 * - Protected Constructor: Erzwingt Factory Methods in Subclasses (Result<T> Pattern)
 * - Type-Safe IDs: Generic Constraint `TId extends EntityId<any>` verhindert primitive IDs
 *
 * Event Flow Pattern:
 * 1. Business Method aufrufen → Aggregate State ändern
 * 2. addDomainEvent() aufrufen → Event zur uncommitted Liste hinzufügen
 * 3. Repository persist() → Aggregate + Events speichern
 * 4. Events publizen → Event Bus dispatcht an Handler
 * 5. clearDomainEvents() → Uncommitted Events löschen nach erfolgreichem Publishing
 *
 * Design Pattern:
 * - Domain-Driven Design: Aggregate Pattern mit Event Sourcing
 * - CQRS: Events triggern Read Model Updates
 * - Eventual Consistency: Events werden erst nach Persistierung published
 *
 * @template TId - Type-Safe EntityId Type (muss EntityId<any> extenden)
 *
 * @example
 * ```typescript
 * // Concrete Aggregate mit Factory Method
 * class Einsatz extends AggregateRoot<EinsatzId> {
 *   private constructor(
 *     id: EinsatzId,
 *     private _name: string,
 *     createdAt?: Date,
 *     updatedAt?: Date
 *   ) {
 *     super(id, createdAt, updatedAt);
 *   }
 *
 *   // Factory Method (Result<T> Pattern)
 *   static create(name: string): Result<Einsatz> {
 *     if (!name?.trim()) {
 *       return Result.fail('Einsatz name is required');
 *     }
 *     const idResult = EinsatzId.create();
 *     if (idResult.isFailure) {
 *       return Result.fail(idResult.error!);
 *     }
 *     const einsatz = new Einsatz(idResult.value!, name);
 *     einsatz.addDomainEvent(new EinsatzCreatedEvent(idResult.value!.value, name));
 *     return Result.ok(einsatz);
 *   }
 *
 *   // Business Method emittiert Domain Event
 *   updateName(name: string): void {
 *     this._name = name;
 *     this.addDomainEvent(new EinsatzUpdatedEvent(this.id.value, { name }));
 *   }
 *
 *   get name(): string {
 *     return this._name;
 *   }
 * }
 *
 * // Usage
 * const result = Einsatz.create('Wohnungsbrand');
 * if (result.isSuccess) {
 *   const einsatz = result.value;
 *   einsatz.updateName('Großbrand');
 *   const events = einsatz.getDomainEvents(); // [EinsatzCreatedEvent, EinsatzUpdatedEvent]
 *   // ... persist + publish events ...
 *   einsatz.clearDomainEvents(); // Nach Publishing leeren
 * }
 *
 * // Equality (ID-based only)
 * const einsatz1 = Einsatz.create('Wohnungsbrand').value;
 * const einsatz2 = Einsatz.create('Verkehrsunfall').value;
 * einsatz1.equals(einsatz1); // true (same instance)
 * einsatz1.equals(einsatz2); // false (different IDs)
 * ```
 */
export abstract class AggregateRoot<TId extends EntityId<any>> {
  /**
   * Protected readonly ID field.
   * Verhindert direkte ID-Änderung nach Construction.
   * Nur via getter zugänglich.
   */
  protected readonly _id: TId;

  /**
   * Protected readonly createdAt timestamp.
   * Wird im Constructor initialisiert (default: new Date()).
   */
  protected readonly _createdAt: Date;

  /**
   * Protected readonly updatedAt timestamp.
   * Wird im Constructor initialisiert (default: new Date()).
   */
  protected readonly _updatedAt: Date;

  /**
   * Private Domain Events Akkumulator.
   * Events werden hier gesammelt bis zur Persistierung und Publishing.
   *
   * Warum private?
   * - Verhindert direkte Manipulation der Event Liste durch Subclasses
   * - Erzwingt Verwendung von addDomainEvent(), getDomainEvents(), clearDomainEvents()
   * - Encapsulation: Event Management ist Aggregate Root Verantwortlichkeit
   */
  private _domainEvents: DomainEvent[] = [];

  /**
   * Protected Constructor erzwingt Factory Methods in Subclasses.
   * Verhindert direkte Instanziierung ohne Validation (Result<T> Pattern).
   *
   * Warum protected?
   * - Subclasses können super() aufrufen
   * - Direct Construction von außen verhindert (erzwingt static create() factory)
   * - Validation Logic muss in Factory Methods implementiert werden
   *
   * @param id - Type-Safe EntityId für das Aggregate
   * @param createdAt - Optional: Creation timestamp (default: new Date())
   * @param updatedAt - Optional: Update timestamp (default: new Date())
   */
  protected constructor(id: TId, createdAt?: Date, updatedAt?: Date) {
    this._id = id;
    this._createdAt = createdAt ?? new Date();
    this._updatedAt = updatedAt ?? new Date();
  }

  /**
   * Readonly getter für Aggregate ID.
   * Verhindert ID-Änderung nach Construction (Immutability).
   *
   * @returns Type-Safe EntityId des Aggregates
   */
  get id(): TId {
    return this._id;
  }

  /**
   * Readonly getter für createdAt timestamp.
   * Zeigt wann das Aggregate erstellt wurde.
   *
   * @returns Creation timestamp
   */
  get createdAt(): Date {
    return this._createdAt;
  }

  /**
   * Readonly getter für updatedAt timestamp.
   * Zeigt wann das Aggregate zuletzt geändert wurde.
   *
   * @returns Last update timestamp
   */
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Fügt ein Domain Event zur uncommitted Event Liste hinzu.
   * Protected: Nur Subclasses können Events hinzufügen (Business Methods).
   *
   * Warum protected statt public?
   * - Events sollten nur von Business Methods des Aggregates emittiert werden
   * - Verhindert dass externe Caller beliebige Events hinzufügen (Encapsulation)
   * - Domain Logic bleibt innerhalb des Aggregates (DDD Principle)
   *
   * Event Flow:
   * 1. Business Method ändert Aggregate State
   * 2. Business Method ruft addDomainEvent() auf
   * 3. Event wird zur _domainEvents Liste hinzugefügt
   * 4. Event wird später von Infrastructure Layer published
   *
   * @param event - Domain Event das hinzugefügt werden soll
   *
   * @example
   * ```typescript
   * class Einsatz extends AggregateRoot<EinsatzId> {
   *   updateName(name: string): void {
   *     this._name = name;
   *     this.addDomainEvent(new EinsatzUpdatedEvent(this.id.value, { name }));
   *   }
   * }
   * ```
   */
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * Gibt alle uncommitted Domain Events zurück.
   * Public: Infrastructure Layer (Repository, Event Bus) benötigt Zugriff.
   *
   * CRITICAL: Shallow Copy für Mutation-Safety!
   * - Gibt KOPIE der Event-Array zurück, nicht Referenz
   * - Verhindert dass Caller die interne _domainEvents Liste mutiert
   * - Common DDD Pitfall: Direct Reference würde Event-Liste kompromittieren
   *
   * @returns Shallow copy der Domain Events (mutation-safe)
   *
   * @example
   * ```typescript
   * const einsatz = Einsatz.create('Wohnungsbrand').value;
   * einsatz.updateName('Großbrand');
   *
   * const events = einsatz.getDomainEvents(); // Shallow copy
   * events.push(new SomeOtherEvent()); // ✅ Mutiert nur die Kopie, nicht original
   * einsatz.getDomainEvents().length; // 2 (original unverändert)
   * ```
   */
  getDomainEvents(): DomainEvent[] {
    return [...this._domainEvents]; // Shallow copy (mutation-safe)
  }

  /**
   * Löscht alle uncommitted Domain Events.
   * Public: Infrastructure Layer ruft nach Publishing auf.
   *
   * Warum nach Publishing?
   * - Events werden in-memory akkumuliert während Business Transaction
   * - Nach erfolgreicher Persistierung + Publishing werden Events gelöscht
   * - Verhindert dass Events mehrfach published werden (Idempotency)
   * - Separation of Concerns: Domain weiß nichts von Event Bus
   *
   * Call Flow:
   * 1. Aggregate Business Method → addDomainEvent()
   * 2. Repository persist() → Aggregate + Events speichern
   * 3. Event Bus publish() → Events dispatchen
   * 4. clearDomainEvents() → Uncommitted Events löschen
   *
   * @example
   * ```typescript
   * const einsatz = Einsatz.create('Wohnungsbrand').value;
   * einsatz.getDomainEvents().length; // 1 (EinsatzCreatedEvent)
   *
   * // ... persist + publish ...
   * einsatz.clearDomainEvents();
   * einsatz.getDomainEvents().length; // 0 (cleared)
   * ```
   */
  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  /**
   * Identity Equality Check basierend auf Aggregate ID.
   * Zwei Aggregates sind gleich wenn ihre IDs gleich sind (unabhängig von State).
   *
   * Warum ID-based Equality?
   * - DDD Principle: Entity Identity über Time (State kann sich ändern)
   * - Transactional Consistency: Selbes ID = selbe Aggregate Root
   * - Vermeidet Value Equality Pitfalls (z.B. "gleicher Name" ≠ "gleicher Einsatz")
   *
   * CRITICAL: Ignoriert andere Properties!
   * - Nur ID zählt für Equality (name, status, etc. werden NICHT verglichen)
   * - Zwei Aggregates mit selber ID = selbe Entity (trotz unterschiedlichen States)
   *
   * @param other - Anderes AggregateRoot zum Vergleichen (optional)
   * @returns true wenn IDs gleich, false sonst
   *
   * @example
   * ```typescript
   * const id = EinsatzId.create('A1B2C3D4E5F6G7H8I9J0K').value;
   * const einsatz1 = new Einsatz(id, 'Wohnungsbrand');
   * const einsatz2 = new Einsatz(id, 'Großbrand'); // Unterschiedlicher Name!
   *
   * einsatz1.equals(einsatz2); // true (gleiche ID!)
   * einsatz1 === einsatz2; // false (unterschiedliche Objekt-Referenzen)
   * ```
   */
  public equals(other?: AggregateRoot<TId>): boolean {
    if (other == null) return false;
    if (other === this) return true;

    // Identity Equality: Nur ID vergleichen (nicht State!)
    return this.id.equals(other.id);
  }
}
