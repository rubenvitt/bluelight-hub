import { AggregateRoot } from '@domain/common/aggregate-root';
import { Result } from '@domain/common/result';
import { EinsatzCreatedEvent } from '@domain/events/einsatz-created.event';
import { EinsatzUpdatedEvent } from '@domain/events/einsatz-updated.event';
import { EinsatzId } from '@domain/value-objects/einsatz-id';

/**
 * Einsatz Aggregate Root für Emergency Response Management.
 * Repräsentiert die transactionale Grenze für alle Einsatz-bezogenen Operations.
 *
 * Business Rules:
 * - Name ist required (darf nicht leer sein)
 * - Location ist optional
 * - Status kann geändert werden (emittiert EinsatzUpdatedEvent)
 *
 * Event Flow:
 * - create() → EinsatzCreatedEvent
 * - updateName() → EinsatzUpdatedEvent
 * - updateLocation() → EinsatzUpdatedEvent
 * - updateStatus() → EinsatzUpdatedEvent
 *
 * @example
 * ```typescript
 * // Einsatz erstellen (Factory Method mit Validation)
 * const result = Einsatz.create('Wohnungsbrand', 'Musterstraße 42');
 * if (result.isSuccess) {
 *   const einsatz = result.value;
 *   console.log(einsatz.id.value); // "A1B2C3D4E5F6G7H8I9J0K"
 *   console.log(einsatz.name); // "Wohnungsbrand"
 *   console.log(einsatz.location); // "Musterstraße 42"
 *   console.log(einsatz.getDomainEvents().length); // 1 (EinsatzCreatedEvent)
 *
 *   // Business Method aufrufen
 *   einsatz.updateName('Großbrand');
 *   console.log(einsatz.name); // "Großbrand"
 *   console.log(einsatz.getDomainEvents().length); // 2 (+ EinsatzUpdatedEvent)
 * }
 *
 * // Validation Fehler
 * const failResult = Einsatz.create(''); // Leerer Name
 * console.log(failResult.isFailure); // true
 * console.log(failResult.error); // "Einsatz name is required and must not be empty"
 * ```
 */
export class Einsatz extends AggregateRoot<EinsatzId> {
  /**
   * Private constructor erzwingt Factory Method Nutzung.
   * Verhindert direkte Instanziierung ohne Validation.
   *
   * @param id - Type-Safe EinsatzId
   * @param _name - Einsatz Name/Typ (z.B. "Wohnungsbrand")
   * @param _location - Optional: Einsatzort
   * @param _status - Optional: Einsatz Status (z.B. "offen", "in Bearbeitung")
   * @param createdAt - Optional: Creation timestamp
   * @param updatedAt - Optional: Update timestamp
   */
  private constructor(
    id: EinsatzId,
    private _name: string,
    private _location?: string,
    private _status?: string,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
  }

  /**
   * Factory Method mit Business Validation und Event Emission.
   * Verwendet Result<T> Pattern zur expliziten Fehlerbehandlung.
   *
   * Business Rules:
   * - Name ist required und darf nicht leer sein (trim check)
   * - Location ist optional
   * - Status ist optional
   * - Bei Erfolg wird EinsatzCreatedEvent emittiert
   *
   * @param name - Einsatz Name/Typ (required, not empty)
   * @param location - Optional: Einsatzort
   * @param status - Optional: Einsatz Status
   * @returns Result<Einsatz> - Success mit Einsatz oder Failure mit Error Message
   *
   * @example
   * ```typescript
   * // Success
   * const result = Einsatz.create('Wohnungsbrand', 'Musterstraße 42');
   * if (result.isSuccess) {
   *   const einsatz = result.value;
   *   einsatz.getDomainEvents(); // [EinsatzCreatedEvent]
   * }
   *
   * // Failure: Leerer Name
   * const failResult = Einsatz.create('');
   * console.log(failResult.error); // "Einsatz name is required and must not be empty"
   * ```
   */
  static create(name: string, location?: string, status?: string): Result<Einsatz> {
    // Business Rule: Name required
    if (!name || name.trim().length === 0) {
      return Result.fail('Einsatz name is required and must not be empty');
    }

    // Generate type-safe EinsatzId
    const idResult = EinsatzId.create();
    if (idResult.isFailure) {
      return Result.fail(idResult.error!);
    }

    const id = idResult.value!;
    const einsatz = new Einsatz(id, name.trim(), location, status);

    // Emit EinsatzCreatedEvent
    einsatz.addDomainEvent(new EinsatzCreatedEvent(id.value, name.trim(), location ?? '', id.value));

    return Result.ok(einsatz);
  }

  /**
   * Readonly getter für Einsatz Name.
   * @returns Einsatz Name (z.B. "Wohnungsbrand")
   */
  get name(): string {
    return this._name;
  }

  /**
   * Readonly getter für Einsatzort.
   * @returns Optional: Einsatzort
   */
  get location(): string | undefined {
    return this._location;
  }

  /**
   * Readonly getter für Einsatz Status.
   * @returns Optional: Einsatz Status
   */
  get status(): string | undefined {
    return this._status;
  }

  /**
   * Business Method: Ändert den Einsatz Namen.
   * Emittiert EinsatzUpdatedEvent mit neuen Wert.
   *
   * @param name - Neuer Einsatz Name (required)
   * @throws Error wenn Name leer ist (Business Rule Violation)
   *
   * @example
   * ```typescript
   * const einsatz = Einsatz.create('Wohnungsbrand').value;
   * einsatz.updateName('Großbrand');
   * console.log(einsatz.name); // "Großbrand"
   * einsatz.getDomainEvents(); // [..., EinsatzUpdatedEvent]
   * ```
   */
  updateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Einsatz name is required and must not be empty');
    }

    this._name = name.trim();
    this.addDomainEvent(new EinsatzUpdatedEvent(this.id.value, { name: name.trim() }, this.id.value));
  }

  /**
   * Business Method: Ändert den Einsatzort.
   * Emittiert EinsatzUpdatedEvent mit neuem Wert.
   *
   * @param location - Neuer Einsatzort (optional)
   *
   * @example
   * ```typescript
   * const einsatz = Einsatz.create('Wohnungsbrand').value;
   * einsatz.updateLocation('Neue Straße 123');
   * console.log(einsatz.location); // "Neue Straße 123"
   * ```
   */
  updateLocation(location: string): void {
    this._location = location;
    this.addDomainEvent(new EinsatzUpdatedEvent(this.id.value, { location }, this.id.value));
  }

  /**
   * Business Method: Ändert den Einsatz Status.
   * Emittiert EinsatzUpdatedEvent mit neuem Status.
   *
   * @param status - Neuer Status (z.B. "in Bearbeitung", "abgeschlossen")
   *
   * @example
   * ```typescript
   * const einsatz = Einsatz.create('Wohnungsbrand').value;
   * einsatz.updateStatus('in Bearbeitung');
   * console.log(einsatz.status); // "in Bearbeitung"
   * ```
   */
  updateStatus(status: string): void {
    this._status = status;
    this.addDomainEvent(new EinsatzUpdatedEvent(this.id.value, { status }, this.id.value));
  }
}
