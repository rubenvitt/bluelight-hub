import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import type { Result } from '@domain/common/result';

/**
 * Input-Typ für Koordinaten (Frontend kann beide Formate senden).
 */
export type CoordinateInput = { lat: number; lng: number } | { mgrs: string };

/**
 * Konvertiert Koordinaten-Input (Lat/Lng ODER MGRS) zu MGRS.
 *
 * Warum Application Layer: Format-Transformation ist Verantwortung
 * der Application Layer, nicht der Domain Layer. Die Domain arbeitet
 * ausschließlich mit MGRS (DRK-Standard für taktische Lagekarten).
 *
 * Warum statische Klasse: Keine Abhängigkeiten, reine Utility-Funktion.
 * Könnte alternativ als freie Funktion implementiert werden.
 *
 * @public
 */
export class CoordinateConverter {
  /**
   * Konvertiert Koordinaten-Input zu MGRS.
   *
   * @param coordinate - Input-Koordinaten (Lat/Lng oder MGRS)
   * @returns Result mit MgrsCoordinate oder Fehlermeldung
   *
   * @public
   */
  public static toMgrs(coordinate: CoordinateInput): Result<MgrsCoordinate> {
    if ('mgrs' in coordinate) {
      // MGRS String direkt verwenden
      return MgrsCoordinate.fromString(coordinate.mgrs);
    }
    // Lat/Lng zu MGRS konvertieren
    return MgrsCoordinate.fromLatLng(coordinate.lat, coordinate.lng);
  }
}
