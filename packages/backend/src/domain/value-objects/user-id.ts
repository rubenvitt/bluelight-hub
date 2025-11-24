import { nanoid } from 'nanoid';
import { Result } from '@domain/common/result';
import { ValueObject } from '@domain/common/value-object';

/**
 * Nanoid format: 21 characters, alphanumeric with mixed case.
 * This is the format used by Prisma's @default(nanoid()) for User IDs.
 */
const NANOID_REGEX = /^[A-Za-z0-9_-]{21}$/;

/**
 * Interface für die Props eines UserId Value Objects.
 */
interface UserIdProps extends Record<string, unknown> {
  value: string;
}

/**
 * Type-Safe ID für User Aggregates.
 *
 * WICHTIG: UserId verwendet Nanoid-Format (21 Zeichen, gemischte Gross-/Kleinbuchstaben),
 * NICHT CUID2-Format wie andere Entity IDs. Dies ist konsistent mit dem Prisma-Schema
 * (model User { id String @id @default(nanoid()) }).
 *
 * Verhindert Primitive Obsession und ermöglicht compile-time type safety.
 *
 * @example
 * ```typescript
 * // Auto-Generation
 * const result = UserId.create();
 * if (result.isSuccess) {
 *   const id: UserId = result.value;
 *   console.log(id.toString()); // "X1Y2Z3A4B5C6D7E8F9G0H" (21 Zeichen)
 * }
 *
 * // Mit existierendem Nanoid
 * const result2 = UserId.create('WvmYHlIYRWUhVZTt1aRng');
 *
 * // Type-Safety: UserId ≠ EinsatzId
 * function processUser(id: UserId) { ... }
 * const einsatzId = EinsatzId.create().value;
 * processUser(einsatzId); // ❌ Compile Error
 * ```
 */
export class UserId extends ValueObject<UserIdProps> {
  /**
   * Protected Constructor erzwingt Factory Method Nutzung.
   */
  protected constructor(id: string) {
    super({ value: id });
  }

  /**
   * Readonly getter für den ID-Wert.
   */
  get value(): string {
    return this.props.value;
  }

  /**
   * Factory Method mit Nanoid Validation und Auto-Generation.
   *
   * @param id - Optional: Existierendes Nanoid. Falls undefined → auto-generate
   * @returns Result<UserId> - Success mit ID oder Failure mit Error
   */
  static create(id?: string): Result<UserId> {
    // Auto-Generation via nanoid() wenn kein Parameter
    const actualId = id ?? nanoid();

    // Validation via Regex für Nanoid-Format (21 Zeichen, alphanumeric mit Gross-/Kleinbuchstaben)
    if (!NANOID_REGEX.test(actualId)) {
      return Result.fail<UserId>('Invalid Nanoid format for UserId');
    }

    return Result.ok<UserId>(new UserId(actualId));
  }

  /**
   * Prüft Gleichheit mit einer anderen UserId.
   */
  public equals(other?: UserId): boolean {
    if (other == null) return false;
    if (other === this) return true;

    return this.value === other.value;
  }

  /**
   * String-Repräsentation der UserId.
   */
  public toString(): string {
    return this.value;
  }
}
