import { Store } from '@tanstack/react-store';
import type { ConnectionStatus, ServerConfig, ServerState } from '../types/server-config';
import { loadServers, saveServers } from './server-persistence';

/**
 * Initial State des Server-Stores.
 *
 * Wird beim App-Start verwendet, bevor die Hydratation
 * aus dem Storage erfolgt.
 */
const initialState: ServerState = {
  servers: [],
  activeServerId: null,
  connectionStatus: new Map(),
  isHydrated: false,
};

/**
 * Globaler Store für Server-Verwaltung.
 *
 * Verwaltet alle konfigurierten Backend-Server, deren Verbindungsstatus
 * und den aktuell aktiven Server. State-Änderungen erfolgen über
 * externe Action-Funktionen (server-persistence.ts, server-actions.ts).
 *
 * @example
 * ```typescript
 * // Store abonnieren in React Component
 * const servers = useStore(serverStore, (state) => state.servers);
 *
 * // State direkt lesen
 * const currentState = serverStore.state;
 * ```
 */
export const serverStore = new Store<ServerState>(initialState);

/**
 * Generiert eine eindeutige Server-ID.
 *
 * Verwendet native crypto.randomUUID() wenn verfügbar (moderne Browser),
 * fällt zurück auf Timestamp + Random-String für Kompatibilität.
 *
 * @returns Eine eindeutige ID im UUID-Format oder Fallback-Format
 */
function generateServerId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Validiert eine Server-URL.
 *
 * Erlaubt nur HTTPS-URLs oder localhost für Entwicklung.
 * Verwendet native URL-Konstruktor für sichere Validierung.
 *
 * @param url - Die zu validierende URL
 * @returns true wenn gültig, false andernfalls
 */
function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

/**
 * Fügt einen neuen Server zur Konfiguration hinzu.
 *
 * Auto-generiert ID, createdAt und lastUsedAt Timestamps.
 * Validiert URL-Format (HTTPS oder localhost) und Name (min 1 char).
 * Synchronisiert State automatisch mit dem Storage Adapter.
 *
 * @param config - Server-Konfiguration ohne ID und Timestamps
 * @throws Error wenn Validierung fehlschlägt
 *
 * @example
 * ```typescript
 * await addServer({
 *   name: 'Produktiv-Server',
 *   url: 'https://api.example.com',
 *   isDefault: true
 * });
 * ```
 */
export async function addServer(config: Omit<ServerConfig, 'id' | 'createdAt'>): Promise<void> {
  // Validierung
  if (!config.name || config.name.trim().length < 1) {
    throw new Error('Server name must be at least 1 character long');
  }

  if (!validateUrl(config.url)) {
    throw new Error('Invalid server URL: must be HTTPS or localhost for development');
  }

  // Auto-generierte Felder
  const now = new Date().toISOString();
  const newServer: ServerConfig = {
    ...config,
    id: generateServerId(),
    createdAt: now,
    lastUsedAt: now,
  };

  // Immutable Store Update
  serverStore.setState((state) => ({
    ...state,
    servers: [...state.servers, newServer],
  }));

  // Storage Sync
  await saveServers(serverStore.state.servers);
}

/**
 * Setzt einen Server als aktiven Server.
 *
 * Aktualisiert isDefault Flag (nur aktiver Server hat true).
 * Aktualisiert lastUsedAt Timestamp des aktiven Servers.
 * Synchronisiert State automatisch mit dem Storage Adapter.
 *
 * @param serverId - ID des Servers der aktiv gesetzt werden soll
 * @throws Error wenn Server-ID nicht existiert
 *
 * @example
 * ```typescript
 * await setActiveServer('abc-123-def-456');
 * ```
 */
export async function setActiveServer(serverId: string): Promise<void> {
  const state = serverStore.state;

  // Validierung: Server existiert
  const serverExists = state.servers.some((s) => s.id === serverId);
  if (!serverExists) {
    throw new Error(`Server with id "${serverId}" does not exist`);
  }

  const now = new Date().toISOString();

  // Immutable Update: isDefault und lastUsedAt für alle Server
  const updatedServers = state.servers.map((server) => {
    if (server.id === serverId) {
      return {
        ...server,
        isDefault: true,
        lastUsedAt: now,
      };
    }
    return {
      ...server,
      isDefault: false,
    };
  });

  // Store Update
  serverStore.setState((state) => ({
    ...state,
    servers: updatedServers,
    activeServerId: serverId,
  }));

  // Storage Sync
  await saveServers(serverStore.state.servers);
}

/**
 * Entfernt einen Server aus der Konfiguration.
 *
 * Auto-Fallback: Wenn aktiver Server gelöscht wird, wird der erste
 * verfügbare Server aktiv gesetzt (oder null bei 0 Servern).
 * Synchronisiert State automatisch mit dem Storage Adapter.
 *
 * @param serverId - ID des zu löschenden Servers
 *
 * @example
 * ```typescript
 * await removeServer('abc-123-def-456');
 * ```
 */
export async function removeServer(serverId: string): Promise<void> {
  const state = serverStore.state;

  // Filter Server
  const filteredServers = state.servers.filter((s) => s.id !== serverId);

  // Auto-Fallback: Wenn aktiver Server gelöscht
  let newActiveServerId = state.activeServerId;
  let updatedServers = filteredServers;

  if (state.activeServerId === serverId && filteredServers.length > 0) {
    // Ersten Server aktiv setzen
    newActiveServerId = filteredServers[0].id;

    // Immutable update
    updatedServers = filteredServers.map((server, index) => (index === 0 ? { ...server, isDefault: true, lastUsedAt: new Date().toISOString() } : server));
  } else if (state.activeServerId === serverId) {
    // Keine Server übrig
    newActiveServerId = null;
  }

  // Store Update
  serverStore.setState((state) => ({
    ...state,
    servers: updatedServers,
    activeServerId: newActiveServerId,
  }));

  // Storage Sync
  await saveServers(serverStore.state.servers);
}

/**
 * Hydratiert den Server-Store aus dem persistenten Storage.
 *
 * Lädt alle gespeicherten Server aus dem Storage Adapter und aktualisiert
 * den Store-State. Setzt automatisch den Default-Server als aktiv.
 * Race Condition Protection: Überspringt Hydration wenn bereits erfolgt.
 *
 * @returns Promise<void>
 *
 * @example
 * ```typescript
 * // Bei App-Start aufrufen
 * await hydrateServerStore();
 * ```
 */
export async function hydrateServerStore(): Promise<void> {
  // Race Condition Protection: Check if already hydrated
  if (serverStore.state.isHydrated) {
    console.warn('[ServerStore] Already hydrated, skipping...');
    return;
  }

  // Load servers from storage (errors propagate to caller)
  const servers = await loadServers();

  // Find default server
  const defaultServer = servers.find((s) => s.isDefault);

  // Update store state
  serverStore.setState((state) => ({
    ...state,
    servers,
    activeServerId: defaultServer?.id ?? null,
    isHydrated: true,
  }));
}

/**
 * Aktualisiert den Verbindungsstatus eines Servers.
 *
 * Nutzt Map.set() für O(1) Lookup Performance.
 * Keine Validierung nötig - Map akzeptiert beliebige Keys.
 * Kein Persistierung - nur In-Memory State für UI-Updates.
 *
 * @param serverId - ID des Servers dessen Status aktualisiert wird
 * @param status - Neuer Verbindungsstatus
 *
 * @example
 * ```typescript
 * // Status auf "checking" setzen
 * updateConnectionStatus('abc-123-def-456', 'checking');
 *
 * // Status auf "connected" setzen
 * updateConnectionStatus('abc-123-def-456', 'connected');
 * ```
 */
export function updateConnectionStatus(serverId: string, status: ConnectionStatus): void {
  const currentMap = serverStore.state.connectionStatus;

  // Neue Map für Immutability
  const newMap = new Map(currentMap);
  newMap.set(serverId, status);

  // Store Update
  serverStore.setState((state) => ({
    ...state,
    connectionStatus: newMap,
  }));
}
