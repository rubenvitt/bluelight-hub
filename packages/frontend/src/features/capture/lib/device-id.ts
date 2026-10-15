import { getStorageAdapter } from '@/shared/services/storage/storage-adapter.factory';
import { createDeviceId } from './cuid';

/**
 * Storage-Key für die persistierte Geräte-ID.
 *
 * Das `:v1`-Suffix erlaubt eine spätere Migration auf ein anderes Format, ohne
 * bestehende Geräte-IDs zu kollidieren.
 */
export const DEVICE_ID_STORAGE_KEY = 'bluelight:patient:device-id:v1';

let deviceIdPromise: Promise<string> | null = null;

/**
 * Liefert die stabile Geräte-ID dieses Clients und erzeugt sie beim ersten
 * Aufruf.
 *
 * Story 2.1 trifft bewusst keine Heilungs-Entscheidungen: Liegt bereits ein
 * Wert unter `DEVICE_ID_STORAGE_KEY`, wird er unverändert zurückgegeben — auch
 * wenn er nicht dem Standard-Format entspricht. Format-Validierung erfolgt in
 * späteren Stories.
 *
 * Ein In-Flight-Guard verhindert eine TOCTOU-Race: ohne ihn würden zwei
 * parallele Erst-Aufrufer beide `null` lesen, je eine eigene ID generieren und
 * schreiben (Last-Writer-Wins) — der erste Caller liefe mit einer verwaisten,
 * nicht persistierten ID weiter und bräche den Stabilitäts-Kontrakt.
 */
export function getOrCreateDeviceId(): Promise<string> {
  if (deviceIdPromise) {
    return deviceIdPromise;
  }

  deviceIdPromise = (async () => {
    const storage = getStorageAdapter();
    const existing = await storage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing !== null) {
      return existing;
    }

    const deviceId = createDeviceId();
    await storage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    return deviceId;
  })();

  // Bei Fehler den Cache leeren, damit ein erneuter Aufruf neu versuchen kann.
  deviceIdPromise.catch(() => {
    deviceIdPromise = null;
  });

  return deviceIdPromise;
}

/**
 * Test-Helper: Resettet den In-Flight-Cache der Geräte-ID. Production nutzt das
 * nicht.
 */
export function __resetDeviceIdCacheForTests(): void {
  deviceIdPromise = null;
}
