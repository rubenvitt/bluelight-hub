/**
 * Intensification Store fuer Alarm-Intensivierung
 *
 * Verwaltet den Intensivierungs-State pro Erinnerung mit TanStack Store.
 * Ermoeglicht UI-Komponenten reaktiv auf Intensivierungs-Level zu reagieren.
 *
 * **Story 2.3 Task 6:**
 * - State: { [erinnerungId]: { level, startedAt } }
 * - Selectors: getIntensityLevel, isIntensified
 * - Helper Functions: setIntensityLevel, clearIntensity
 */

import { Store, useStore } from '@tanstack/react-store';

/**
 * Intensivierungs-Level
 *
 * - none: Keine Intensivierung (initial)
 * - warning: Stufe 1 - nach 30s ohne Reaktion (Story 2.3)
 * - urgent: Stufe 2 - nach 60s ohne Reaktion (Story 2.4 - zukuenftig)
 */
export type IntensityLevel = 'none' | 'warning' | 'urgent';

/**
 * Intensivierungs-State fuer eine einzelne Erinnerung
 */
export interface IntensificationEntry {
  /** Aktuelles Intensivierungs-Level */
  level: IntensityLevel;
  /** Zeitpunkt des Starts der Intensivierung (ISO-String) */
  startedAt: string | null;
  /** Zeitpunkt der letzten Level-Aenderung (ISO-String) */
  lastEscalatedAt: string | null;
}

/**
 * Intensification Store State Interface
 */
export interface IntensificationStoreState {
  /** Map von Erinnerungs-ID zu Intensivierungs-State */
  entries: Record<string, IntensificationEntry>;
}

/**
 * Initial State fuer eine neue Erinnerung
 */
const createInitialEntry = (): IntensificationEntry => ({
  level: 'none',
  startedAt: null,
  lastEscalatedAt: null,
});

/**
 * Initial Store State
 */
const initialState: IntensificationStoreState = {
  entries: {},
};

/**
 * Intensification Store Instance
 */
export const intensificationStore = new Store<IntensificationStoreState>(initialState);

// ============================================
// Store Actions (Helper Functions)
// ============================================

/**
 * Setzt das Intensivierungs-Level fuer eine Erinnerung
 *
 * Wird vom IntensificationService aufgerufen wenn ein Timer ablaeuft.
 *
 * @param erinnerungId - ID der Erinnerung
 * @param level - Neues Intensivierungs-Level
 */
export const setIntensityLevel = (erinnerungId: string, level: IntensityLevel): void => {
  intensificationStore.setState((state) => {
    const existing = state.entries[erinnerungId] ?? createInitialEntry();
    const now = new Date().toISOString();

    return {
      ...state,
      entries: {
        ...state.entries,
        [erinnerungId]: {
          level,
          startedAt: existing.startedAt ?? (level !== 'none' ? now : null),
          lastEscalatedAt: level !== 'none' ? now : null,
        },
      },
    };
  });
};

/**
 * Startet die Intensivierungs-Tracking fuer eine Erinnerung
 *
 * Wird aufgerufen wenn eine Erinnerung ausgeloest wird (AUSGELOEST Status).
 * Initialisiert den Entry mit level='none' und startedAt=now.
 *
 * @param erinnerungId - ID der Erinnerung
 */
export const startIntensificationTracking = (erinnerungId: string): void => {
  intensificationStore.setState((state) => ({
    ...state,
    entries: {
      ...state.entries,
      [erinnerungId]: {
        level: 'none',
        startedAt: new Date().toISOString(),
        lastEscalatedAt: null,
      },
    },
  }));
};

/**
 * Entfernt die Intensivierung fuer eine Erinnerung
 *
 * Wird aufgerufen bei:
 * - Acknowledge
 * - Snooze
 * - Status-Wechsel (nicht mehr AUSGELOEST)
 *
 * @param erinnerungId - ID der Erinnerung
 */
export const clearIntensity = (erinnerungId: string): void => {
  intensificationStore.setState((state) => {
    const { [erinnerungId]: _removed, ...rest } = state.entries;
    return {
      ...state,
      entries: rest,
    };
  });
};

/**
 * Entfernt alle Intensivierungen
 *
 * Wird aufgerufen bei:
 * - Einsatz-Wechsel
 * - App Cleanup
 */
export const clearAllIntensifications = (): void => {
  intensificationStore.setState(initialState);
};

/**
 * Setzt den Intensification Store komplett zurueck
 */
export const resetIntensificationStore = (): void => {
  intensificationStore.setState(initialState);
};

// ============================================
// Selector Functions (Non-React)
// ============================================

/**
 * Holt das aktuelle Intensivierungs-Level fuer eine Erinnerung
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns Aktuelles Level oder 'none'
 */
export const getIntensityLevel = (erinnerungId: string): IntensityLevel => {
  const state = intensificationStore.state;
  return state.entries[erinnerungId]?.level ?? 'none';
};

/**
 * Prueft ob eine Erinnerung intensiviert ist
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns true wenn Level !== 'none'
 */
export const isIntensified = (erinnerungId: string): boolean => {
  return getIntensityLevel(erinnerungId) !== 'none';
};

// ============================================
// React Hooks
// ============================================

/**
 * Hook fuer das Intensivierungs-Level einer spezifischen Erinnerung
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns Aktuelles Intensivierungs-Level
 */
export const useIntensityLevel = (erinnerungId: string): IntensityLevel => {
  return useStore(intensificationStore, (state) => state.entries[erinnerungId]?.level ?? 'none');
};

/**
 * Hook der prueft ob eine Erinnerung intensiviert ist
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns true wenn intensiviert
 */
export const useIsIntensified = (erinnerungId: string): boolean => {
  return useStore(intensificationStore, (state) => (state.entries[erinnerungId]?.level ?? 'none') !== 'none');
};

/**
 * Hook fuer den kompletten Intensivierungs-Entry einer Erinnerung
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns IntensificationEntry oder null
 */
export const useIntensificationEntry = (erinnerungId: string): IntensificationEntry | null => {
  return useStore(intensificationStore, (state) => state.entries[erinnerungId] ?? null);
};

/**
 * Hook fuer die Anzahl intensivierter Erinnerungen
 *
 * @returns Anzahl der Erinnerungen mit level !== 'none'
 */
export const useIntensifiedCount = (): number => {
  return useStore(intensificationStore, (state) => Object.values(state.entries).filter((e) => e.level !== 'none').length);
};

/**
 * Hook fuer den kompletten Intensification Store State
 *
 * @returns Kompletter Store State
 */
export const useIntensificationStoreState = (): IntensificationStoreState => {
  return useStore(intensificationStore, (state) => state);
};
