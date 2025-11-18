/**
 * Command zum Erstellen einer neuen Lagekarte für einen Einsatz.
 *
 * Diese Command unterstützt optionales initialPoi, um Lagekarte + ersten POI
 * atomar zu erstellen (verhindert leere Lagekarten in der DB).
 *
 * Warum Command Pattern: Entkoppelt Controller von Domain-Logic,
 * ermöglicht spätere Event-Sourcing-Migration ohne Controller-Änderungen.
 */
export class CreateLagekarteCommand {
  constructor(
    public readonly einsatzId: string,
    public readonly initialPoi?: {
      name: string;
      coordinate: { lat: number; lng: number } | { mgrs: string };
      category: string;
    },
  ) {
    // Validation: einsatzId required
    if (!einsatzId || einsatzId.trim().length === 0) {
      throw new Error('einsatzId is required');
    }

    // Validation: initialPoi fields if provided
    if (initialPoi) {
      if (!initialPoi.name || initialPoi.name.trim().length === 0) {
        throw new Error('initialPoi.name is required when initialPoi is provided');
      }
      if (!initialPoi.coordinate) {
        throw new Error('initialPoi.coordinate is required');
      }
      if (!initialPoi.category || initialPoi.category.trim().length === 0) {
        throw new Error('initialPoi.category is required when initialPoi is provided');
      }
    }
  }
}
