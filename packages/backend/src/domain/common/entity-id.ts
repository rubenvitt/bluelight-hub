// CUID2 für sichere, kollisionsresistente ID-Generierung
import { Result } from '@domain/common/result';
import { ValueObject } from '@domain/common/value-object';
// Ersetzt cuid für Konsistenz mit Prisma-generierten IDs
import { createId, isCuid } from '@paralleldrive/cuid2';

/**
 * Interface für die Props eines EntityId Value Objects.
 * Kapselt den String-Wert einer Entity-ID.
 * Extends Record<string, unknown> für ValueObject compatibility.
 */
interface EntityIdProps extends Record<string, unknown> {
  value: string;
}

/**
 * Abstract Base Class für Type-Safe Entity IDs mit CUID2 validation.
 * Verhindert Primitive Obsession durch typed IDs mit compile-time type safety.
 *
 * Charakteristika:
 * - Generic Wrapper für typed IDs (z.B. EinsatzId extends EntityId<'Einsatz'>)
 * - CUID2 Validation: Beginnt mit Kleinbuchstabe, nur [a-z0-9]
 * - Auto-Generation via createId() wenn kein ID-Parameter übergeben wird
 * - Type-Safety: EinsatzId ≠ UserId at compile-time
 * - Result<T> Pattern: Factory Method enforces validation
 * - Konsistent mit Prisma-generierten IDs (@default(cuid()))
 *
 * @template TAggregateType - String Literal zur compile-time Typ-Differenzierung (z.B. 'Einsatz', 'User')
 *
 * @example
 * ```typescript
 * // Concrete EntityId Klasse definieren
 * class EinsatzId extends EntityId<'Einsatz'> {}
 *
 * // Auto-Generation (kein Parameter)
 * const id1 = EinsatzId.create();
 * if (id1.isSuccess) {
 *   console.log(id1.value.toString()); // "clw3h8x9y0000qwertyuiopas" (CUID2)
 * }
 *
 * // Mit existierendem CUID
 * const id2 = EinsatzId.create('clw3h8x9y0000qwertyuiopas');
 * if (id2.isSuccess) {
 *   console.log(id2.value.value); // "clw3h8x9y0000qwertyuiopas"
 * }
 *
 * // Validation Fehler
 * const id3 = EinsatzId.create('invalid-id');
 * if (id3.isFailure) {
 *   console.log(id3.error); // "Invalid CUID format"
 * }
 *
 * // Type-Safety at compile-time
 * class UserId extends EntityId<'User'> {}
 * function processEinsatz(id: EinsatzId) { ... }
 *
 * const userId = UserId.create().value;
 * processEinsatz(userId); // ❌ TypeScript Compile Error: UserId ≠ EinsatzId
 * ```
 */
export abstract class EntityId<TAggregateType extends string> extends ValueObject<EntityIdProps> {
  /**
   * Protected Constructor erzwingt Factory Method Nutzung.
   * Verhindert direkte Instanziierung ohne Validation.
   *
   * @param id - Der CUID String
   */
  protected constructor(id: string) {
    super({ value: id });
  }

  /**
   * Readonly getter für den ID-Wert.
   * @returns Der CUID String
   */
  get value(): string {
    return this.props.value;
  }

  /**
   * Factory Method mit CUID Validation und Auto-Generation.
   * Verwendet Result<T> Pattern zur expliziten Fehlerbehandlung.
   *
   * Logik:
   * - Ohne Parameter: Generiert neues CUID via createId()
   * - Mit Parameter: Validiert Format via isCuid()
   * - Bei Fehler: Result.fail mit beschreibender Fehlermeldung
   *
   * @param id - Optional: Existierendes CUID. Falls undefined → auto-generate
   * @returns Result<EntityId<TAggregateType>> - Success mit ID oder Failure mit Error
   *
   * @example
   * ```typescript
   * // Auto-Generation
   * const result1 = EinsatzId.create();
   * // result1.isSuccess === true
   * // result1.value.value === "clw3h8x9y0000qwertyuiopas" (generated)
   *
   * // Mit validem CUID
   * const result2 = EinsatzId.create('clw3h8x9y0000qwertyuiopas');
   * // result2.isSuccess === true
   *
   * // Mit ungültigem Format
   * const result3 = EinsatzId.create('too-short');
   * // result3.isFailure === true
   * // result3.error === "Invalid CUID format"
   * ```
   */
  // biome-ignore lint/suspicious/noExplicitAny: `this` parameter requires `any` type for subclass polymorphism
  static create<T extends string>(this: any, id?: string): Result<EntityId<T>> {
    // Auto-Generation via createId() wenn kein Parameter
    const actualId = id ?? createId();

    // Validation via isCuid() - nutzt die offizielle CUID2-Validierung
    if (!isCuid(actualId)) {
      return Result.fail<EntityId<T>>('Invalid CUID format');
    }

    // Success: Erstelle neue EntityId Instanz
    // biome-ignore lint/complexity/noThisInStatic: `this` refers to subclass constructor, not EntityId base class
    return Result.ok<EntityId<T>>(new this(actualId));
  }

  /**
   * Prüft Gleichheit mit einer anderen EntityId.
   * Nutzt ValueObject.equals() für strukturelle Gleichheit.
   *
   * @param other - Die zu vergleichende EntityId (optional)
   * @returns true wenn beide IDs denselben cuid-Wert haben
   *
   * @example
   * ```typescript
   * const id1 = EinsatzId.create('A1B2C3D4E5F6G7H8I9J0K').value;
   * const id2 = EinsatzId.create('A1B2C3D4E5F6G7H8I9J0K').value;
   * const id3 = EinsatzId.create('X1Y2Z3A4B5C6D7E8F9G0H').value;
   *
   * id1.equals(id2); // true (same value)
   * id1.equals(id3); // false (different value)
   * id1 === id2; // false (different object instances)
   * ```
   */
  public equals(other?: EntityId<TAggregateType>): boolean {
    if (other == null) return false;
    if (other === this) return true;

    return this.value === other.value;
  }

  /**
   * String-Repräsentation der EntityId.
   * Nützlich für Logging und Debugging.
   *
   * @returns Der CUID String
   *
   * @example
   * ```typescript
   * const id = EinsatzId.create('clw3h8x9y0000qwertyuiopas').value;
   * console.log(`Einsatz ID: ${id.toString()}`);
   * // Output: "Einsatz ID: clw3h8x9y0000qwertyuiopas"
   * ```
   */
  public toString(): string {
    return this.value;
  }
}
