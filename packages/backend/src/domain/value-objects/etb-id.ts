import { EntityId } from '@domain/common/entity-id';

/**
 * Type-Safe ID für ETB Aggregates.
 * Verhindert Primitive Obsession und ermöglicht compile-time type safety.
 *
 * @example
 * ```typescript
 * const result = EtbId.create();
 * if (result.isSuccess) {
 *   const id: EtbId = result.value;
 *   console.log(id.toString()); // "A1B2C3D4E5F6G7H8I9J0K"
 * }
 * ```
 */
export class EtbId extends EntityId<'Etb'> {}
