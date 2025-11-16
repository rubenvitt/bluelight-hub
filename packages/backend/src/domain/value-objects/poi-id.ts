import { EntityId } from '@domain/common/entity-id';

/**
 * Type-Safe ID für POI (Point of Interest) Entities.
 * Verhindert Primitive Obsession und ermöglicht compile-time type safety.
 *
 * POIs sind einzelne markierte Orte auf der Lagekarte (z.B. Einsatzstelle,
 * Bereitstellungsraum). Der typed ID verhindert, dass POI-IDs mit anderen
 * Entity-IDs (z.B. LagekarteId, EinsatzId) verwechselt werden.
 *
 * @example
 * ```typescript
 * // Auto-Generation
 * const result = PoiId.create();
 * if (result.isSuccess) {
 *   const id: PoiId = result.value;
 *   console.log(id.toString()); // "A1B2C3D4E5F6G7H8I9J0K"
 * }
 *
 * // Mit existierendem Nanoid
 * const result2 = PoiId.create('A1B2C3D4E5F6G7H8I9J0K');
 *
 * // Type-Safety: PoiId ≠ LagekarteId
 * function addPoiToMap(id: PoiId) { ... }
 * const lagekarteId = LagekarteId.create().value;
 * addPoiToMap(lagekarteId); // ❌ Compile Error
 * ```
 */
export class PoiId extends EntityId<'Poi'> {}
