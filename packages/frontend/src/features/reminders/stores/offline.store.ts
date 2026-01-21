/**
 * Offline Store fuer Erinnerungs-Offline Management
 *
 * Verwaltet offline erstellte Erinnerungen und die Sync-Queue mit TanStack Store.
 * Integriert mit Tauri Store fuer Persistence.
 *
 * **Story 1.8 AC1, AC2, AC3:**
 * - pendingErinnerungen: Offline erstellte Erinnerungen
 * - syncQueue: Ausstehende Sync-Aktionen
 * - lastSync: Letzte erfolgreiche Synchronisation
 * - Offline-State Tracking
 */

import { LazyStore } from '@tauri-apps/plugin-store';
import { Store, useStore } from '@tanstack/react-store';

/**
 * Tauri Store Keys fuer Offline Persistence
 */
export const OFFLINE_STORE_KEYS = {
  /** Offline erstellte Erinnerungen */
  PENDING_ERINNERUNGEN: 'reminders.offline.pending',
  /** Ausstehende Sync-Aktionen */
  SYNC_QUEUE: 'reminders.offline.syncQueue',
  /** Letzte erfolgreiche Synchronisation */
  LAST_SYNC: 'reminders.offline.lastSync',
  /** Offline State */
  OFFLINE_STATE: 'reminders.offline.state',
} as const;

/**
 * Offline erstellte Erinnerung (vor Server-Sync)
 *
 * Hat `temp_` Prefix in der ID um von Server-IDs zu unterscheiden.
 */
export interface PendingErinnerung {
  /** Temporaere ID mit `temp_` Prefix */
  id: string;
  /** Einsatz-ID */
  einsatzId: string;
  /** Titel der Erinnerung */
  titel: string;
  /** Optionale Beschreibung */
  beschreibung: string | null;
  /** Faelligkeitszeitpunkt als ISO-String */
  faelligAm: string;
  /** Erstellungszeitpunkt als ISO-String */
  createdAt: string;
}

/**
 * Sync Queue Action Types
 */
export type SyncActionType = 'create' | 'update' | 'trigger' | 'acknowledge' | 'snooze';

/**
 * Sync Queue Action
 *
 * Repraesentiert eine ausstehende Aktion die bei Reconnect synchronisiert wird.
 */
export interface SyncQueueAction {
  /** Eindeutige Action-ID (UUID) fuer Deduplication */
  id: string;
  /** Art der Aktion */
  action: SyncActionType;
  /** Erinnerungs-ID (kann `temp_` Prefix haben) */
  erinnerungId: string;
  /** Action-spezifische Daten */
  payload: Record<string, unknown>;
  /** Zeitpunkt der Aktion (ISO-String) fuer Last-Write-Wins */
  timestamp: string;
  /** Anzahl der Retry-Versuche */
  retryCount: number;
}

/**
 * Offline Store State Interface
 */
export interface OfflineStoreState {
  /** Offline erstellte Erinnerungen (noch nicht synchronisiert) */
  pendingErinnerungen: PendingErinnerung[];
  /** Queue der ausstehenden Sync-Aktionen */
  syncQueue: SyncQueueAction[];
  /** Zeitpunkt der letzten erfolgreichen Synchronisation (ISO-String) */
  lastSync: string | null;
  /** Ob aktuell offline */
  isOffline: boolean;
  /** Zeitpunkt seit dem offline (ISO-String) */
  offlineSince: string | null;
}

/**
 * Initial State
 */
const initialState: OfflineStoreState = {
  pendingErinnerungen: [],
  syncQueue: [],
  lastSync: null,
  isOffline: false,
  offlineSince: null,
};

/**
 * Offline Store Instance
 */
export const offlineStore = new Store<OfflineStoreState>(initialState);

// ============================================
// Tauri Store Persistence
// ============================================

/**
 * Tauri Store Filename fuer Offline Persistence
 *
 * Separater Store um Isolation von anderen App-Daten zu gewaehrleisten.
 */
const TAURI_STORE_FILENAME = 'reminders-offline.json';

/**
 * Singleton LazyStore Instance fuer Tauri Persistence
 */
let tauriStoreInstance: LazyStore | null = null;

/**
 * Gibt die Singleton-Instanz des Tauri LazyStore zurueck
 */
function getTauriStore(): LazyStore {
  if (!tauriStoreInstance) {
    tauriStoreInstance = new LazyStore(TAURI_STORE_FILENAME, { autoSave: true });
  }
  return tauriStoreInstance;
}

/**
 * Persistiert den aktuellen State in den Tauri Store
 *
 * Wird nach jeder State-aenderung aufgerufen um Datenverlust zu verhindern.
 */
async function persistToTauriStore(): Promise<void> {
  try {
    const state = offlineStore.state;
    const store = getTauriStore();

    await Promise.all([
      store.set(OFFLINE_STORE_KEYS.PENDING_ERINNERUNGEN, state.pendingErinnerungen),
      store.set(OFFLINE_STORE_KEYS.SYNC_QUEUE, state.syncQueue),
      store.set(OFFLINE_STORE_KEYS.LAST_SYNC, state.lastSync),
      store.set(OFFLINE_STORE_KEYS.OFFLINE_STATE, {
        isOffline: state.isOffline,
        offlineSince: state.offlineSince,
      }),
    ]);
  } catch (error) {
    console.error('[OfflineStore] Failed to persist to Tauri Store:', error);
  }
}

/**
 * Initialisiert den Offline Store aus dem Tauri Store
 *
 * Laedt persistierte Daten bei App-Start um Datenverlust zu verhindern.
 * MUSS beim App-Start aufgerufen werden!
 *
 * @returns Promise wenn Initialisierung abgeschlossen
 */
export async function initOfflineStore(): Promise<void> {
  try {
    const store = getTauriStore();

    const [pendingErinnerungen, syncQueue, lastSync, offlineState] = await Promise.all([
      store.get<PendingErinnerung[]>(OFFLINE_STORE_KEYS.PENDING_ERINNERUNGEN),
      store.get<SyncQueueAction[]>(OFFLINE_STORE_KEYS.SYNC_QUEUE),
      store.get<string | null>(OFFLINE_STORE_KEYS.LAST_SYNC),
      store.get<{ isOffline: boolean; offlineSince: string | null }>(OFFLINE_STORE_KEYS.OFFLINE_STATE),
    ]);

    offlineStore.setState(() => ({
      pendingErinnerungen: pendingErinnerungen ?? [],
      syncQueue: syncQueue ?? [],
      lastSync: lastSync ?? null,
      isOffline: offlineState?.isOffline ?? false,
      offlineSince: offlineState?.offlineSince ?? null,
    }));

    console.info('[OfflineStore] Initialized from Tauri Store:', {
      pendingCount: offlineStore.state.pendingErinnerungen.length,
      queueCount: offlineStore.state.syncQueue.length,
      lastSync: offlineStore.state.lastSync,
    });
  } catch (error) {
    console.error('[OfflineStore] Failed to initialize from Tauri Store:', error);
    // Bei Fehler bleiben wir beim initialState - kein App-Crash
  }
}

// ============================================
// Store Actions (Helper Functions)
// ============================================

/**
 * Fuegt eine offline erstellte Erinnerung hinzu (AC1)
 *
 * Wird aufgerufen wenn eine Erinnerung ohne Netzwerkverbindung erstellt wird.
 * Die ID sollte `temp_` Prefix haben.
 * Persistiert automatisch in den Tauri Store.
 *
 * @param erinnerung - Die offline erstellte Erinnerung
 * @returns Promise wenn Operation abgeschlossen
 */
export const addPendingErinnerung = async (erinnerung: PendingErinnerung): Promise<void> => {
  const currentState = offlineStore.state;

  // Deduplication: Nicht hinzufuegen wenn ID bereits existiert
  if (currentState.pendingErinnerungen.some((e) => e.id === erinnerung.id)) {
    return;
  }

  offlineStore.setState((state) => ({
    ...state,
    pendingErinnerungen: [...state.pendingErinnerungen, erinnerung],
  }));

  await persistToTauriStore();
};

/**
 * Entfernt eine offline erstellte Erinnerung
 *
 * Wird aufgerufen wenn die Erinnerung erfolgreich synchronisiert wurde
 * und die Server-ID erhalten hat.
 * Persistiert automatisch in den Tauri Store.
 *
 * @param id - Die temporaere ID der Erinnerung
 * @returns Promise wenn Operation abgeschlossen
 */
export const removePendingErinnerung = async (id: string): Promise<void> => {
  offlineStore.setState((state) => ({
    ...state,
    pendingErinnerungen: state.pendingErinnerungen.filter((e) => e.id !== id),
  }));

  await persistToTauriStore();
};

/**
 * Gibt eine offline erstellte Erinnerung nach ID zurueck
 *
 * @param id - Die temporaere ID der Erinnerung
 * @returns Die Erinnerung oder undefined
 */
export const getPendingErinnerungById = (id: string): PendingErinnerung | undefined => {
  return offlineStore.state.pendingErinnerungen.find((e) => e.id === id);
};

/**
 * Fuegt eine Aktion zur Sync-Queue hinzu (AC2)
 *
 * Wird aufgerufen wenn eine Aktion offline ausgefuehrt wird
 * und bei Reconnect synchronisiert werden muss.
 * Persistiert automatisch in den Tauri Store.
 *
 * @param action - Die zu queueende Aktion
 * @returns Promise wenn Operation abgeschlossen
 */
export const queueSyncAction = async (action: SyncQueueAction): Promise<void> => {
  const currentState = offlineStore.state;

  // Deduplication: Nicht hinzufuegen wenn Action-ID bereits existiert
  if (currentState.syncQueue.some((a) => a.id === action.id)) {
    return;
  }

  offlineStore.setState((state) => ({
    ...state,
    syncQueue: [...state.syncQueue, action],
  }));

  await persistToTauriStore();
};

/**
 * Entfernt verarbeitete Aktionen aus der Queue
 *
 * Wird nach erfolgreicher Synchronisation aufgerufen.
 * Persistiert automatisch in den Tauri Store.
 *
 * @param ids - Die IDs der verarbeiteten Aktionen
 * @returns Promise wenn Operation abgeschlossen
 */
export const clearProcessedActions = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) {
    return;
  }

  const idSet = new Set(ids);
  offlineStore.setState((state) => ({
    ...state,
    syncQueue: state.syncQueue.filter((a) => !idSet.has(a.id)),
  }));

  await persistToTauriStore();
};

/**
 * Aktualisiert den retryCount einer Aktion
 *
 * Persistiert automatisch in den Tauri Store.
 *
 * @param actionId - Die ID der Aktion
 * @param newRetryCount - Der neue Retry-Count
 * @returns Promise wenn Operation abgeschlossen
 */
export const updateActionRetryCount = async (actionId: string, newRetryCount: number): Promise<void> => {
  offlineStore.setState((state) => ({
    ...state,
    syncQueue: state.syncQueue.map((a) => (a.id === actionId ? { ...a, retryCount: newRetryCount } : a)),
  }));

  await persistToTauriStore();
};

/**
 * Setzt den Zeitpunkt der letzten erfolgreichen Synchronisation
 *
 * Persistiert automatisch in den Tauri Store.
 *
 * @param timestamp - ISO-String Timestamp oder null
 * @returns Promise wenn Operation abgeschlossen
 */
export const setLastSync = async (timestamp: string | null): Promise<void> => {
  offlineStore.setState((state) => ({
    ...state,
    lastSync: timestamp,
  }));

  await persistToTauriStore();
};

/**
 * Setzt den Offline-State
 *
 * Persistiert automatisch in den Tauri Store.
 *
 * @param isOffline - Ob aktuell offline
 * @param offlineSince - Zeitpunkt seit dem offline (ISO-String) oder null
 * @returns Promise wenn Operation abgeschlossen
 */
export const setOfflineState = async (isOffline: boolean, offlineSince: string | null): Promise<void> => {
  offlineStore.setState((state) => ({
    ...state,
    isOffline,
    offlineSince,
  }));

  await persistToTauriStore();
};

/**
 * Ersetzt eine temporaere ID mit einer Server-ID in der Queue
 *
 * Wird nach erfolgreicher Erstellung auf dem Server aufgerufen.
 * Persistiert automatisch in den Tauri Store.
 *
 * @param tempId - Die temporaere ID
 * @param serverId - Die Server-ID
 * @returns Promise wenn Operation abgeschlossen
 */
export const replaceIdInQueue = async (tempId: string, serverId: string): Promise<void> => {
  offlineStore.setState((state) => ({
    ...state,
    syncQueue: state.syncQueue.map((a) => (a.erinnerungId === tempId ? { ...a, erinnerungId: serverId } : a)),
  }));

  await persistToTauriStore();
};

/**
 * Setzt den Offline Store komplett zurueck
 *
 * Persistiert automatisch in den Tauri Store (loescht alle Daten).
 *
 * @returns Promise wenn Operation abgeschlossen
 */
export const resetOfflineStore = async (): Promise<void> => {
  offlineStore.setState(initialState);

  await persistToTauriStore();
};

// ============================================
// React Hooks
// ============================================

/**
 * Hook fuer die Liste der offline erstellten Erinnerungen
 *
 * @returns Liste der PendingErinnerungen
 */
export const usePendingErinnerungen = (): PendingErinnerung[] => {
  return useStore(offlineStore, (state) => state.pendingErinnerungen);
};

/**
 * Hook fuer die Anzahl der ausstehenden Sync-Aktionen
 *
 * @returns Anzahl der Aktionen in der Queue
 */
export const useSyncQueueCount = (): number => {
  return useStore(offlineStore, (state) => state.syncQueue.length);
};

/**
 * Hook fuer den Zeitpunkt der letzten Synchronisation
 *
 * @returns ISO-String Timestamp oder null
 */
export const useLastSync = (): string | null => {
  return useStore(offlineStore, (state) => state.lastSync);
};

/**
 * Hook fuer den Offline-State
 *
 * @returns Objekt mit isOffline und offlineSince
 */
export const useOfflineState = (): { isOffline: boolean; offlineSince: string | null } => {
  return useStore(offlineStore, (state) => ({
    isOffline: state.isOffline,
    offlineSince: state.offlineSince,
  }));
};

/**
 * Hook fuer den kompletten Offline Store State
 *
 * @returns Kompletter Offline Store State
 */
export const useOfflineStoreState = (): OfflineStoreState => {
  return useStore(offlineStore, (state) => state);
};
