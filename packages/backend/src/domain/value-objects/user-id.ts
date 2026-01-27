import { Result } from '@domain/common/result';
import { ValueObject } from '@domain/common/value-object';
import { createId, isCuid } from '@paralleldrive/cuid2';

/**
 * Interface für die Props eines UserId Value Objects.
 */
interface UserIdProps extends Record<string, unknown> {
  value: string;
}

/**
 * Type-Safe ID für User Aggregates.
 *
 * WICHTIG: UserId verwendet cuid-Format (21 Zeichen, gemischte Gross-/Kleinbuchstaben),
 * NICHT CUID2-Format wie andere Entity IDs. Dies ist konsistent mit dem Prisma-Schema
 * (model User { id String @id @default(cuid()) }).
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
 * // Mit existierendem cuid
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
   * Factory Method mit cuid Validation und Auto-Generation.
   *
   * @param id - Optional: Existierendes cuid. Falls undefined → auto-generate
   * @returns Result<UserId> - Success mit ID oder Failure mit Error
   */
  static create(id?: string): Result<UserId> {
    // Auto-Generation via cuid() wenn kein Parameter
    const actualId = id ?? createId();

    // Validation via Regex für cuid-Format (21 Zeichen, alphanumeric mit Gross-/Kleinbuchstaben)
    // ODER 'SYSTEM' für den speziellen System-User
    if (actualId !== 'SYSTEM' && !isCuid(actualId)) {
      return Result.fail<UserId>(`Invalid Cuid format for UserId ${id}`);
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
