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
  constructor(
    public readonly lagekarteId: string,
    public readonly name: string,
    public readonly coordinate: { lat: number; lng: number } | { mgrs: string },
    public readonly category: string,
    public readonly beschreibung?: string,
  ) {
    // Validation: All required fields
    if (!lagekarteId || lagekarteId.trim().length === 0) {
      throw new Error('lagekarteId is required');
    }
    if (!name || name.trim().length === 0) {
      throw new Error('name is required');
    }
    if (!coordinate) {
      throw new Error('coordinate is required');
    }
    if (!category || category.trim().length === 0) {
      throw new Error('category is required');
    }
  }
}
