/**
 * Command zum Aktualisieren der Position eines POI.
 *
 * Warum separate Update-Commands: CQRS-Granularität. Jede Änderung
 * (Position, Name, Kategorie) ist eine separate Command. Vorteile:
 * - Klare Audit-Trails (PoiPositionUpdatedEvent vs PoiNameUpdatedEvent)
 * - Optimistic Locking per Operation (verhindert lost updates)
 * - Backend kann Positionsänderungen limitieren (Rate-Limiting pro Command-Typ)
 *
 * Warum alte + neue Koordinate im Event: Event-Carried State Transfer.
 * Consumer können Distanz berechnen (z.B. Warnung bei >500m Sprüngen)
 * ohne N+1 DB-Queries.
 */
export class UpdatePoiPositionCommand {
  constructor(
    public readonly lagekarteId: string,
    public readonly poiId: string,
    public readonly newCoordinate: { lat: number; lng: number } | { mgrs: string },
  ) {
    // Validation: All required
    if (!lagekarteId || lagekarteId.trim().length === 0) {
      throw new Error('lagekarteId is required');
    }
    if (!poiId || poiId.trim().length === 0) {
      throw new Error('poiId is required');
    }
    if (!newCoordinate) {
      throw new Error('newCoordinate is required');
    }
  }
}
