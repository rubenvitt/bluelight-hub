import { ValueObject } from '@domain/common/value-object';
import { Result } from '@domain/common/result';
import { GeoCoordinate } from './geo-coordinate';
import * as mgrs from 'mgrs';

/**
 * Properties für MgrsCoordinate Value Object.
 */
interface MgrsCoordinateProps extends Record<string, unknown> {
  value: string; // Full MGRS string (e.g., "33UUU1234567890")
  gridZone: string; // Grid Zone Designator (e.g., "33U")
  squareId: string; // 100km Square ID (e.g., "UU")
  easting: number; // Easting coordinate in meters
  northing: number; // Northing coordinate in meters
  precision: number; // Precision in meters (1, 10, 100, 1000, 10000, 100000)
}

/**
 * Value Object für MGRS (Military Grid Reference System) Koordinaten.
 *
 * MGRS ist der Standard-Koordinatentyp für DRK-Einsatzleitung, da er:
 * - Kompakter ist als Lat/Lng (weniger Fehleranfällig bei Funkdurchsagen)
 * - Metrik ist (Distanzen in Metern direkt ablesbar)
 * - NATO-Standard ist (Interoperabilität mit anderen Hilfsorganisationen)
 *
 * Format: `Zone(1-2digits) + LatBand(1letter) + GridSquare(2letters) + Coordinates(even digits)`
 * Beispiel: `33UUU1234567890` = Zone 33U, Grid UU, 10-digit coords (1m precision)
 *
 * Deutsche MGRS-Zonen:
 * - Zone 32U: Western/Northern Germany (Hamburg, Cologne)
 * - Zone 33U: Eastern Germany (Berlin, Leipzig, Dresden)
 * - Zone 33N: Central/Southern Germany (Frankfurt, Stuttgart, Munich)
 *
 * @example
 * ```typescript
 * // Von MGRS-String erstellen
 * const result = MgrsCoordinate.fromString("33UUU1234567890");
 * if (result.isSuccess) {
 *   const mgrs = result.value;
 *   console.log(mgrs.gridZone); // "33U"
 *   console.log(mgrs.precision); // 1 (meter)
 * }
 *
 * // Von Lat/Lng konvertieren
 * const result2 = MgrsCoordinate.fromLatLng(52.52, 13.40, 5); // 5 = 1m precision
 * if (result2.isSuccess) {
 *   console.log(result2.value.value); // "33UUU..."
 * }
 *
 * // Distanz berechnen
 * const berlin = MgrsCoordinate.fromLatLng(52.52, 13.40, 3).getValue();
 * const hamburg = MgrsCoordinate.fromLatLng(53.55, 10.00, 3).getValue();
 * const distanceKm = berlin.distanceTo(hamburg) / 1000; // ~255 km
 * ```
 */
export class MgrsCoordinate extends ValueObject<MgrsCoordinateProps> {
  /**
   * Regex für MGRS-Format Validierung.
   * Format: 1-2 Ziffern + 3 Buchstaben + optionale gerade Anzahl Ziffern (0-10)
   * Buchstaben: C-HJ-NP-X (kein I oder O wegen Verwechslungsgefahr mit 1 und 0)
   */
  private static readonly MGRS_REGEX = /^\d{1,2}[C-HJ-NP-X]{3}(\d{10}|\d{8}|\d{6}|\d{4}|\d{2})?$/;

  /**
   * Set erlaubter MGRS-Zonen für Deutschland.
   * Validiert, dass Koordinaten im deutschen Einsatzgebiet liegen.
   */
  private static readonly GERMAN_ZONES: ReadonlySet<string> = new Set(['32U', '33U', '33N']);

  /**
   * Earth radius in meters (für Haversine-Formel).
   */
  private static readonly EARTH_RADIUS_M = 6371000;

  /**
   * Protected Constructor erzwingt Factory Method Nutzung.
   *
   * @param props - Die Properties mit validierter MGRS-Koordinate
   */
  private constructor(props: MgrsCoordinateProps) {
    super(props);
  }

  /**
   * Readonly getter für den MGRS-String.
   * @returns Der vollständige MGRS-String
   */
  get value(): string {
    return this.props.value;
  }

  /**
   * Readonly getter für Grid Zone Designator.
   * @returns Grid Zone (z.B. "33U")
   */
  get gridZone(): string {
    return this.props.gridZone;
  }

  /**
   * Readonly getter für 100km Square ID.
   * @returns Square ID (z.B. "UU")
   */
  get squareId(): string {
    return this.props.squareId;
  }

  /**
   * Readonly getter für Easting-Koordinate.
   * @returns Easting in Metern
   */
  get easting(): number {
    return this.props.easting;
  }

  /**
   * Readonly getter für Northing-Koordinate.
   * @returns Northing in Metern
   */
  get northing(): number {
    return this.props.northing;
  }

  /**
   * Readonly getter für Präzision.
   * @returns Präzision in Metern (1, 10, 100, 1000, 10000, 100000)
   */
  get precision(): number {
    return this.props.precision;
  }

  /**
   * Factory Method: Erstellt MgrsCoordinate aus MGRS-String.
   *
   * Validiert Format, deutsche Zonen und extrahiert alle Komponenten.
   * Nutzt mgrs.inverse() zur Validierung, dass der String tatsächlich parsebar ist.
   *
   * @param mgrsString - MGRS-String (z.B. "33UUU1234567890")
   * @returns Result<MgrsCoordinate> - Success oder Failure mit Fehlermeldung
   *
   * @example
   * ```typescript
   * // Validiert MGRS-String (Berlin)
   * const result1 = MgrsCoordinate.fromString("33UUU8990317936");
   * // result1.isSuccess === true
   *
   * // Ungültiges Format
   * const result2 = MgrsCoordinate.fromString("33UUU123"); // Odd digits
   * // result2.isFailure === true
   *
   * // Falsche Zone (nicht Deutschland)
   * const result3 = MgrsCoordinate.fromString("10UGC1234567890");
   * // result3.isFailure === true
   * ```
   */
  public static fromString(mgrsString: string): Result<MgrsCoordinate> {
    // Normalize zu uppercase
    const normalized = mgrsString.toUpperCase().trim();

    // Validate format via regex
    if (!MgrsCoordinate.MGRS_REGEX.test(normalized)) {
      return Result.fail<MgrsCoordinate>(`Invalid MGRS format: ${mgrsString}. Must match pattern: Zone(1-2digits) + LatBand(1letter) + GridSquare(2letters) + Coordinates(even digits 0-10)`);
    }

    // Extract grid zone (first 2-3 chars: digits + letter)
    const zoneMatch = normalized.match(/^(\d{1,2}[C-HJ-NP-X])/);
    if (!zoneMatch) {
      return Result.fail<MgrsCoordinate>(`Could not extract grid zone from: ${mgrsString}`);
    }
    const gridZone = zoneMatch[1];

    // Null safety check for gridZone
    if (!gridZone) {
      return Result.fail<MgrsCoordinate>(`Could not extract grid zone from: ${mgrsString}`);
    }

    // Validate German zones
    if (!MgrsCoordinate.GERMAN_ZONES.has(gridZone)) {
      const allowedZones = Array.from(MgrsCoordinate.GERMAN_ZONES).join(', ');
      return Result.fail<MgrsCoordinate>(`Invalid grid zone: ${gridZone}. Must be one of German zones: ${allowedZones}`);
    }

    // Extract square ID (next 2 letters after zone)
    const squareId = normalized.substring(gridZone.length, gridZone.length + 2);

    // Extract coordinate digits (remaining part)
    const coordDigits = normalized.substring(gridZone.length + 2);
    const digitCount = coordDigits.length;

    // Calculate precision based on digit count
    // 0 digits = 100km, 2 = 10km, 4 = 1km, 6 = 100m, 8 = 10m, 10 = 1m
    const precision = digitCount === 0 ? 100000 : 10 ** (5 - digitCount / 2);

    // Validate parseability via mgrs.inverse()
    try {
      const bbox = mgrs.inverse(normalized);
      // bbox = [minLon, minLat, maxLon, maxLat]
      if (!bbox || bbox.length !== 4) {
        return Result.fail<MgrsCoordinate>(`MGRS string could not be parsed: ${mgrsString}`);
      }
    } catch (error) {
      return Result.fail<MgrsCoordinate>(`Invalid MGRS string: ${mgrsString}. Error: ${error}`);
    }

    // Extract easting/northing from coordinate digits
    const halfDigits = digitCount / 2;
    const eastingStr = coordDigits.substring(0, halfDigits);
    const northingStr = coordDigits.substring(halfDigits);

    // Pad to 5 digits and convert to meters
    const easting = Number.parseInt(eastingStr.padEnd(5, '0'), 10);
    const northing = Number.parseInt(northingStr.padEnd(5, '0'), 10);

    // Success: Erstelle MgrsCoordinate Instanz
    return Result.ok(
      new MgrsCoordinate({
        value: normalized,
        gridZone,
        squareId,
        easting,
        northing,
        precision,
      }),
    );
  }

  /**
   * Factory Method: Erstellt MgrsCoordinate aus Lat/Lng.
   *
   * Diese Methode wird verwendet, wenn externe APIs (z.B. Nominatim Geocoding)
   * Lat/Lng zurückgeben, aber die DRK-Standardisierung MGRS als primäres
   * Koordinatensystem erfordert.
   *
   * WICHTIG: Longitude kommt vor Latitude in mgrs.forward()!
   * Die mgrs-Library nutzt [lon, lat] Reihenfolge, nicht [lat, lon].
   *
   * @param lat - Latitude in Grad (WGS84 Datum)
   * @param lng - Longitude in Grad (WGS84 Datum)
   * @param precision - MGRS-Genauigkeit (0-5, wobei 5 = 1m). Default: 5
   * @returns Result<MgrsCoordinate> - Success oder Failure
   *
   * @example
   * ```typescript
   * // Berlin (52.52°N, 13.40°E) → MGRS
   * const result = MgrsCoordinate.fromLatLng(52.52, 13.40, 5);
   * if (result.isSuccess) {
   *   console.log(result.value.value); // "33UUU..."
   *   console.log(result.value.gridZone); // "33U"
   *   console.log(result.value.precision); // 1 (meter)
   * }
   * ```
   */
  public static fromLatLng(lat: number, lng: number, precision = 5): Result<MgrsCoordinate> {
    // Validate latitude range
    if (lat < -90 || lat > 90) {
      return Result.fail<MgrsCoordinate>(`Invalid latitude: ${lat}. Must be between -90 and 90`);
    }

    // Validate longitude range
    if (lng < -180 || lng > 180) {
      return Result.fail<MgrsCoordinate>(`Invalid longitude: ${lng}. Must be between -180 and 180`);
    }

    // Validate precision range
    if (precision < 0 || precision > 5) {
      return Result.fail<MgrsCoordinate>(`Invalid precision: ${precision}. Must be between 0 and 5`);
    }

    // Convert to MGRS (NOTE: mgrs.forward expects [lon, lat], not [lat, lon]!)
    try {
      const mgrsString = mgrs.forward([lng, lat], precision);
      if (!mgrsString || typeof mgrsString !== 'string') {
        return Result.fail<MgrsCoordinate>(`Failed to convert Lat/Lng to MGRS: (${lat}, ${lng})`);
      }

      // Use fromString to create instance (validates German zones)
      return MgrsCoordinate.fromString(mgrsString);
    } catch (error) {
      return Result.fail<MgrsCoordinate>(`Error converting Lat/Lng to MGRS: ${error}`);
    }
  }

  /**
   * Konvertiert MGRS zu WGS84 Lat/Lng (Mittelpunkt).
   *
   * Nutzt mgrs.toPoint() zur Konvertierung. Gibt den Mittelpunkt der
   * MGRS-Zelle zurück, nicht die südwestliche Ecke.
   *
   * @returns GeoCoordinate - Mittelpunkt der MGRS-Zelle
   *
   * @example
   * ```typescript
   * const mgrs = MgrsCoordinate.fromString("33UUU1234567890").getValue();
   * const latLng = mgrs.toLatLng();
   * console.log(latLng.toString()); // "52.5200°N, 13.4000°E" (approx)
   * ```
   */
  public toLatLng(): GeoCoordinate {
    // mgrs.toPoint returns [lon, lat] (center point)
    const [lon, lat] = mgrs.toPoint(this.value);

    // GeoCoordinate.create() always succeeds here because mgrs.toPoint
    // returns valid WGS84 coordinates by definition
    return GeoCoordinate.create(lat, lon).value as GeoCoordinate;
  }

  /**
   * Berechnet die Bounding Box der MGRS-Zelle.
   *
   * Nutzt mgrs.inverse() zur Berechnung. Gibt die südwestliche und
   * nordöstliche Ecke der Zelle zurück.
   *
   * @returns Bounding Box { minLat, minLng, maxLat, maxLng }
   *
   * @example
   * ```typescript
   * const mgrs = MgrsCoordinate.fromString("33UUU1234567890").getValue();
   * const bbox = mgrs.toBoundingBox();
   * console.log(bbox); // { minLat: 52.52, minLng: 13.40, maxLat: 52.521, maxLng: 13.401 }
   * ```
   */
  public toBoundingBox(): { minLat: number; minLng: number; maxLat: number; maxLng: number } {
    // mgrs.inverse returns [minLon, minLat, maxLon, maxLat]
    const [minLon, minLat, maxLon, maxLat] = mgrs.inverse(this.value);

    return {
      minLat,
      minLng: minLon,
      maxLat,
      maxLng: maxLon,
    };
  }

  /**
   * Berechnet die Distanz zu einer anderen MGRS-Koordinate.
   *
   * Konvertiert beide MGRS-Koordinaten zu Lat/Lng und nutzt dann die
   * Haversine-Formel zur Distanzberechnung. Berücksichtigt Erdkrümmung.
   *
   * @param other - Die Zielkoordinate (MGRS)
   * @returns Distanz in Metern
   *
   * @example
   * ```typescript
   * const berlin = MgrsCoordinate.fromLatLng(52.52, 13.40, 3).getValue();
   * const hamburg = MgrsCoordinate.fromLatLng(53.55, 10.00, 3).getValue();
   * const distanceKm = berlin.distanceTo(hamburg) / 1000;
   * console.log(distanceKm); // ~255 km
   * ```
   */
  public distanceTo(other: MgrsCoordinate): number {
    // Convert both to Lat/Lng
    const latLng1 = this.toLatLng();
    const latLng2 = other.toLatLng();

    // Use Haversine formula
    const lat1Rad = this.toRadians(latLng1.latitude);
    const lat2Rad = this.toRadians(latLng2.latitude);
    const dLatRad = this.toRadians(latLng2.latitude - latLng1.latitude);
    const dLngRad = this.toRadians(latLng2.longitude - latLng1.longitude);

    const a = Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLngRad / 2) * Math.sin(dLngRad / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return MgrsCoordinate.EARTH_RADIUS_M * c; // Distance in meters
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
   * String-Repräsentation: Gibt MGRS-String zurück.
   *
   * @returns MGRS-String
   *
   * @example
   * ```typescript
   * const mgrs = MgrsCoordinate.fromString("33UUU1234567890").getValue();
   * console.log(mgrs.toString()); // "33UUU1234567890"
   * ```
   */
  public toString(): string {
    return this.value;
  }
}
