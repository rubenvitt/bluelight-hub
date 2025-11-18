/**
 * Command zum Entfernen eines POI von einer Lagekarte.
 *
 * Warum Hard Delete statt Soft Delete: POIs sind keine rechtlich
 * relevanten Daten (im Gegensatz zu Einsätzen/ETB-Einträgen).
 * Hard Delete ist performanter und vermeidet Daten-Müll.
 *
 * Business Rule: Nur LagekarteAggregate darf POIs löschen (Aggregate
 * Boundary). NO-DELETE Policy gilt nur für Aggregates, nicht für Entities.
 */
export class RemovePoiCommand {
  constructor(
    public readonly lagekarteId: string,
    public readonly poiId: string,
  ) {
    // Validation: Both required
    if (!lagekarteId || lagekarteId.trim().length === 0) {
      throw new Error('lagekarteId is required');
    }
    if (!poiId || poiId.trim().length === 0) {
      throw new Error('poiId is required');
    }
  }
}
