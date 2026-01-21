/**
 * FloatingPill Store fuer Urgent-Alarm Anzeige
 *
 * Verwaltet den State fuer FloatingPills bei Stufe 2 (urgent) Intensivierung.
 * FloatingPills schweben ueber anderen UI-Elementen und sind immer sichtbar.
 *
 * **Story 2.4 Task 7:**
 * - State: { activeFloatingPills: Record<erinnerungId, FloatingPillEntry> }
 * - Actions: showFloatingPill, hideFloatingPill, hideAllFloatingPills
 * - Selectors: useActiveFloatingPills, useIsFloating
 */

import { Store, useStore } from '@tanstack/react-store';

/**
 * FloatingPill Entry fuer eine einzelne Erinnerung
 */
export interface FloatingPillEntry {
  /** ID der Erinnerung */
  erinnerungId: string;
  /** Titel der Erinnerung (truncated fuer Anzeige) */
  titel: string;
  /** Zeitpunkt der Ausloesung (ISO-String) */
  ausgeloestAm: string;
  /** Zeitpunkt der FloatingPill-Aktivierung (ISO-String) */
  activatedAt: string;
}

/**
 * FloatingPill Store State Interface
 */
export interface FloatingPillStoreState {
  /** Map von Erinnerungs-ID zu FloatingPill Entry */
  activeFloatingPills: Record<string, FloatingPillEntry>;
}

/**
 * Initial Store State
 */
const initialState: FloatingPillStoreState = {
  activeFloatingPills: {},
};

/**
 * FloatingPill Store Instance
 */
export const floatingPillStore = new Store<FloatingPillStoreState>(initialState);

// ============================================
// Store Actions
// ============================================

/**
 * Zeigt eine FloatingPill fuer eine Erinnerung
 *
 * Wird aufgerufen wenn eine Erinnerung Intensivierungs-Stufe 2 (urgent) erreicht.
 *
 * @param erinnerungId - ID der Erinnerung
 * @param data - Daten fuer die FloatingPill Anzeige
 */
export const showFloatingPill = (erinnerungId: string, data: { titel: string; ausgeloestAm: string }): void => {
  // C4 Fix: Umfassende Input-Validierung
  if (!erinnerungId || typeof erinnerungId !== 'string') {
    console.warn('[FloatingPillStore] showFloatingPill: Invalid erinnerungId');
    return;
  }

  if (!data.titel || typeof data.titel !== 'string' || data.titel.trim() === '') {
    console.warn('[FloatingPillStore] showFloatingPill: Invalid titel', data);
    return;
  }

  if (!data.ausgeloestAm || typeof data.ausgeloestAm !== 'string') {
    console.warn('[FloatingPillStore] showFloatingPill: Invalid ausgeloestAm', data);
    return;
  }

  // Prüfe ob ausgeloestAm ein gültiges ISO-Datum ist
  const parsedDate = new Date(data.ausgeloestAm);
  if (Number.isNaN(parsedDate.getTime())) {
    console.warn('[FloatingPillStore] showFloatingPill: ausgeloestAm is not a valid date', data);
    return;
  }

  floatingPillStore.setState((state) => ({
    ...state,
    activeFloatingPills: {
      ...state.activeFloatingPills,
      [erinnerungId]: {
        erinnerungId,
        titel: data.titel.trim(),
        ausgeloestAm: data.ausgeloestAm,
        activatedAt: new Date().toISOString(),
      },
    },
  }));
};

/**
 * Versteckt die FloatingPill fuer eine Erinnerung
 *
 * Wird aufgerufen bei:
 * - Acknowledge
 * - Snooze
 * - Status-Wechsel (nicht mehr AUSGELOEST)
 *
 * @param erinnerungId - ID der Erinnerung
 */
export const hideFloatingPill = (erinnerungId: string): void => {
  floatingPillStore.setState((state) => {
    const { [erinnerungId]: _removed, ...rest } = state.activeFloatingPills;
    return {
      ...state,
      activeFloatingPills: rest,
    };
  });
};

/**
 * Versteckt alle FloatingPills
 *
 * Wird aufgerufen bei:
 * - Einsatz-Wechsel
 * - App Cleanup
 */
export const hideAllFloatingPills = (): void => {
  floatingPillStore.setState(initialState);
};

/**
 * Setzt den FloatingPill Store komplett zurueck
 */
export const resetFloatingPillStore = (): void => {
  floatingPillStore.setState(initialState);
};

// ============================================
// Selector Functions (Non-React)
// ============================================

/**
 * Prueft ob eine FloatingPill fuer eine Erinnerung aktiv ist
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns true wenn FloatingPill aktiv
 */
export const isFloating = (erinnerungId: string): boolean => {
  const state = floatingPillStore.state;
  return erinnerungId in state.activeFloatingPills;
};

/**
 * Holt alle aktiven FloatingPill Entries
 *
 * @returns Array von FloatingPillEntry
 */
export const getActiveFloatingPills = (): FloatingPillEntry[] => {
  const state = floatingPillStore.state;
  return Object.values(state.activeFloatingPills);
};

/**
 * Holt die Anzahl aktiver FloatingPills
 *
 * @returns Anzahl aktiver FloatingPills
 */
export const getFloatingPillCount = (): number => {
  const state = floatingPillStore.state;
  return Object.keys(state.activeFloatingPills).length;
};

// ============================================
// React Hooks
// ============================================

/**
 * Hook der prueft ob eine FloatingPill fuer eine Erinnerung aktiv ist
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns true wenn FloatingPill aktiv
 */
export const useIsFloating = (erinnerungId: string): boolean => {
  return useStore(floatingPillStore, (state) => erinnerungId in state.activeFloatingPills);
};

/**
 * Hook fuer alle aktiven FloatingPill Entries
 *
 * @returns Array von FloatingPillEntry
 */
export const useActiveFloatingPills = (): FloatingPillEntry[] => {
  return useStore(floatingPillStore, (state) => Object.values(state.activeFloatingPills));
};

/**
 * Hook fuer eine spezifische FloatingPill Entry
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns FloatingPillEntry oder null
 */
export const useFloatingPillEntry = (erinnerungId: string): FloatingPillEntry | null => {
  return useStore(floatingPillStore, (state) => state.activeFloatingPills[erinnerungId] ?? null);
};

/**
 * Hook fuer die Anzahl aktiver FloatingPills
 *
 * @returns Anzahl aktiver FloatingPills
 */
export const useFloatingPillCount = (): number => {
  return useStore(floatingPillStore, (state) => Object.keys(state.activeFloatingPills).length);
};

/**
 * Hook fuer den kompletten FloatingPill Store State
 *
 * @returns Kompletter Store State
 */
export const useFloatingPillStoreState = (): FloatingPillStoreState => {
  return useStore(floatingPillStore, (state) => state);
};
