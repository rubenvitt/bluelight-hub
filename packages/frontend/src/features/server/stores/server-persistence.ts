import { getStorageAdapter } from '@/shared/services/storage/storage-adapter.factory';
import type { ServerConfig } from '../types/server-config';
import { z } from 'zod';

/**
 * Storage-Key für die Server-Liste im persistenten Storage.
 */
export const STORAGE_KEY_SERVERS = 'bluelight:servers';

/**
 * Zod-Schema zur Validierung von ServerConfig-Objekten.
 *
 * Stellt sicher, dass aus dem Storage geladene Daten der
 * erwarteten Struktur entsprechen und keine korrupten Daten
 * die Anwendung zum Absturz bringen.
 */
const ServerConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  url: z.string().url(),
  accessToken: z.string().optional(),
  isDefault: z.boolean(),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable(),
});

/**
 * Speichert die Server-Liste im persistenten Storage.
 *
 * Nutzt den Storage-Adapter um plattformunabhängig zu speichern
 * (Tauri File System oder Browser localStorage).
 *
 * @param servers - Array von Server-Konfigurationen
 * @throws Wirft keine Exceptions, loggt Fehler nur in Console
 *
 * @example
 * ```typescript
 * const servers: ServerConfig[] = [
 *   { id: '1', name: 'Prod', url: 'https://api.example.com', ... }
 * ];
 * await saveServers(servers);
 * ```
 */
export async function saveServers(servers: ServerConfig[]): Promise<void> {
  try {
    const adapter = getStorageAdapter();
    await adapter.setItem(STORAGE_KEY_SERVERS, JSON.stringify(servers));
  } catch (error) {
    console.warn('Failed to save servers to storage:', error);
  }
}

/**
 * Lädt die Server-Liste aus dem persistenten Storage.
 *
 * Nutzt den Storage-Adapter um plattformunabhängig zu laden
 * (Tauri File System oder Browser localStorage).
 * Validiert jedes Server-Objekt mit Zod-Schema um Datenkonsistenz
 * zu garantieren. Ungültige Einträge werden übersprungen.
 *
 * @returns Array von Server-Konfigurationen, leeres Array bei Fehler oder wenn keine Server gespeichert sind
 * @throws Wirft keine Exceptions, gibt bei Fehler leeres Array zurück
 *
 * @example
 * ```typescript
 * const servers = await loadServers();
 * console.log(`${servers.length} servers loaded`);
 * ```
 */
export async function loadServers(): Promise<ServerConfig[]> {
  try {
    const adapter = getStorageAdapter();
    const data = await adapter.getItem(STORAGE_KEY_SERVERS);

    if (!data) {
      return [];
    }

    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      return [];
    }

    // Validiere jedes Server-Objekt und filtere ungültige Einträge
    const validServers = parsed.filter((item) => {
      try {
        ServerConfigSchema.parse(item);
        return true;
      } catch (_error) {
        console.warn('Invalid server config in storage, skipping:', item);
        return false;
      }
    });

    return validServers;
  } catch (error) {
    console.warn('Failed to load servers from storage:', error);
    return [];
  }
}
