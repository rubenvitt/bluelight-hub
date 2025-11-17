import type { Result } from '../../common/result';
import type { GeoCoordinate } from '../../value-objects/geo-coordinate';
import type { Address } from '../../value-objects/address';

/**
 * Geocoding Service Port (Hexagonal Architecture - Domain Service Interface).
 *
 * Dieses Interface definiert den Contract für Geocoding-Services.
 * Die Implementierung erfolgt in Epic 2 (Infrastructure Layer) mit
 * Nominatim Adapter (OpenStreetMap Geocoding).
 *
 * Warum Port Pattern für Geocoding?
 * - Domain Layer hat KEINE Abhängigkeit zur konkreten Geocoding-API
 * - Infrastructure Layer kann Nominatim, Google Maps, oder andere Services nutzen
 * - Austausch der Geocoding-Provider ohne Domain-Änderungen möglich
 * - Unit Tests können Mock-Implementierung nutzen
 *
 * Workflow für Lagekarte-Erstellung:
 * 1. User gibt Adresse ein (z.B. "Brandenburger Tor, Berlin")
 * 2. Application Layer ruft IGeocodingPort.geocodeAddress() auf
 * 3. Infrastructure Layer nutzt Nominatim API → Lat/Lng zurück
 * 4. Lat/Lng wird zu MGRS konvertiert (via mgrs package)
 * 5. MGRS wird an LagekarteAggregate übergeben
 * 6. Lagekarte wird gespeichert (mit MGRS-Koordinaten)
 *
 * Rückwärts-Workflow für POI-Details:
 * 1. POI hat MGRS-Koordinaten (gespeichert in Lagekarte)
 * 2. Application Layer konvertiert MGRS → Lat/Lng (via mgrs package)
 * 3. Application Layer ruft IGeocodingPort.reverseGeocode() auf
 * 4. Infrastructure Layer nutzt Nominatim API → Adresse zurück
 * 5. Adresse wird mit POI-Details angezeigt (z.B. "Dieser POI liegt bei XYZ Straße")
 *
 * Fehlerbehandlung (Result Pattern):
 * - Network Errors: Nominatim API nicht erreichbar
 * - Invalid Input: Adresse zu vage/mehrdeutig
 * - Rate Limiting: Zu viele Geocoding-Anfragen (implementiert via Infrastructure Layer)
 *
 * @example
 * ```typescript
 * // Infrastructure Layer Implementation (Nominatim Adapter)
 * class NominatimGeocodingAdapter implements IGeocodingPort {
 *   async geocodeAddress(address: Address): Promise<Result<GeoCoordinate>> {
 *     const query = address.toString();
 *     const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json`);
 *     if (!response.ok) {
 *       return Result.fail('Nominatim API error');
 *     }
 *     const [data] = await response.json();
 *     const coord = GeoCoordinate.create(parseFloat(data.lat), parseFloat(data.lon));
 *     return coord;
 *   }
 * }
 * ```
 */
export interface IGeocodingPort {
  /**
   * Geocodiert eine Adresse zu Lat/Lng-Koordinaten.
   *
   * Diese Methode wird verwendet, um aus einer Einsatzadresse (z.B. "Brandenburger Tor, Berlin")
   * GPS-Koordinaten zu ermitteln. Die Koordinaten werden dann zu MGRS konvertiert,
   * bevor sie an das LagekarteAggregate übergeben werden.
   *
   * Eingabe → Verarbeitung → Ausgabe:
   * - Input: Address Value Object mit optionalen Feldern (strasse, hausnummer, plz, ort)
   * - Processing: Nominatim API Lookup (oder andere Geocoding-Provider)
   * - Output: GeoCoordinate (Lat/Lng im WGS84 Datum) oder Fehler
   *
   * Workflow in Application Layer:
   * 1. CreateLagekarteCommandHandler erhält Address vom User
   * 2. Ruft IGeocodingPort.geocodeAddress(address) auf
   * 3. Wenn Result.isSuccess: Konvertiere Lat/Lng zu MGRS (via mgrs package)
   * 4. Übergebe MGRS an LagekarteAggregate.create()
   * 5. Speichere Lagekarte im Repository
   *
   * Fehlerbehandlung:
   * - Nominatim nicht erreichbar: Result.fail('Network error: ...')
   * - Adresse nicht geocodierbar: Result.fail('Address not found')
   * - Ungültige Koordinaten: Result.fail('Invalid coordinates')
   *
   * Rate Limiting:
   * - Nominatim erlaubt ~1 request/second (siehe https://nominatim.org/usage_policy.html)
   * - Infrastructure Layer implementiert Caching und Backoff-Strategie
   * - Domain Layer prüft nur Result.isSuccess, kümmert sich nicht um Rate Limits
   *
   * Warum Lat/Lng statt direkt MGRS?
   * - Geocoding-APIs geben typischerweise Lat/Lng zurück
   * - MGRS Konvertierung ist mathematische Transformation (gehört zu Domain nicht zu Infrastructure)
   * - MGRS ist DRK-spezifisch, sollte Domain sein, nicht Infrastructure-abhängig
   * - Separation of Concerns: Geocoding (extern) ≠ MGRS-Konvertierung (intern)
   *
   * @param address - Adress-Value-Object (von Story 1.3, mit strasse, hausnummer, plz, ort)
   * @returns Result<GeoCoordinate> - Erfolg mit Lat/Lng oder Fehler-String
   *
   * @example
   * ```typescript
   * // In CreateLagekarteCommandHandler
   * const addressResult = Address.create({
   *   strasse: 'Brandenburger Tor',
   *   ort: 'Berlin',
   *   plz: '10115'
   * });
   *
   * if (addressResult.isFailure) {
   *   throw new InvalidAddressError(addressResult.error);
   * }
   *
   * const address = addressResult.value!;
   * const geocodeResult = await this.geocodingPort.geocodeAddress(address);
   *
   * if (geocodeResult.isFailure) {
   *   throw new GeocodingError(`Konnte Adresse nicht geocodieren: ${geocodeResult.error}`);
   * }
   *
   * // Konvertiere Lat/Lng zu MGRS
   * const mgrsCoord = MgrsCoordinate.fromLatLng(geocodeResult.value!);
   *
   * // Erstelle Lagekarte mit MGRS-Koordinaten
   * const lagekarte = LagekarteAggregate.create({
   *   id: lagekarteId,
   *   einsatzId: einsatzId,
   *   coordinates: mgrsCoord,
   * });
   *
   * await this.lagekarteRepository.save(lagekarte);
   * ```
   */
  geocodeAddress(address: Address): Promise<Result<GeoCoordinate>>;

  /**
   * Reverse-Geocoding: Lat/Lng-Koordinaten → lesbare Adresse.
   *
   * Diese Methode wird verwendet, um aus WGS84-Koordinaten eine lesbare Adresse zu erzeugen.
   * Dies ist wichtig für POI-Details und Lagekarten-Anzeige, wo User lesbare Adressen
   * statt nur Koordinaten sehen möchten.
   *
   * Workflow in Application Layer:
   * 1. GetPoiDetailsQueryHandler hat POI mit MGRS-Koordinaten
   * 2. Konvertiere MGRS zu Lat/Lng (via mgrs package)
   * 3. Rufe IGeocodingPort.reverseGeocode(geoCoordinate) auf
   * 4. Wenn Result.isSuccess: Zeige lesbare Adresse an
   * 5. Wenn Result.isFailure: Zeige nur Koordinaten-String an (Fallback)
   *
   * Eingabe → Verarbeitung → Ausgabe:
   * - Input: GeoCoordinate (Lat/Lng im WGS84 Datum)
   * - Processing: Nominatim Reverse-Geocoding Lookup (oder andere Provider)
   * - Output: Address Value Object mit strasse, hausnummer, plz, ort (jeweils optional)
   *
   * Fehlerbehandlung:
   * - Nominatim nicht erreichbar: Result.fail('Network error: ...')
   * - Keine Adresse für Koordinaten gefunden: Result.fail('No address found')
   * - Ungültige Koordinaten: Result.fail('Invalid coordinates')
   *
   * Besonderheiten:
   * - Nicht alle Punkte auf der Erde haben eine "Adresse" (z.B. mitten im Meer)
   * - Reverse-Geocoding kann mehrdeutig sein (mehrere POIs an gleicher Stelle)
   * - Infrastructure Layer sollte Partial Results erlauben (nur Ort ohne Strasse)
   *
   * UI-Fallback Strategie:
   * - Reverse-Geocoding erfolgreich: Zeige Adresse an
   * - Reverse-Geocoding fehlgeschlagen: Zeige Koordinaten-String an (toString())
   * - Never crash: Immer lesbare Info anzeigen
   *
   * Warum Reverse-Geocoding optional?
   * - Nicht überall verfügbar (nur in Ballungsräumen zuverlässig)
   * - Kann langsam sein (separate API Call)
   * - Nice-to-have, aber nicht kritisch für Lagekarten-Funktionalität
   * - Domain Layer macht weiter, auch wenn Reverse-Geocoding fehlschlägt
   *
   * @param coordinate - GeoCoordinate (Lat/Lng, typischerweise von MGRS.toLatLng() konvertiert)
   * @returns Result<Address> - Success mit Address oder Fehler-String
   *
   * @example
   * ```typescript
   * // In GetPoiDetailsQueryHandler
   * const poi = await poiRepository.findById(poiId); // Hat MGRS-Koordinaten
   * const geoCoordinate = poi.getCoordinates().toLatLng(); // MGRS → Lat/Lng
   *
   * const reverseGeocodeResult = await this.geocodingPort.reverseGeocode(geoCoordinate);
   *
   * if (reverseGeocodeResult.isSuccess) {
   *   const address = reverseGeocodeResult.value!;
   *   console.log(`POI liegt bei: ${address.toString()}`); // "Musterstr. 42, 80331 München"
   * } else {
   *   // Fallback: Zeige nur Koordinaten an
   *   console.log(`POI liegt bei: ${geoCoordinate.toString()}`); // "48.1234°N, 11.5678°E"
   * }
   * ```
   */
  reverseGeocode(coordinate: GeoCoordinate): Promise<Result<Address>>;
}
