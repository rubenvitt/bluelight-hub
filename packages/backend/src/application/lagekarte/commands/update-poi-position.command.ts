import { Result } from '@domain/common/result';

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
  private constructor(
    public readonly lagekarteId: string,
    public readonly poiId: string,
    public readonly newCoordinate: { lat: number; lng: number } | { mgrs: string },
  ) {}

  /**
   * Factory-Methode für UpdatePoiPositionCommand mit Validierung.
   *
   * Warum hier: Result<T>-Pattern für konsistente Fehlerbehandlung.
   * Command-Validierung verhindert ungültige Positionsupdates (z.B. leere
   * Koordinaten) bevor sie ins Domain-Layer gelangen.
   *
   * @param lagekarteId - ID der Lagekarte
   * @param poiId - ID des POI
   * @param newCoordinate - Neue Koordinate (Lat/Lng oder MGRS)
   * @returns Result mit validiertem Command oder Fehlermeldung
   */
  public static create(lagekarteId: string, poiId: string, newCoordinate: { lat: number; lng: number } | { mgrs: string }): Result<UpdatePoiPositionCommand> {
    // Validation: All required
    if (!lagekarteId || lagekarteId.trim().length === 0) {
      return Result.fail('lagekarteId is required');
    }
    if (!poiId || poiId.trim().length === 0) {
      return Result.fail('poiId is required');
    }
    if (!newCoordinate) {
      return Result.fail('newCoordinate is required');
    }

    return Result.ok(new UpdatePoiPositionCommand(lagekarteId, poiId, newCoordinate));
  }
}
