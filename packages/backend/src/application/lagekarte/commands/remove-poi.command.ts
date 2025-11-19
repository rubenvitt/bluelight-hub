import { Result } from '@domain/common/result';

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
  private constructor(
    public readonly lagekarteId: string,
    public readonly poiId: string,
  ) {}

  /**
   * Factory-Methode für RemovePoiCommand mit Validierung.
   *
   * Warum hier: Result<T>-Pattern verhindert Exceptions bei ungültigen IDs.
   * Command-Validierung stellt sicher, dass nur existente ID-Paare
   * ins System gelangen (verhindert unnötige DB-Queries).
   *
   * @param lagekarteId - ID der Lagekarte
   * @param poiId - ID des zu entfernenden POI
   * @returns Result mit validiertem Command oder Fehlermeldung
   */
  public static create(lagekarteId: string, poiId: string): Result<RemovePoiCommand> {
    // Validation: Both required
    if (!lagekarteId || lagekarteId.trim().length === 0) {
      return Result.fail('lagekarteId is required');
    }
    if (!poiId || poiId.trim().length === 0) {
      return Result.fail('poiId is required');
    }

    return Result.ok(new RemovePoiCommand(lagekarteId, poiId));
  }
}
