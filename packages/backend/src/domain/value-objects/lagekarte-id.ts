import { EntityId } from '@domain/common/entity-id';

/**
 * Type-Safe ID für Lagekarte Aggregates.
 * Verhindert Primitive Obsession und ermöglicht compile-time type safety.
 *
 * Eine Lagekarte repräsentiert die digitale Einsatzkarte mit MGRS-Koordinaten
 * und POIs (Points of Interest). Der typed ID verhindert, dass Lagekarte-IDs
 * mit anderen Entity-IDs (z.B. EinsatzId, PoiId) verwechselt werden.
 *
 * @example
 * ```typescript
 * // Auto-Generation
 * const result = LagekarteId.create();
 * if (result.isSuccess) {
 *   const id: LagekarteId = result.value;
 *   console.log(id.toString()); // "A1B2C3D4E5F6G7H8I9J0K"
 * }
 *
 * // Mit existierendem cuid
 * const result2 = LagekarteId.create('A1B2C3D4E5F6G7H8I9J0K');
 *
 * // Type-Safety: LagekarteId ≠ EinsatzId
 * function displayLagekarte(id: LagekarteId) { ... }
 * const einsatzId = EinsatzId.create().value;
 * displayLagekarte(einsatzId); // ❌ Compile Error
 * ```
 */
export class LagekarteId extends EntityId<'Lagekarte'> {}
