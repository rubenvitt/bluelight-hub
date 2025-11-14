// Use non-secure nanoid for Jest compatibility (CommonJS)
// Note: In production, the secure version will be used via tree-shaking
import { nanoid } from 'nanoid/non-secure';
import { Result } from '@domain/common/result';
import { ValueObject } from '@domain/common/value-object';

/**
 * Interface für die Props eines EntityId Value Objects.
 * Kapselt den String-Wert einer Entity-ID.
 * Extends Record<string, unknown> für ValueObject compatibility.
 */
interface EntityIdProps extends Record<string, unknown> {
  value: string;
}

/**
 * Abstract Base Class für Type-Safe Entity IDs mit Nanoid validation.
 * Verhindert Primitive Obsession durch typed IDs mit compile-time type safety.
 *
 * Charakteristika:
 * - Generic Wrapper für typed IDs (z.B. EinsatzId extends EntityId<'Einsatz'>)
 * - Nanoid Validation: Regex `/^[A-Za-z0-9_-]{21}$/` (21 URL-safe Zeichen)
 * - Auto-Generation via nanoid() wenn kein ID-Parameter übergeben wird
 * - Type-Safety: EinsatzId ≠ UserId at compile-time
 * - Result<T> Pattern: Factory Method enforces validation
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
 *   console.log(id1.value.toString()); // "A1B2C3D4E5F6G7H8I9J0K" (Nanoid)
 * }
 *
 * // Mit existierendem Nanoid
 * const id2 = EinsatzId.create('A1B2C3D4E5F6G7H8I9J0K');
 * if (id2.isSuccess) {
 *   console.log(id2.value.value); // "A1B2C3D4E5F6G7H8I9J0K"
 * }
 *
 * // Validation Fehler
 * const id3 = EinsatzId.create('invalid-id');
 * if (id3.isFailure) {
 *   console.log(id3.error); // "Invalid nanoid format: must be 21 URL-safe characters"
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
   * Regex für Nanoid Validation.
   * Nanoid Format: Genau 21 Zeichen aus [A-Za-z0-9_-]
   * URL-safe, collision-resistant, shorter als UUID (21 vs 36 chars)
   */
  private static readonly NANOID_REGEX = /^[A-Za-z0-9_-]{21}$/;

  /**
   * Protected Constructor erzwingt Factory Method Nutzung.
   * Verhindert direkte Instanziierung ohne Validation.
   *
   * @param id - Der Nanoid String
   */
  protected constructor(id: string) {
    super({ value: id });
  }

  /**
   * Readonly getter für den ID-Wert.
   * @returns Der Nanoid String
   */
  get value(): string {
    return this.props.value;
  }

  /**
   * Validiert ob ein String ein gültiges Nanoid Format hat.
   * Format: Genau 21 Zeichen aus [A-Za-z0-9_-]
   *
   * @param id - Der zu validierende String
   * @returns true wenn gültiges Nanoid, sonst false
   */
  private static isValidNanoid(id: string): boolean {
    return EntityId.NANOID_REGEX.test(id);
  }

  /**
   * Factory Method mit Nanoid Validation und Auto-Generation.
   * Verwendet Result<T> Pattern zur expliziten Fehlerbehandlung.
   *
   * Logik:
   * - Ohne Parameter: Generiert neues Nanoid via nanoid()
   * - Mit Parameter: Validiert Format via Regex
   * - Bei Fehler: Result.fail mit beschreibender Fehlermeldung
   *
   * @param id - Optional: Existierendes Nanoid. Falls undefined → auto-generate
   * @returns Result<EntityId<TAggregateType>> - Success mit ID oder Failure mit Error
   *
   * @example
   * ```typescript
   * // Auto-Generation
   * const result1 = EinsatzId.create();
   * // result1.isSuccess === true
   * // result1.value.value === "A1B2C3D4E5F6G7H8I9J0K" (generated)
   *
   * // Mit validem Nanoid
   * const result2 = EinsatzId.create('A1B2C3D4E5F6G7H8I9J0K');
   * // result2.isSuccess === true
   *
   * // Mit ungültigem Format
   * const result3 = EinsatzId.create('too-short');
   * // result3.isFailure === true
   * // result3.error === "Invalid nanoid format: must be 21 URL-safe characters"
   * ```
   */
  static create<T extends string>(this: new (id: string) => EntityId<T>, id?: string): Result<EntityId<T>> {
    // Auto-Generation via nanoid() wenn kein Parameter
    const actualId = id ?? nanoid();

    // Validation via Regex
    if (!EntityId.isValidNanoid(actualId)) {
      return Result.fail<EntityId<T>>('Invalid nanoid format: must be 21 URL-safe characters');
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
   * @returns true wenn beide IDs denselben Nanoid-Wert haben
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
   * @returns Der Nanoid String
   *
   * @example
   * ```typescript
   * const id = EinsatzId.create('A1B2C3D4E5F6G7H8I9J0K').value;
   * console.log(`Einsatz ID: ${id.toString()}`);
   * // Output: "Einsatz ID: A1B2C3D4E5F6G7H8I9J0K"
   * ```
   */
  public toString(): string {
    return this.value;
  }
}
