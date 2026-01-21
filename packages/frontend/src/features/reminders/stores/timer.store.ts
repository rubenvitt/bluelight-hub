/**
 * Timer Store fuer Erinnerungs-Timer Management
 *
 * Verwaltet den Timer-State mit TanStack Store und optionaler Tauri Store Persistence.
 * Integriert mit dem TimerService fuer die eigentliche Timer-Logik.
 *
 * **Story 1.5 Task 13:**
 * - TanStack Store fuer activeTimers State
 * - Tauri Store Keys fuer Persistence
 * - Helper Functions fuer Timer-Management
 */

import type { ErinnerungResponseDto } from '@/shared';
import { Store, useStore } from '@tanstack/react-store';

/**
 * Timer State fuer eine einzelne Erinnerung
 */
export interface TimerState {
  /** ID der Erinnerung */
  erinnerungId: string;
  /** Titel der Erinnerung (fuer Notifications) */
  titel: string;
  /** Faelligkeitszeitpunkt als ISO-String */
  faelligAm: string;
  /** Ob der Timer bereits ausgeloest wurde */
  triggered: boolean;
  /** Zeitpunkt der Ausloesung (ISO-String, optional) */
  triggeredAt: string | null;
}

/**
 * Timer Store State Interface
 */
export interface TimerStoreState {
  /** Map von Erinnerungs-ID zu Timer-State */
  activeTimers: Map<string, TimerState>;
  /** Zeitpunkt der letzten Timer-Pruefung (ISO-String) */
  lastCheck: string | null;
  /** Ob der Timer-Service laeuft */
  isRunning: boolean;
  /** Aktueller Einsatz-ID Kontext */
  currentEinsatzId: string | null;
}

/** Tauri Store Keys fuer Persistence */
export const TIMER_STORE_KEYS = {
  /** Aktive Timer */
  TIMERS: 'reminders.timers',
  /** Zeitpunkt der letzten Pruefung */
  LAST_CHECK: 'reminders.lastCheck',
} as const;

/**
 * Initial State
 */
const initialState: TimerStoreState = {
  activeTimers: new Map(),
  lastCheck: null,
  isRunning: false,
  currentEinsatzId: null,
};

/**
 * Timer Store Instance
 */
export const timerStore = new Store<TimerStoreState>(initialState);

// ============================================
// Store Actions (Helper Functions)
// ============================================

/**
 * Startet einen Timer fuer eine Erinnerung
 *
 * Fuegt die Erinnerung zur aktiven Timer-Map hinzu.
 *
 * @param erinnerung - Die Erinnerung fuer die ein Timer gestartet werden soll
 */
export const startTimerForErinnerung = (erinnerung: ErinnerungResponseDto): void => {
  timerStore.setState((state) => {
    const newTimers = new Map(state.activeTimers);
    newTimers.set(erinnerung.id, {
      erinnerungId: erinnerung.id,
      titel: erinnerung.titel,
      faelligAm: erinnerung.faelligAm,
      triggered: false,
      triggeredAt: null,
    });
    return {
      ...state,
      activeTimers: newTimers,
    };
  });
};

/**
 * Stoppt einen Timer fuer eine Erinnerung
 *
 * Entfernt die Erinnerung aus der aktiven Timer-Map.
 *
 * @param erinnerungId - ID der Erinnerung
 */
export const clearTimerForErinnerung = (erinnerungId: string): void => {
  timerStore.setState((state) => {
    const newTimers = new Map(state.activeTimers);
    newTimers.delete(erinnerungId);
    return {
      ...state,
      activeTimers: newTimers,
    };
  });
};

/**
 * Markiert eine Erinnerung als ausgeloest
 *
 * Setzt den triggered-Flag und speichert den Zeitpunkt.
 *
 * @param erinnerungId - ID der ausgeloesten Erinnerung
 */
export const markTimerAsTriggered = (erinnerungId: string): void => {
  timerStore.setState((state) => {
    const newTimers = new Map(state.activeTimers);
    const existing = newTimers.get(erinnerungId);
    if (existing) {
      newTimers.set(erinnerungId, {
        ...existing,
        triggered: true,
        triggeredAt: new Date().toISOString(),
      });
    }
    return {
      ...state,
      activeTimers: newTimers,
    };
  });
};

/**
 * Synchronisiert Timer mit einer Liste von Erinnerungen
 *
 * Fuegt neue Timer hinzu und entfernt nicht mehr existierende oder bestaetigte.
 *
 * **Story 1.6 AC4:** Timer wird bei ACKNOWLEDGED Status entfernt (Tray Badge Update)
 *
 * @param erinnerungen - Aktuelle Liste der Erinnerungen
 * @param einsatzId - ID des Einsatzes
 */
export const syncTimersWithErinnerungen = (erinnerungen: ErinnerungResponseDto[], einsatzId: string): void => {
  timerStore.setState((state) => {
    const newTimers = new Map<string, TimerState>();
    // Map von ID zu Erinnerung fuer schnellen Status-Lookup
    const erinnerungMap = new Map(erinnerungen.map((e) => [e.id, e]));

    // Behalte existierende Timer nur wenn Erinnerung noch aktiv ist (GEPLANT oder AUSGELOEST)
    // Story 1.6: ACKNOWLEDGED Timer werden entfernt
    for (const [id, timer] of state.activeTimers) {
      const erinnerung = erinnerungMap.get(id);
      // Behalte Timer nur wenn Erinnerung existiert UND nicht ACKNOWLEDGED/GELOESCHT ist
      if (erinnerung && (erinnerung.status === 'GEPLANT' || erinnerung.status === 'AUSGELOEST')) {
        newTimers.set(id, timer);
      }
    }

    // Fuege neue Timer hinzu (nur GEPLANT Status)
    for (const erinnerung of erinnerungen) {
      if (erinnerung.status === 'GEPLANT' && !newTimers.has(erinnerung.id)) {
        newTimers.set(erinnerung.id, {
          erinnerungId: erinnerung.id,
          titel: erinnerung.titel,
          faelligAm: erinnerung.faelligAm,
          triggered: false,
          triggeredAt: null,
        });
      }
    }

    return {
      ...state,
      activeTimers: newTimers,
      currentEinsatzId: einsatzId,
      lastCheck: new Date().toISOString(),
    };
  });
};

/**
 * Setzt den Timer-Running-Status
 *
 * @param isRunning - Ob der Timer laeuft
 */
export const setTimerRunning = (isRunning: boolean): void => {
  timerStore.setState((state) => ({
    ...state,
    isRunning,
  }));
};

/**
 * Setzt den Timer Store komplett zurueck
 */
export const resetTimerStore = (): void => {
  timerStore.setState(initialState);
};

// ============================================
// React Hooks
// ============================================

/**
 * Hook fuer den Timer-Running-Status
 *
 * @returns Ob der Timer aktuell laeuft
 */
export const useTimerRunning = (): boolean => {
  return useStore(timerStore, (state) => state.isRunning);
};

/**
 * Hook fuer die Anzahl aktiver Timer
 *
 * @returns Anzahl der aktiven Timer
 */
export const useActiveTimerCount = (): number => {
  return useStore(timerStore, (state) => state.activeTimers.size);
};

/**
 * Hook fuer die Anzahl ausgeloester Timer
 *
 * @returns Anzahl der ausgeloesten Timer
 */
export const useTriggeredTimerCount = (): number => {
  return useStore(timerStore, (state) => {
    let count = 0;
    for (const timer of state.activeTimers.values()) {
      if (timer.triggered) count++;
    }
    return count;
  });
};

/**
 * Hook fuer den Timer-State einer spezifischen Erinnerung
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns Timer-State oder null
 */
export const useTimerState = (erinnerungId: string): TimerState | null => {
  return useStore(timerStore, (state) => state.activeTimers.get(erinnerungId) ?? null);
};

/**
 * Hook fuer den kompletten Timer Store State
 *
 * @returns Kompletter Timer Store State
 */
export const useTimerStoreState = (): TimerStoreState => {
  return useStore(timerStore, (state) => state);
};

/**
 * Hook fuer die IDs der ausgeloesten Timer
 *
 * Story 1.9 AC3: Fuer Tray-Click Navigation zur ersten ausgeloesten Erinnerung.
 *
 * @returns Array der Erinnerungs-IDs die ausgeloest wurden
 */
export const useTriggeredTimerIds = (): string[] => {
  return useStore(timerStore, (state) => {
    const ids: string[] = [];
    for (const timer of state.activeTimers.values()) {
      if (timer.triggered) {
        ids.push(timer.erinnerungId);
      }
    }
    return ids;
  });
};
