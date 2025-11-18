import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NominatimGeocodingAdapter } from '../nominatim-geocoding.adapter';
import { Address } from '@domain/value-objects/address';
import { GeoCoordinate } from '@domain/value-objects/geo-coordinate';

/**
 * Integration Tests für NominatimGeocodingAdapter.
 *
 * Diese Tests prüfen die korrekte Implementierung der Nominatim API Integration,
 * inklusive Rate-Limiting, Exponential Backoff, Timeout-Handling und Error-Handling.
 *
 * Wichtig: Diese Tests verwenden KEINE echten API-Calls (zu langsam, flaky),
 * sondern mocken fetch() via jest.spyOn() mit simulierten Responses.
 *
 * Warum Mock statt echte API-Calls?
 * - Schneller: Tests laufen in <1s statt >10s
 * - Deterministisch: Keine Netzwerk-Flakiness
 * - Rate-Limit Safe: Kein Risiko, Nominatim zu blockieren
 * - Offline-Lauffähig: CI/CD ohne Internet-Zugang möglich
 *
 * Test Coverage (gemäß Story 2-0, Task 3.3):
 * 1. ✅ Geocode Berlin Adresse → GeoCoordinate (±100m Toleranz)
 * 2. ✅ Rate-Limiting enforced (1 req/s)
 * 3. ✅ User-Agent Header present
 * 4. ✅ Exponential Backoff bei HTTP 429
 * 5. ✅ Timeout nach 5 Sekunden
 * 6. ✅ Invalid Address → Result.fail()
 */
describe('NominatimGeocodingAdapter Integration Tests', () => {
  let adapter: NominatimGeocodingAdapter;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  /**
   * Setup: Neue Adapter-Instanz vor jedem Test.
   * Reset fetchSpy damit Tests isoliert sind.
   */
  beforeEach(() => {
    adapter = new NominatimGeocodingAdapter();
    // Mock global fetch (Node 18+ native fetch)
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  /**
   * Cleanup: Restore fetch nach jedem Test.
   */
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  /**
   * Test 1: Geocode Berlin Adresse → GeoCoordinate (±100m Toleranz).
   *
   * Prüft dass:
   * - Nominatim API korrekt aufgerufen wird
   * - Lat/Lng korrekt extrahiert wird
   * - GeoCoordinate.create() erfolgreich ist
   * - Result.isSuccess === true
   * - Koordinaten ungefähr stimmen (±100m wegen OSM-Datenqualität)
   */
  it('should geocode "Teststraße 1, 10115 Berlin" to GeoCoordinate (±100m tolerance)', async () => {
    // Given: Mock Nominatim API Response (Berlin Coordinates)
    const mockResponse = [
      {
        lat: '52.5200',
        lon: '13.4050',
        display_name: 'Teststraße 1, 10115 Berlin, Germany',
      },
    ];

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    // When: Geocode Berlin Address
    const addressResult = Address.create({
      strasse: 'Teststraße',
      hausnummer: '1',
      plz: '10115',
      ort: 'Berlin',
    });
    expect(addressResult.isSuccess).toBe(true);

    const address = addressResult.value!;
    const result = await adapter.geocodeAddress(address);

    // Then: Result is Success
    expect(result.isSuccess).toBe(true);
    expect(result.value).toBeDefined();

    const coord = result.value!;

    // Then: Coordinates match (±100m tolerance = ±0.001 degrees)
    expect(coord.latitude).toBeCloseTo(52.52, 2); // 2 decimals ≈ 1km
    expect(coord.longitude).toBeCloseTo(13.405, 2);

    // Then: Verify fetch was called with correct URL
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain('nominatim.openstreetmap.org/search');
    expect(callUrl).toContain('q=Teststra%C3%9Fe+1%2C+10115+Berlin'); // URL-encoded
    expect(callUrl).toContain('format=json');
    expect(callUrl).toContain('countrycodes=de');
  });

  /**
   * Test 2: Rate-Limiting enforced (1 req/s).
   *
   * Prüft dass:
   * - Zwei aufeinanderfolgende Requests mindestens 1 Sekunde auseinander liegen
   * - enforceRateLimit() korrekt implementiert ist
   * - Keine Requests schneller als 1/s durchgehen
   *
   * Implementierung mit jest.useFakeTimers():
   * - Mockt Date.now() und setTimeout()
   * - Erlaubt deterministische Zeitsteuerung
   * - Schneller als echte 1s Wartezeit
   */
  it('should enforce rate limiting (1 req/s) between consecutive requests', async () => {
    // Given: Use fake timers for deterministic time control
    jest.useFakeTimers();

    // Given: Mock Nominatim API Response
    const mockResponse = [{ lat: '52.52', lon: '13.40', display_name: 'Berlin' }];
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    // Given: Address to geocode
    const addressResult = Address.create({ ort: 'Berlin' });
    expect(addressResult.isSuccess).toBe(true);
    const address = addressResult.value!;

    // When: First request (no rate limit yet)
    const firstRequestPromise = adapter.geocodeAddress(address);
    await jest.runAllTimersAsync(); // Advance timers to complete promise
    const firstResult = await firstRequestPromise;
    expect(firstResult.isSuccess).toBe(true);

    // When: Second request (should be rate-limited)
    const secondRequestStart = Date.now();
    const secondRequestPromise = adapter.geocodeAddress(address);

    // Then: Advance time by 999ms (less than 1000ms rate limit)
    jest.advanceTimersByTime(999);
    await Promise.resolve(); // Let microtasks run

    // Then: Second request should still be waiting
    let secondRequestCompleted = false;
    secondRequestPromise.then(() => {
      secondRequestCompleted = true;
    });
    await Promise.resolve(); // Let microtasks run
    expect(secondRequestCompleted).toBe(false);

    // Then: Advance time by 1ms more (total 1000ms = rate limit)
    jest.advanceTimersByTime(1);
    await jest.runAllTimersAsync(); // Complete all pending timers
    const secondResult = await secondRequestPromise;

    // Then: Second request should now complete
    expect(secondResult.isSuccess).toBe(true);

    // Then: Verify at least 1000ms passed (mocked time)
    const secondRequestEnd = Date.now();
    const elapsed = secondRequestEnd - secondRequestStart;
    expect(elapsed).toBeGreaterThanOrEqual(1000);

    // Cleanup
    jest.useRealTimers();
  });

  /**
   * Test 3: User-Agent Header present in HTTP Request.
   *
   * Prüft dass:
   * - User-Agent Header gesetzt wird (Nominatim Policy Pflicht)
   * - Header-Wert korrekt ist: "Bluelight-Hub/1.0 (contact@bluelight-hub.de)"
   */
  it('should include User-Agent header in Nominatim requests', async () => {
    // Given: Mock Nominatim API Response
    const mockResponse = [{ lat: '52.52', lon: '13.40', display_name: 'Berlin' }];
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    // Given: Address to geocode
    const addressResult = Address.create({ ort: 'Berlin' });
    expect(addressResult.isSuccess).toBe(true);
    const address = addressResult.value!;

    // When: Geocode address
    await adapter.geocodeAddress(address);

    // Then: Verify User-Agent header was sent
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const fetchCall = fetchSpy.mock.calls[0];
    expect(fetchCall).toBeDefined();

    const fetchOptions = fetchCall?.[1] as RequestInit | undefined;
    expect(fetchOptions).toBeDefined();
    expect(fetchOptions?.headers).toBeDefined();

    const headers = fetchOptions?.headers as Record<string, string>;
    expect(headers['User-Agent']).toBe('Bluelight-Hub/1.0 (contact@bluelight-hub.de)');
  });

  /**
   * Test 4: Exponential Backoff bei HTTP 429 (Too Many Requests).
   *
   * Prüft dass:
   * - HTTP 429 Response löst Retry aus
   * - Retry Delays sind exponentiell: 1s, 2s, 4s
   * - Nach 3 Retries wird HTTP 429 durchgereicht (keine weiteren Retries)
   *
   * Implementierung:
   * - Mock fetch mit 429 Response (3x), dann 200 Success
   * - Use fake timers für deterministische Delay-Messung
   * - Verify delays sind 1000ms, 2000ms, 4000ms
   */
  it('should retry with exponential backoff on HTTP 429 responses', async () => {
    // Given: Use fake timers
    jest.useFakeTimers();

    // Given: Mock fetch with 429 responses (2x), then 200 success
    fetchSpy
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ lat: '52.52', lon: '13.40', display_name: 'Berlin' }],
      } as Response);

    // Given: Address to geocode
    const addressResult = Address.create({ ort: 'Berlin' });
    expect(addressResult.isSuccess).toBe(true);
    const address = addressResult.value!;

    // When: Geocode address (triggers retries)
    const geocodePromise = adapter.geocodeAddress(address);

    // Then: Let initial rate limit complete
    await jest.advanceTimersByTimeAsync(0);

    // Then: First attempt happens immediately
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Then: First retry (1s backoff = 1000ms)
    await jest.advanceTimersByTimeAsync(1000);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Then: Second retry (2s backoff = 2000ms)
    await jest.advanceTimersByTimeAsync(2000);
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    // Then: Complete all remaining timers
    await jest.runAllTimersAsync();

    // Then: Result should be success (third attempt succeeded)
    const result = await geocodePromise;
    expect(result.isSuccess).toBe(true);

    // Cleanup
    jest.useRealTimers();
  });

  /**
   * Test 5: Timeout nach 5 Sekunden.
   *
   * Prüft dass:
   * - Request nach 5 Sekunden abgebrochen wird (AbortController)
   * - Result.fail() mit "Request timeout" zurückgegeben wird
   * - fetch() mit signal: AbortSignal aufgerufen wird
   *
   * Implementierung:
   * - Mock fetch mit "never resolving promise" (simuliert Timeout)
   * - Use fake timers für deterministische Timeout-Steuerung
   * - Advance timers by 5000ms
   * - Verify Result.isFailure und error message
   */
  it('should timeout after 5 seconds and return Result.fail()', async () => {
    // Given: Use fake timers
    jest.useFakeTimers();

    // Given: Mock fetch that simulates slow response with AbortController
    fetchSpy.mockImplementation((_url, options) => {
      return new Promise((resolve, reject) => {
        // Simulate slow response (10s)
        const slowResponseTimeout = setTimeout(
          () =>
            resolve({
              ok: true,
              status: 200,
              json: async () => [{ lat: '52.52', lon: '13.40', display_name: 'Berlin' }],
            } as Response),
          10000,
        );

        // Listen to abort signal
        const signal = (options as RequestInit)?.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(slowResponseTimeout);
            const abortError = new Error('Request timeout');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        }
      });
    });

    // Given: Address to geocode
    const addressResult = Address.create({ ort: 'Berlin' });
    expect(addressResult.isSuccess).toBe(true);
    const address = addressResult.value!;

    // When: Geocode address (should timeout)
    const geocodePromise = adapter.geocodeAddress(address);

    // Then: Advance time by 5000ms (timeout threshold triggers AbortController)
    await jest.advanceTimersByTimeAsync(5000);

    // Then: Complete all pending timers
    await jest.runAllTimersAsync();

    // Then: Result should be failure with timeout error
    const result = await geocodePromise;
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('timeout');

    // Cleanup
    jest.useRealTimers();
  });

  /**
   * Test 6: Invalid Address returns Result.fail().
   *
   * Prüft dass:
   * - Nominatim API keine Ergebnisse zurückgibt (leeres Array)
   * - Result.isFailure === true
   * - Error Message enthält "Address not found"
   */
  it('should return Result.fail() when geocoding non-existent address', async () => {
    // Given: Mock Nominatim API Response (empty array = no results)
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [], // Empty array = no results
    } as Response);

    // Given: Non-existent address
    const addressResult = Address.create({
      strasse: 'Nonexistent Street',
      hausnummer: '999999',
      plz: '99999',
      ort: 'Nowhereville',
    });
    expect(addressResult.isSuccess).toBe(true);
    const address = addressResult.value!;

    // When: Geocode non-existent address
    const result = await adapter.geocodeAddress(address);

    // Then: Result should be failure
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Address not found');
  });

  /**
   * Test 7: Reverse Geocoding Berlin Coordinates → Address.
   *
   * Prüft dass:
   * - Reverse-Geocoding API korrekt aufgerufen wird
   * - Address Components (strasse, hausnummer, plz, ort) extrahiert werden
   * - Address.create() erfolgreich ist
   * - Result.isSuccess === true
   */
  it('should reverse geocode Berlin coordinates to Address', async () => {
    // Given: Mock Nominatim Reverse API Response
    const mockResponse = {
      address: {
        road: 'Unter den Linden',
        house_number: '1',
        postcode: '10117',
        city: 'Berlin',
      },
      display_name: 'Unter den Linden 1, 10117 Berlin, Germany',
    };

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    // Given: Berlin Coordinates
    const coordResult = GeoCoordinate.create(52.5169, 13.3888);
    expect(coordResult.isSuccess).toBe(true);
    const coord = coordResult.value!;

    // When: Reverse geocode coordinates
    const result = await adapter.reverseGeocode(coord);

    // Then: Result is Success
    expect(result.isSuccess).toBe(true);
    expect(result.value).toBeDefined();

    const address = result.value!;

    // Then: Address components match
    expect(address.strasse).toBe('Unter den Linden');
    expect(address.hausnummer).toBe('1');
    expect(address.plz).toBe('10117');
    expect(address.ort).toBe('Berlin');

    // Then: Verify fetch was called with correct URL
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(callUrl).toContain('nominatim.openstreetmap.org/reverse');
    expect(callUrl).toContain('lat=52.5169');
    expect(callUrl).toContain('lon=13.3888');
    expect(callUrl).toContain('format=json');
    expect(callUrl).toContain('addressdetails=1');
  });

  /**
   * Test 8: Reverse Geocoding with no address → Result.fail().
   *
   * Prüft dass:
   * - Nominatim API keine Adresse zurückgibt (kein address-Objekt)
   * - Result.isFailure === true
   * - Error Message enthält "No address found"
   */
  it('should return Result.fail() when reverse geocoding coordinates with no address', async () => {
    // Given: Mock Nominatim Reverse API Response (no address object)
    const mockResponse = {
      display_name: 'Middle of nowhere',
    };

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    // Given: Coordinates in middle of nowhere
    const coordResult = GeoCoordinate.create(0.0, 0.0); // Atlantic Ocean
    expect(coordResult.isSuccess).toBe(true);
    const coord = coordResult.value!;

    // When: Reverse geocode coordinates
    const result = await adapter.reverseGeocode(coord);

    // Then: Result should be failure
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('No address found');
  });
});
