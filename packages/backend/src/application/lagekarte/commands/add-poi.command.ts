import { Result } from '@domain/common/result';

/**
 * Command zum Hinzufügen eines POI zu einer bestehenden Lagekarte.
 *
 * Warum separate Command statt "Update Lagekarte": CQRS-Pattern trennt
 * Write-Operationen in granulare Commands. Jede Command hat einen
 * klaren Business-Intent (AddPoi vs UpdatePoiPosition vs RemovePoi).
 *
 * Koordinaten-Unterstützung: Frontend kann sowohl Lat/Lng (Benutzer-Input
 * via Klick auf Karte) als auch MGRS (Funkdurchsage) senden. Handler
 * konvertiert automatisch zu MGRS (DRK-Standard).
 */
export class AddPoiCommand {
  /**
   * Privater Konstruktor - erzwingt Verwendung der Factory-Methode.
   *
   * @param lagekarteId - Eindeutige ID der Lagekarte (Nanoid, 21 Zeichen)
   * @param name - Name des POI für Funkdurchsagen (muss eindeutig sein)
   * @param coordinate - Koordinaten als Lat/Lng (WGS84) ODER MGRS (DRK-Standard)
   * @param category - POI-Kategorie (z.B. EINSATZSTELLE, BEREITSTELLUNGSRAUM)
   * @param beschreibung - Optionale Zusatzinformationen zum POI für Lagedarstellung
   */
  private constructor(
    public readonly lagekarteId: string,
    public readonly name: string,
    public readonly coordinate: { lat: number; lng: number } | { mgrs: string },
    public readonly category: string,
    public readonly beschreibung?: string,
  ) {}

  /**
   * Factory-Methode für AddPoiCommand mit Validierung.
   *
   * Warum hier: Result<T>-Pattern für konsistente Fehlerbehandlung ohne
   * Exceptions. Command-Validierung stellt sicher, dass nur gültige POI-Daten
   * ins Domain-Layer gelangen (Defense in Depth).
   *
   * @param lagekarteId - ID der Lagekarte, zu der der POI hinzugefügt wird
   * @param name - Name des POI
   * @param coordinate - Koordinate (Lat/Lng oder MGRS)
   * @param category - Kategorie des POI
   * @param beschreibung - Optionale Beschreibung
   * @returns Result mit validiertem Command oder Fehlermeldung
   */
  public static create(lagekarteId: string, name: string, coordinate: { lat: number; lng: number } | { mgrs: string }, category: string, beschreibung?: string): Result<AddPoiCommand> {
    // Validation: All required fields
    if (!lagekarteId || lagekarteId.trim().length === 0) {
      return Result.fail('lagekarteId is required');
    }
    if (!name || name.trim().length === 0) {
      return Result.fail('name is required');
    }
    if (!coordinate) {
      return Result.fail('coordinate is required');
    }
    if (!category || category.trim().length === 0) {
      return Result.fail('category is required');
    }

    return Result.ok(new AddPoiCommand(lagekarteId, name, coordinate, category, beschreibung));
  }
}
