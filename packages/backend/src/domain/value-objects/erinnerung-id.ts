import { EntityId } from '@domain/common/entity-id';

/**
 * Type-Safe ID für Erinnerung Aggregates.
 * Verhindert Primitive Obsession und ermöglicht compile-time type safety.
 *
 * @example
 * ```typescript
 * // Auto-Generation
 * const result = ErinnerungId.create();
 * if (result.isSuccess) {
 *   const id: ErinnerungId = result.value;
 *   console.log(id.toString()); // "clw3h8x9y0000qwertyuiopas"
 * }
 *
 * // Mit existierendem cuid
 * const result2 = ErinnerungId.create('clw3h8x9y0000qwertyuiopas');
 *
 * // Type-Safety: ErinnerungId ≠ EinsatzId
 * function processErinnerung(id: ErinnerungId) { ... }
 * const einsatzId = EinsatzId.create().value;
 * processErinnerung(einsatzId); // ❌ Compile Error
 * ```
 */
export class ErinnerungId extends EntityId<'Erinnerung'> {}
