/**
 * Animation Store
 *
 * Trackt welche Erinnerungen gerade eine Update-Animation zeigen sollen.
 * Genutzt fuer Real-time WebSocket Updates (Story 3.2).
 *
 * **Story 3.2 AC2:** Status-Aenderungsanimation bei WebSocket-Events
 * **Story 3.2 Task 2.1:** Animation-Utility fuer Updates
 */

import { Store, useStore } from '@tanstack/react-store';

/**
 * Animation-Typ fuer verschiedene Effekte
 */
export type AnimationType = 'update' | 'insert' | 'delete';

/**
 * Animation Entry mit Typ und Timestamp
 */
export interface AnimationEntry {
  type: AnimationType;
  timestamp: number;
}

/**
 * Animation Store State
 */
export interface AnimationStoreState {
  /** Map von erinnerungId zu Animation-Entry */
  animatedIds: Map<string, AnimationEntry>;
}

/**
 * Zentrale Animation-Konfiguration
 *
 * Exportiert fuer Wiederverwendung in CSS/Tailwind und Tests.
 * Bei Aenderungen hier muessen CSS-Variablen entsprechend angepasst werden.
 */
export const ANIMATION_CONFIG = {
  /** Dauer der Highlight-Animation in Millisekunden */
  HIGHLIGHT_DURATION_MS: 1500,
  /** Dauer der Slide-In-Animation in Millisekunden */
  SLIDE_IN_DURATION_MS: 400,
} as const;

/**
 * Timer-Tracking Map zur Vermeidung von Memory Leaks.
 *
 * Speichert aktive setTimeout-IDs pro erinnerungId, damit Timer
 * bei schnellen WebSocket-Events abgebrochen werden koennen.
 */
const activeTimers = new Map<string, number>();

/**
 * TanStack Store fuer Animation-State
 */
export const animationStore = new Store<AnimationStoreState>({
  animatedIds: new Map(),
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Fuegt eine Erinnerung zur Animation-Liste hinzu.
 * Entfernt automatisch nach ANIMATION_CONFIG.HIGHLIGHT_DURATION_MS.
 *
 * Bestehende Timer werden abgebrochen um Memory Leaks bei
 * schnellen aufeinanderfolgenden WebSocket-Events zu vermeiden.
 *
 * @param erinnerungId - ID der zu animierenden Erinnerung
 * @param type - Typ der Animation (update, insert, delete)
 */
export function addAnimatedId(erinnerungId: string, type: AnimationType = 'update'): void {
  // Bestehenden Timer abbrechen falls vorhanden (Memory Leak Prevention)
  const existingTimer = activeTimers.get(erinnerungId);
  if (existingTimer !== undefined) {
    clearTimeout(existingTimer);
    activeTimers.delete(erinnerungId);
  }

  animationStore.setState((state) => {
    const newMap = new Map(state.animatedIds);
    newMap.set(erinnerungId, {
      type,
      timestamp: Date.now(),
    });
    return { ...state, animatedIds: newMap };
  });

  // Auto-Cleanup nach Animation-Dauer mit Timer-Tracking
  const timerId = window.setTimeout(() => {
    removeAnimatedId(erinnerungId);
    activeTimers.delete(erinnerungId);
  }, ANIMATION_CONFIG.HIGHLIGHT_DURATION_MS);

  activeTimers.set(erinnerungId, timerId);
}

/**
 * Entfernt eine Erinnerung aus der Animation-Liste.
 *
 * @param erinnerungId - ID der Erinnerung
 */
export function removeAnimatedId(erinnerungId: string): void {
  animationStore.setState((state) => {
    const newMap = new Map(state.animatedIds);
    newMap.delete(erinnerungId);
    return { ...state, animatedIds: newMap };
  });
}

/**
 * Entfernt alle Animationen und bricht aktive Timer ab.
 */
export function clearAllAnimations(): void {
  clearAllAnimationTimers();
  animationStore.setState((state) => ({
    ...state,
    animatedIds: new Map(),
  }));
}

/**
 * Bricht alle aktiven Animation-Timer ab.
 *
 * Cleanup-Funktion fuer Component Unmount und Tests.
 * Verhindert Memory Leaks bei langen Sessions.
 */
export function clearAllAnimationTimers(): void {
  for (const timerId of activeTimers.values()) {
    clearTimeout(timerId);
  }
  activeTimers.clear();
}

/**
 * Resettet den Animation-Store auf Initialzustand.
 * Bricht auch alle aktiven Timer ab.
 */
export function resetAnimationStore(): void {
  clearAllAnimationTimers();
  animationStore.setState(() => ({
    animatedIds: new Map(),
  }));
}

// ============================================================================
// Selectors
// ============================================================================

/**
 * Prueft ob eine Erinnerung gerade animiert wird.
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns true wenn Animation aktiv
 */
export function isAnimated(erinnerungId: string): boolean {
  return animationStore.state.animatedIds.has(erinnerungId);
}

/**
 * Gibt den Animation-Typ fuer eine Erinnerung zurueck.
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns Animation-Entry oder undefined
 */
export function getAnimationEntry(erinnerungId: string): AnimationEntry | undefined {
  return animationStore.state.animatedIds.get(erinnerungId);
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook um zu pruefen ob eine Erinnerung animiert wird.
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns true wenn Animation aktiv
 */
export function useIsAnimated(erinnerungId: string): boolean {
  return useStore(animationStore, (state) => state.animatedIds.has(erinnerungId));
}

/**
 * Hook fuer den Animation-Typ einer Erinnerung.
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns Animation-Entry oder undefined
 */
export function useAnimationEntry(erinnerungId: string): AnimationEntry | undefined {
  return useStore(animationStore, (state) => state.animatedIds.get(erinnerungId));
}

/**
 * Hook fuer den kompletten Animation-Store State (Debug/Testing).
 *
 * @returns Kompletter Store State
 */
export function useAnimationStoreState(): AnimationStoreState {
  return useStore(animationStore);
}
