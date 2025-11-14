import { EntityId } from '@domain/common/entity-id';

/**
 * Type-Safe ID für User Aggregates.
 * Verhindert Primitive Obsession und ermöglicht compile-time type safety.
 *
 * @example
 * ```typescript
 * // Auto-Generation
 * const result = UserId.create();
 * if (result.isSuccess) {
 *   const id: UserId = result.value;
 *   console.log(id.toString()); // "X1Y2Z3A4B5C6D7E8F9G0H"
 * }
 *
 * // Mit existierendem Nanoid
 * const result2 = UserId.create('X1Y2Z3A4B5C6D7E8F9G0H');
 *
 * // Type-Safety: UserId ≠ EinsatzId
 * function processUser(id: UserId) { ... }
 * const einsatzId = EinsatzId.create().value;
 * processUser(einsatzId); // ❌ Compile Error
 * ```
 */
export class UserId extends EntityId<'User'> {}
