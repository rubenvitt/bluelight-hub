import { LazyStore } from '@tauri-apps/plugin-store';
import { captureSessionLocalSchemaV1, type CaptureSessionLocal } from '../schemas/capture-session.schema';
import type { ICaptureStorage } from './standalone-storage';

/**
 * Tauri-Implementierung des Capture-Session-Storage (ADR-017, Story 2.1).
 *
 * Persistiert `CaptureSessionLocal`-Aggregate als plain JSON über das
 * `tauri-plugin-store`. **Keine AES-GCM-Verschlüsselung** im MVP — der
 * OS-Userspace-Schutz (Dateirechte des App-Data-Verzeichnisses) reicht
 * gemäß ADR-017 für die Standalone-Capture-Domäne aus.
 *
 * Speicherort der Datei `standalone-capture.json`:
 * - macOS:   `~/Library/Application Support/<app-identifier>/`
 * - Windows: `%APPDATA%/<app-identifier>/`
 * - Linux:   `~/.config/<app-identifier>/`
 *
 * Jede Session wird unter dem Key `session:<sessionId>` abgelegt, damit der
 * gleiche Store später auch nicht-session-gebundene Metadaten aufnehmen kann,
 * ohne dass `loadAllSessions()` Fremd-Keys einsammelt.
 */

const STORE_FILENAME = 'standalone-capture.json';
const SESSION_KEY_PREFIX = 'session:';

/**
 * Modul-Singleton für den LazyStore (lazy initialisiert beim ersten Zugriff).
 *
 * Mehrere Adapter-Instanzen teilen denselben Store — analog zum bestehenden
 * `TauriStorageAdapter` in `shared/services/storage`. Schreibende Operationen
 * rufen nach `set`/`delete` explizit `save()` auf: `autoSave` flusht nur
 * debounced auf Platte, sodass ein `set`-Promise zwar resolved, der Disk-Write
 * aber noch aussteht — ein Crash im Debounce-Fenster verlöre die Session. Das
 * explizite `save()` macht den Persist-Erfolg für die Crash-Recovery-Garantie
 * (AC2/FR4) verbindlich.
 */
let storeInstance: LazyStore | null = null;

function getStore(): LazyStore {
  if (!storeInstance) {
    storeInstance = new LazyStore(STORE_FILENAME, { autoSave: true, defaults: {} });
  }
  return storeInstance;
}

/**
 * Setzt das Modul-Singleton zurück (nur für Tests).
 *
 * @internal
 */
export function __resetTauriCaptureStorageForTests(): void {
  storeInstance = null;
}

/**
 * Erzeugt einen Tauri-basierten Capture-Storage-Adapter.
 *
 * Validiert beim Schreiben strikt gegen `captureSessionLocalSchemaV1`
 * (Zod-`parse` → wirft bei Schema-Bruch). Beim Lesen wird `safeParse`
 * genutzt, damit korrupte/migrierte Payloads den Aufrufer nicht killen —
 * sie werden mit Warn-Log verworfen und als `null` bzw. ausgelassen.
 */
export function createTauriCaptureStorage(): ICaptureStorage {
  return {
    async saveSession(session: CaptureSessionLocal): Promise<void> {
      const validated = captureSessionLocalSchemaV1.parse(session);
      const store = getStore();
      await store.set(`${SESSION_KEY_PREFIX}${validated.sessionId}`, validated);
      // Erzwingt den Disk-Flush (autoSave ist nur debounced) — Durability-Garantie.
      await store.save();
    },

    async loadSession(sessionId: string): Promise<CaptureSessionLocal | null> {
      const raw = await getStore().get<unknown>(`${SESSION_KEY_PREFIX}${sessionId}`);
      if (raw == null) return null;
      const result = captureSessionLocalSchemaV1.safeParse(raw);
      if (!result.success) {
        console.warn('[capture:tauri-storage] Session-Payload verworfen — Schema-Mismatch', {
          sessionId,
          errors: result.error.issues,
        });
        return null;
      }
      return result.data;
    },

    async loadAllSessions(): Promise<CaptureSessionLocal[]> {
      const store = getStore();
      const keys = await store.keys();
      const sessionKeys = keys.filter((key) => key.startsWith(SESSION_KEY_PREFIX));
      const sessions: CaptureSessionLocal[] = [];
      for (const key of sessionKeys) {
        const raw = await store.get<unknown>(key);
        if (raw == null) continue;
        const result = captureSessionLocalSchemaV1.safeParse(raw);
        if (result.success) {
          sessions.push(result.data);
        } else {
          console.warn('[capture:tauri-storage] Session-Payload verworfen — Schema-Mismatch', {
            key,
            errors: result.error.issues,
          });
        }
      }
      return sessions;
    },

    async deleteSession(sessionId: string): Promise<void> {
      const store = getStore();
      await store.delete(`${SESSION_KEY_PREFIX}${sessionId}`);
      await store.save();
    },

    async listSessionIds(): Promise<string[]> {
      const keys = await getStore().keys();
      return keys.filter((key) => key.startsWith(SESSION_KEY_PREFIX)).map((key) => key.slice(SESSION_KEY_PREFIX.length));
    },
  };
}
