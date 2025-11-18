import type { Result } from '@domain/common/result';
import { Result as ResultImpl } from '@domain/common/result';
import type { IGeocodingPort } from '@domain/services/ports/i-geocoding.port';
import type { GeoCoordinate } from '@domain/value-objects/geo-coordinate';
import { GeoCoordinate as GeoCoordinateImpl } from '@domain/value-objects/geo-coordinate';
import type { Address } from '@domain/value-objects/address';
import { Address as AddressImpl } from '@domain/value-objects/address';

/**
 * Nominatim API Response für Geocoding (Forward).
 */
interface NominatimGeocodeResult {
  lat: string;
  lon: string;
  display_name: string;
}

/**
 * Nominatim API Response für Reverse-Geocoding.
 */
interface NominatimReverseGeocodeResult {
  address?: {
    road?: string;
    house_number?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
  };
  display_name: string;
}

/**
 * Nominatim Geocoding Adapter (Infrastructure Layer).
 *
 * Implementiert IGeocodingPort via OpenStreetMap Nominatim API.
 * Nominatim ist ein kostenloser Geocoding-Service, der jedoch
 * Rate-Limiting (1 req/s) und User-Agent-Pflicht erfordert.
 *
 * Warum Nominatim statt Google Maps API?
 * - Kostenlos und Open Source (keine API-Keys, keine Kosten)
 * - DRK-konform (keine Drittanbieter-Datenschutzprobleme)
 * - Gut genug für deutsche Einsatzadressen (OSM-Datenqualität hoch)
 * - Kein Vendor-Lock-in (kann jederzeit zu anderem Provider wechseln)
 *
 * Rate-Limiting Implementierung:
 * - Nominatim Usage Policy: Max. 1 Request/Sekunde
 * - Implementiert via lastRequestTime + enforceRateLimit()
 * - Exponential Backoff bei HTTP 429 (Too Many Requests)
 * - Timeout nach 5 Sekunden (verhindert Hänger bei langsamen Antworten)
 *
 * Error Handling Strategy:
 * - Network Errors → Result.fail() (kein Hard Crash)
 * - HTTP 429 → Retry mit Exponential Backoff (max. 3 Versuche)
 * - HTTP 404 → Result.fail("Address not found")
 * - Timeout → Result.fail("Request timeout")
 * - Invalid Response → Result.fail("Invalid API response")
 *
 * @see https://nominatim.org/release-docs/latest/api/Search/
 * @see https://nominatim.org/release-docs/latest/api/Reverse/
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */
export class NominatimGeocodingAdapter implements IGeocodingPort {
  /**
   * Nominatim API Basis-URL.
   */
  private static readonly NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

  /**
   * User-Agent Header (PFLICHT für Nominatim Usage Policy).
   * Format: ApplicationName/Version (Contact)
   */
  private static readonly USER_AGENT = 'Bluelight-Hub/1.0 (contact@bluelight-hub.de)';

  /**
   * Rate-Limit: 1 Request pro Sekunde (1000ms).
   * Nominatim Usage Policy verlangt max. 1 req/s.
   */
  private static readonly RATE_LIMIT_MS = 1000;

  /**
   * Request Timeout: 5 Sekunden.
   * Verhindert Hänger bei langsamen Nominatim-Antworten.
   */
  private static readonly REQUEST_TIMEOUT_MS = 5000;

  /**
   * Maximale Anzahl Retry-Versuche bei HTTP 429.
   */
  private static readonly MAX_RETRIES = 3;

  /**
   * Zeitstempel der letzten API-Anfrage (für Rate-Limiting).
   * Initial: 0 (keine vorherige Anfrage).
   */
  private lastRequestTime = 0;

  /**
   * Geocodiert eine Adresse zu WGS84 Lat/Lng-Koordinaten.
   *
   * Diese Methode nutzt Nominatim Search API, um aus einer textuellen
   * Adresse GPS-Koordinaten zu ermitteln. Die Koordinaten werden dann
   * im Application Layer zu MGRS konvertiert (DRK-Standard).
   *
   * Workflow:
   * 1. Enforce Rate-Limiting (1 req/s)
   * 2. Build Nominatim Query URL (mit countrycodes=de)
   * 3. Fetch mit User-Agent Header
   * 4. Handle HTTP 429 mit Exponential Backoff
   * 5. Parse JSON Response
   * 6. Extract Lat/Lng und validiere via GeoCoordinate.create()
   * 7. Return Result.ok() oder Result.fail()
   *
   * Error Cases:
   * - Keine Ergebnisse → Result.fail("Address not found")
   * - Network Error → Result.fail("Network error: ...")
   * - HTTP 429 (nach Retries) → Result.fail("Rate limit exceeded")
   * - Timeout → Result.fail("Request timeout")
   * - Invalid JSON → Result.fail("Invalid API response")
   *
   * @param address - Die zu geocodierende Adresse
   * @returns Result mit GeoCoordinate oder Fehlermeldung
   */
  async geocodeAddress(address: Address): Promise<Result<GeoCoordinate>> {
    // Enforce Rate-Limiting (1 req/s)
    await this.enforceRateLimit();

    // Build Query String (z.B. "Brandenburger Tor, 10115 Berlin")
    const query = address.toString();
    if (!query) {
      return ResultImpl.fail<GeoCoordinate>('Address is empty');
    }

    // Build Nominatim Search URL
    const url = new URL(`${NominatimGeocodingAdapter.NOMINATIM_BASE_URL}/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('countrycodes', 'de'); // Deutschland only
    url.searchParams.set('limit', '1'); // Nur erstes Ergebnis

    try {
      // Fetch mit Retry-Logik (Exponential Backoff bei HTTP 429)
      const response = await this.fetchWithRetry(url.toString());

      if (!response.ok) {
        return ResultImpl.fail<GeoCoordinate>(`Nominatim API error: HTTP ${response.status}`);
      }

      // Parse JSON Response
      const results = (await response.json()) as NominatimGeocodeResult[];

      // Keine Ergebnisse?
      if (!results || results.length === 0) {
        return ResultImpl.fail<GeoCoordinate>(`Address not found: ${query}`);
      }

      // Extract Lat/Lng vom ersten Ergebnis
      const firstResult = results[0];
      if (!firstResult) {
        return ResultImpl.fail<GeoCoordinate>('Invalid API response: No result found');
      }

      const lat = Number.parseFloat(firstResult.lat);
      const lng = Number.parseFloat(firstResult.lon);

      // Validate Lat/Lng via GeoCoordinate Factory
      const coordResult = GeoCoordinateImpl.create(lat, lng);
      if (coordResult.isFailure) {
        return ResultImpl.fail<GeoCoordinate>(`Invalid coordinates: ${coordResult.error}`);
      }

      // Success: Return GeoCoordinate
      return ResultImpl.ok(coordResult.value as GeoCoordinate);
    } catch (error) {
      // Network Error oder JSON Parse Error
      const errorMessage = error instanceof Error ? error.message : String(error);
      return ResultImpl.fail<GeoCoordinate>(`Geocoding error: ${errorMessage}`);
    }
  }

  /**
   * Reverse-Geocoding: Konvertiert WGS84 Lat/Lng zu lesbarer Adresse.
   *
   * Diese Methode nutzt Nominatim Reverse API, um aus GPS-Koordinaten
   * eine lesbare Adresse zu erzeugen. Dies ist nützlich für POI-Details
   * und Lagekarten-Anzeige (User sehen lesbare Adressen statt nur Koordinaten).
   *
   * Workflow:
   * 1. Enforce Rate-Limiting (1 req/s)
   * 2. Build Nominatim Reverse URL
   * 3. Fetch mit User-Agent Header
   * 4. Handle HTTP 429 mit Exponential Backoff
   * 5. Parse JSON Response
   * 6. Extract Address Components (strasse, hausnummer, plz, ort)
   * 7. Return Result.ok() mit Address oder Result.fail()
   *
   * Besonderheiten:
   * - Nicht alle Koordinaten haben eine Adresse (z.B. Wald, Feld, Meer)
   * - Address.create() kann mit Teiladressen umgehen (nur Ort, ohne Strasse)
   * - Wenn kein Ort verfügbar: Result.fail() (Adresse ohne Ort nicht sinnvoll)
   *
   * @param coordinate - Die zu reverse-geocodierende Koordinate
   * @returns Result mit Address oder Fehlermeldung
   */
  async reverseGeocode(coordinate: GeoCoordinate): Promise<Result<Address>> {
    // Enforce Rate-Limiting (1 req/s)
    await this.enforceRateLimit();

    // Build Nominatim Reverse URL
    const url = new URL(`${NominatimGeocodingAdapter.NOMINATIM_BASE_URL}/reverse`);
    url.searchParams.set('lat', coordinate.latitude.toString());
    url.searchParams.set('lon', coordinate.longitude.toString());
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1'); // Include address breakdown

    try {
      // Fetch mit Retry-Logik (Exponential Backoff bei HTTP 429)
      const response = await this.fetchWithRetry(url.toString());

      if (!response.ok) {
        return ResultImpl.fail<Address>(`Nominatim API error: HTTP ${response.status}`);
      }

      // Parse JSON Response
      const result = (await response.json()) as NominatimReverseGeocodeResult;

      // Kein Address-Objekt?
      if (!result || !result.address) {
        return ResultImpl.fail<Address>('No address found for coordinates');
      }

      // Extract Address Components (alle optional)
      const { road, house_number, postcode, city, town, village } = result.address;

      // Ort kann city, town, oder village sein (je nach OSM-Tagging)
      const ort = city || town || village;

      // Wenn kein Ort verfügbar: Adresse ist nicht sinnvoll
      if (!ort) {
        return ResultImpl.fail<Address>('No location found for coordinates');
      }

      // Create Address Value Object (Teiladressen sind erlaubt)
      const addressResult = AddressImpl.create({
        strasse: road,
        hausnummer: house_number,
        plz: postcode,
        ort,
      });

      if (addressResult.isFailure) {
        return ResultImpl.fail<Address>(`Invalid address: ${addressResult.error}`);
      }

      // Success: Return Address
      return ResultImpl.ok(addressResult.value as Address);
    } catch (error) {
      // Network Error oder JSON Parse Error
      const errorMessage = error instanceof Error ? error.message : String(error);
      return ResultImpl.fail<Address>(`Reverse geocoding error: ${errorMessage}`);
    }
  }

  /**
   * Enforce Rate-Limiting: 1 Request/Sekunde.
   *
   * Diese Methode prüft die Zeit seit der letzten API-Anfrage und wartet
   * falls nötig, um das 1 req/s Limit einzuhalten (Nominatim Usage Policy).
   *
   * Implementierung:
   * - Speichert lastRequestTime nach jeder Anfrage
   * - Berechnet Delay = RATE_LIMIT_MS - (now - lastRequestTime)
   * - Wartet Delay ms via Promise.resolve() + setTimeout()
   *
   * Warum Promise statt blockierendes Sleep?
   * - Non-blocking: Event Loop bleibt aktiv
   * - Testbar: jest.useFakeTimers() kann Promise-basierte Delays mocken
   * - Node.js Best Practice: async/await statt synchronem Sleep
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < NominatimGeocodingAdapter.RATE_LIMIT_MS) {
      // Wartezeit berechnen
      const delay = NominatimGeocodingAdapter.RATE_LIMIT_MS - timeSinceLastRequest;

      // Warten via Promise
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Update lastRequestTime NACH dem Warten
    this.lastRequestTime = Date.now();
  }

  /**
   * Fetch mit Exponential Backoff bei HTTP 429 (Too Many Requests).
   *
   * Diese Methode führt einen HTTP Request aus und wiederholt ihn automatisch
   * bei HTTP 429 Responses (Rate Limit Exceeded). Die Wartezeit zwischen Retries
   * verdoppelt sich jedes Mal (Exponential Backoff: 1s, 2s, 4s).
   *
   * Implementierung:
   * - Versuch 0: 1s Delay
   * - Versuch 1: 2s Delay
   * - Versuch 2: 4s Delay
   * - Nach 3 Versuchen: Throw Error
   *
   * Warum Exponential Backoff?
   * - Verhindert "Thundering Herd" Problem (viele Clients retries gleichzeitig)
   * - Gibt Server Zeit zur Erholung
   * - Standard-Pattern für Rate-Limited APIs
   *
   * @param url - Die zu fetchende URL
   * @param attempt - Aktueller Retry-Versuch (0-basiert)
   * @returns Response-Objekt
   * @throws Error wenn max. Retries erreicht oder Network Error
   */
  private async fetchWithRetry(url: string, attempt = 0): Promise<Response> {
    // Fetch mit Timeout (AbortController)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NominatimGeocodingAdapter.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': NominatimGeocodingAdapter.USER_AGENT,
        },
        signal: controller.signal,
      });

      // Timeout Timer aufräumen
      clearTimeout(timeoutId);

      // HTTP 429 (Too Many Requests)?
      if (response.status === 429 && attempt < NominatimGeocodingAdapter.MAX_RETRIES) {
        // Exponential Backoff: 1s, 2s, 4s
        const backoffDelay = 1000 * 2 ** attempt;

        // Warten vor Retry
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));

        // Retry mit erhöhtem Attempt-Counter
        return this.fetchWithRetry(url, attempt + 1);
      }

      // Success oder Non-429 Error
      return response;
    } catch (error) {
      // Timeout Timer aufräumen
      clearTimeout(timeoutId);

      // AbortController.abort() wirft "AbortError"
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }

      // Other Errors (Network, DNS, etc.)
      throw error;
    }
  }
}
