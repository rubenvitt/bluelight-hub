import { EntityId } from '@domain/common/entity-id';

/**
 * Type-Safe ID für Einsatz Aggregates.
 * Verhindert Primitive Obsession und ermöglicht compile-time type safety.
 *
 * @example
 * ```typescript
 * // Auto-Generation
 * const result = EinsatzId.create();
 * if (result.isSuccess) {
 *   const id: EinsatzId = result.value;
 *   console.log(id.toString()); // "A1B2C3D4E5F6G7H8I9J0K"
 * }
 *
 * // Mit existierendem Nanoid
 * const result2 = EinsatzId.create('A1B2C3D4E5F6G7H8I9J0K');
 *
 * // Type-Safety: EinsatzId ≠ UserId
 * function processEinsatz(id: EinsatzId) { ... }
 * const userId = UserId.create().value;
 * processEinsatz(userId); // ❌ Compile Error
 * ```
 */
export class EinsatzId extends EntityId<'Einsatz'> {}
