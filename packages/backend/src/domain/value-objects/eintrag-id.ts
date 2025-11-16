import { EntityId } from '@domain/common/entity-id';

/**
 * Type-Safe ID für Eintrag Entities.
 * Verhindert Primitive Obsession und ermöglicht compile-time type safety.
 *
 * @example
 * ```typescript
 * const result = EintragId.create();
 * if (result.isSuccess) {
 *   const id: EintragId = result.value;
 *   console.log(id.toString()); // "A1B2C3D4E5F6G7H8I9J0K"
 * }
 * ```
 */
export class EintragId extends EntityId<'Eintrag'> {}
