/**
 * Seen Assignments Store
 *
 * Trackt welche zugewiesenen Erinnerungen der User bereits gesehen hat.
 * Genutzt fuer "Neu" Badge bei neu zugewiesenen Erinnerungen (Story 3.7).
 *
 * **Story 3.7 AC3:** "Neu" Markierung in der Liste
 * **Story 3.7 AC4:** "Neu" Markierung entfernen bei Interaktion
 *
 * Persistenz: Tauri LazyStore (ueberlebt App-Neustarts)
 * State Management: TanStack Store (reaktive Updates)
 */

import { LazyStore } from '@tauri-apps/plugin-store';
import { Store, useStore } from '@tanstack/react-store';
import { isTauri } from '@tauri-apps/api/core';

/**
 * Tauri Store Keys fuer Seen Assignments Persistence
 */
export const SEEN_ASSIGNMENTS_STORE_KEYS = {
  /** Map von ErinnerungId zu Timestamp (wann gesehen) */
  SEEN_MAP: 'reminders.seen-assignments',
} as const;

/**
 * Seen Assignments Store State Interface
 *
 * Map von ErinnerungId zu Timestamp (wann als gesehen markiert).
 * Nur Erinnerungen die dem aktuellen User zugewiesen wurden.
 */
export interface SeenAssignmentsStoreState {
  /** Map: erinnerungId -> timestamp (wann gesehen) */
  seenMap: Map<string, number>;
  /** Ob Store initialisiert wurde */
  isInitialized: boolean;
}

/**
 * Initial State
 */
const initialState: SeenAssignmentsStoreState = {
  seenMap: new Map(),
  isInitialized: false,
};

/**
 * Seen Assignments Store Instance
 */
export const seenAssignmentsStore = new Store<SeenAssignmentsStoreState>(initialState);

// ============================================
// Tauri Store Persistence
// ============================================

/**
 * Tauri Store Filename fuer Seen Assignments Persistence
 */
const TAURI_STORE_FILENAME = 'reminders-seen.json';

/**
 * Singleton LazyStore Instance
 */
let tauriStoreInstance: LazyStore | null = null;

/**
 * Gibt die Singleton-Instanz des Tauri LazyStore zurueck.
 * Gibt null zurueck wenn nicht in Tauri Umgebung.
 */
function getTauriStore(): LazyStore | null {
  if (!isTauri()) {
    return null;
  }

  if (!tauriStoreInstance) {
    tauriStoreInstance = new LazyStore(TAURI_STORE_FILENAME, { autoSave: true });
  }
  return tauriStoreInstance;
}

/**
 * Konvertiert Map zu serialisierbarem Object fuer Tauri Store
 */
function mapToObject(map: Map<string, number>): Record<string, number> {
  const obj: Record<string, number> = {};
  for (const [key, value] of map) {
    obj[key] = value;
  }
  return obj;
}

/**
 * Konvertiert Object zurueck zu Map
 */
function objectToMap(obj: Record<string, number> | null | undefined): Map<string, number> {
  if (!obj) return new Map();
  return new Map(Object.entries(obj));
}

/**
 * Persistiert den aktuellen State in den Tauri Store.
 *
 * **Best-Effort Persistence:** Fehler werden geloggt aber nicht propagiert.
 * Der Store bleibt bei Persistence-Fehlern funktionsfaehig (nur im Memory).
 * Bei App-Restart gehen nicht-persistierte Aenderungen verloren.
 *
 * In Browser-Umgebung (nicht Tauri) passiert nichts (nur In-Memory).
 *
 * @internal
 */
async function persistToTauriStore(): Promise<void> {
  try {
    const store = getTauriStore();
    if (!store) return; // Browser Mode -> No Persistence

    const state = seenAssignmentsStore.state;
    await store.set(SEEN_ASSIGNMENTS_STORE_KEYS.SEEN_MAP, mapToObject(state.seenMap));
  } catch (error) {
    console.error('[SeenAssignmentsStore] Failed to persist to Tauri Store:', error);
  }
}

/**
 * Initialisiert den Seen Assignments Store aus dem Tauri Store
 *
 * Laedt persistierte Daten bei App-Start.
 * MUSS beim App-Start aufgerufen werden!
 *
 * @returns Promise wenn Initialisierung abgeschlossen
 */
export async function initSeenAssignmentsStore(): Promise<void> {
  try {
    const store = getTauriStore();

    // Fallback fuer Browser / Nicht-Tauri: Einfach initialisiert melden
    if (!store) {
      console.info('[SeenAssignmentsStore] Running in Browser Mode (No Persistence)');
      seenAssignmentsStore.setState((state) => ({
        ...state,
        isInitialized: true,
      }));
      return;
    }

    const seenMapObj = await store.get<Record<string, number>>(SEEN_ASSIGNMENTS_STORE_KEYS.SEEN_MAP);

    seenAssignmentsStore.setState(() => ({
      seenMap: objectToMap(seenMapObj),
      isInitialized: true,
    }));

    console.info('[SeenAssignmentsStore] Initialized from Tauri Store:', {
      seenCount: seenAssignmentsStore.state.seenMap.size,
    });
  } catch (error) {
    console.error('[SeenAssignmentsStore] Failed to initialize from Tauri Store:', error);
    // Bei Fehler setzen wir nur isInitialized = true um App nicht zu blockieren
    seenAssignmentsStore.setState((state) => ({
      ...state,
      isInitialized: true,
    }));
  }
}

// ============================================
// Store Actions
// ============================================

/**
 * Markiert eine Erinnerung als gesehen (AC4)
 *
 * Wird aufgerufen wenn User die Erinnerung oeffnet/expandiert.
 * Persistiert automatisch in den Tauri Store.
 *
 * **Race-Condition-sicher:** Check-and-Update erfolgt atomar innerhalb setState.
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns Promise wenn Operation abgeschlossen
 */
export async function markAsSeen(erinnerungId: string): Promise<void> {
  let wasAlreadySeen = false;

  seenAssignmentsStore.setState((state) => {
    // Atomischer Check-and-Update innerhalb setState
    if (state.seenMap.has(erinnerungId)) {
      wasAlreadySeen = true;
      return state; // Keine Aenderung
    }

    const newMap = new Map(state.seenMap);
    newMap.set(erinnerungId, Date.now());
    return { ...state, seenMap: newMap };
  });

  if (wasAlreadySeen) {
    return; // Nicht persistieren wenn keine Aenderung
  }

  await persistToTauriStore();
}

/**
 * Entfernt eine Erinnerung aus der Seen-Liste
 *
 * Wird genutzt wenn Erinnerung geloescht wird oder fuer Testing.
 * Persistiert automatisch in den Tauri Store.
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns Promise wenn Operation abgeschlossen
 */
export async function clearSeenAssignment(erinnerungId: string): Promise<void> {
  seenAssignmentsStore.setState((state) => {
    const newMap = new Map(state.seenMap);
    newMap.delete(erinnerungId);
    return { ...state, seenMap: newMap };
  });

  await persistToTauriStore();
}

/**
 * Entfernt mehrere Erinnerungen aus der Seen-Liste (Batch)
 *
 * Nuetzlich beim Cleanup von geloeschten Erinnerungen.
 *
 * @param erinnerungIds - IDs der Erinnerungen
 * @returns Promise wenn Operation abgeschlossen
 */
export async function clearSeenAssignmentsBatch(erinnerungIds: string[]): Promise<void> {
  if (erinnerungIds.length === 0) return;

  seenAssignmentsStore.setState((state) => {
    const newMap = new Map(state.seenMap);
    for (const id of erinnerungIds) {
      newMap.delete(id);
    }
    return { ...state, seenMap: newMap };
  });

  await persistToTauriStore();
}

/**
 * Setzt den Seen Assignments Store komplett zurueck
 *
 * Persistiert automatisch in den Tauri Store (loescht alle Daten).
 *
 * @returns Promise wenn Operation abgeschlossen
 */
export async function resetSeenAssignmentsStore(): Promise<void> {
  seenAssignmentsStore.setState(() => ({
    seenMap: new Map(),
    isInitialized: true,
  }));

  await persistToTauriStore();
}

// ============================================
// Selectors (Non-Reactive)
// ============================================

/**
 * Prueft ob eine Erinnerung noch ungesehen ist (non-reactive)
 *
 * Eine Erinnerung gilt als "ungesehen" wenn:
 * - Sie NICHT in der seenMap ist
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns true wenn ungesehen
 */
export function isUnseen(erinnerungId: string): boolean {
  return !seenAssignmentsStore.state.seenMap.has(erinnerungId);
}

/**
 * Gibt den Timestamp zurueck wann eine Erinnerung als gesehen markiert wurde
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns Timestamp oder undefined wenn nie gesehen
 */
export function getSeenTimestamp(erinnerungId: string): number | undefined {
  return seenAssignmentsStore.state.seenMap.get(erinnerungId);
}

// ============================================
// React Hooks
// ============================================

/**
 * Hook um zu pruefen ob eine Erinnerung noch ungesehen ist (AC3)
 *
 * Reaktiv - UI wird bei Aenderung aktualisiert.
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns true wenn ungesehen
 */
export function useIsUnseen(erinnerungId: string): boolean {
  return useStore(seenAssignmentsStore, (state) => !state.seenMap.has(erinnerungId));
}

/**
 * Hook fuer die Anzahl ungesehener Erinnerungen
 *
 * Benoetigt zusaetzlich die Liste der dem User zugewiesenen Erinnerungen
 * um nur relevante zu zaehlen.
 *
 * @returns Anzahl der nicht-gesehenen Erinnerungen im Store
 */
export function useSeenCount(): number {
  return useStore(seenAssignmentsStore, (state) => state.seenMap.size);
}

/**
 * Hook fuer den Initialisierungs-Status
 *
 * @returns true wenn Store aus Tauri Store geladen wurde
 */
export function useSeenAssignmentsInitialized(): boolean {
  return useStore(seenAssignmentsStore, (state) => state.isInitialized);
}

/**
 * Hook fuer den kompletten Seen Assignments Store State
 *
 * @returns Kompletter Store State
 */
export function useSeenAssignmentsState(): SeenAssignmentsStoreState {
  return useStore(seenAssignmentsStore, (state) => state);
}
