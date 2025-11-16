import { ValueObject } from '@domain/common/value-object';
import { Result } from '@domain/common/result';

/**
 * Properties für GeoCoordinate Value Object.
 */
interface GeoCoordinateProps {
  latitude: number; // WGS84 datum, range [-90, 90]
  longitude: number; // WGS84 datum, range [-180, 180]
}

/**
 * Value Object für WGS84 Lat/Lng Koordinaten.
 *
 * Kapselt geografische Koordinaten im WGS84-Datum (World Geodetic System 1984),
 * dem Standard für GPS und moderne Kartografie. Bietet Validierung der Koordinaten-Ranges
 * und Distanzberechnung via Haversine-Formel.
 *
 * Wichtig: Obwohl MGRS der Standardkoordinaten-Typ für DRK-Einsätze ist,
 * werden GeoCoordinates für externe API-Integrationen (z.B. Nominatim Geocoding)
 * benötigt, da diese oft nur Lat/Lng zurückgeben.
 *
 * Konvertierung zu MGRS: Nutze MgrsCoordinate.fromLatLng() direkt (vermeidet Circular Dependency).
 *
 * @example
 * ```typescript
 * // Berlin Koordinaten
 * const result = GeoCoordinate.create(52.52, 13.40);
 * if (result.isSuccess) {
 *   const coord = result.value;
 *   console.log(coord.latitude); // 52.52
 *   console.log(coord.longitude); // 13.40
 *   console.log(coord.toString()); // "52.5200°N, 13.4000°E"
 *
 *   // Distanzberechnung
 *   const hamburg = GeoCoordinate.create(53.55, 10.00).value;
 *   const distanceKm = coord.distanceTo(hamburg) / 1000; // ~255 km
 * }
 * ```
 */
export class GeoCoordinate extends ValueObject<GeoCoordinateProps> {
  /**
   * Earth radius in meters (für Haversine-Formel).
   * Mittlerer Erdradius nach WGS84.
   */
  private static readonly EARTH_RADIUS_M = 6371000;

  /**
   * Protected Constructor erzwingt Factory Method Nutzung.
   *
   * @param props - Die Properties mit validierten Koordinaten
   */
  private constructor(props: GeoCoordinateProps) {
    super(props);
  }

  /**
   * Readonly getter für Latitude.
   * @returns Latitude in Grad [-90, 90]
   */
  get latitude(): number {
    return this.props.latitude;
  }

  /**
   * Readonly getter für Longitude.
   * @returns Longitude in Grad [-180, 180]
   */
  get longitude(): number {
    return this.props.longitude;
  }

  /**
   * Factory Method mit Koordinaten-Validierung.
   *
   * Validiert Latitude- und Longitude-Ranges gemäß WGS84-Standard.
   * Verwendet Result<T> Pattern zur expliziten Fehlerbehandlung statt Exceptions.
   *
   * @param lat - Latitude in Grad (muss zwischen -90 und 90 liegen)
   * @param lng - Longitude in Grad (muss zwischen -180 und 180 liegen)
   * @returns Result<GeoCoordinate> - Success oder Failure mit Fehlermeldung
   *
   * @example
   * ```typescript
   * // Valide Koordinaten (Berlin)
   * const result1 = GeoCoordinate.create(52.52, 13.40);
   * // result1.isSuccess === true
   *
   * // Ungültige Latitude (> 90)
   * const result2 = GeoCoordinate.create(91.0, 13.40);
   * // result2.isFailure === true
   * // result2.error === "Invalid latitude: 91. Must be between -90 and 90"
   *
   * // Ungültige Longitude (< -180)
   * const result3 = GeoCoordinate.create(52.52, -181.0);
   * // result3.isFailure === true
   * // result3.error === "Invalid longitude: -181. Must be between -180 and 180"
   * ```
   */
  public static create(lat: number, lng: number): Result<GeoCoordinate> {
    // Validate latitude range [-90, 90]
    if (lat < -90 || lat > 90) {
      return Result.fail<GeoCoordinate>(`Invalid latitude: ${lat}. Must be between -90 and 90`);
    }

    // Validate longitude range [-180, 180]
    if (lng < -180 || lng > 180) {
      return Result.fail<GeoCoordinate>(`Invalid longitude: ${lng}. Must be between -180 and 180`);
    }

    // Success: Erstelle GeoCoordinate Instanz
    return Result.ok(new GeoCoordinate({ latitude: lat, longitude: lng }));
  }

  /**
   * Berechnet die Distanz zu einer anderen GeoCoordinate.
   *
   * Nutzt die Haversine-Formel zur Berechnung der kürzesten Distanz entlang
   * der Erdoberfläche (Great Circle Distance). Berücksichtigt die Erdkrümmung
   * und ist genau genug für Einsatz-Distanzen bis ~10.000km.
   *
   * Hinweis: Für Distanzen > 10.000km sollte die Vincenty-Formel verwendet werden,
   * aber das ist für deutsche Einsatzgebiete nicht relevant.
   *
   * @param other - Die Zielkoordinate
   * @returns Distanz in Metern
   *
   * @example
   * ```typescript
   * const berlin = GeoCoordinate.create(52.52, 13.40).getValue();
   * const hamburg = GeoCoordinate.create(53.55, 10.00).getValue();
   * const distanceKm = berlin.distanceTo(hamburg) / 1000;
   * console.log(distanceKm); // ~255 km
   * ```
   */
  public distanceTo(other: GeoCoordinate): number {
    // Haversine formula
    const lat1Rad = this.toRadians(this.latitude);
    const lat2Rad = this.toRadians(other.latitude);
    const dLatRad = this.toRadians(other.latitude - this.latitude);
    const dLngRad = this.toRadians(other.longitude - this.longitude);

    const a = Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLngRad / 2) * Math.sin(dLngRad / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return GeoCoordinate.EARTH_RADIUS_M * c; // Distance in meters
  }

  /**
   * Konvertiert Grad zu Radianten.
   * @param degrees - Winkel in Grad
   * @returns Winkel in Radianten
   */
  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * String-Repräsentation im Format "52.5200°N, 13.4000°E".
   *
   * Formatiert Koordinaten mit Himmelsrichtungen (N/S für Latitude, E/W für Longitude)
   * und 4 Dezimalstellen (~11m Genauigkeit), was für Einsatzleitung ausreichend ist.
   *
   * @returns Formatierter Koordinaten-String
   *
   * @example
   * ```typescript
   * const berlin = GeoCoordinate.create(52.52, 13.40).getValue();
   * console.log(berlin.toString()); // "52.5200°N, 13.4000°E"
   *
   * const capeTown = GeoCoordinate.create(-33.92, 18.42).getValue();
   * console.log(capeTown.toString()); // "33.9200°S, 18.4200°E"
   * ```
   */
  public toString(): string {
    const latDirection = this.latitude >= 0 ? 'N' : 'S';
    const lngDirection = this.longitude >= 0 ? 'E' : 'W';

    const latAbs = Math.abs(this.latitude).toFixed(4);
    const lngAbs = Math.abs(this.longitude).toFixed(4);

    return `${latAbs}°${latDirection}, ${lngAbs}°${lngDirection}`;
  }
}
